/**
 * Aegis AI-Assisted Compliance Service
 *
 * Runs a lightweight regulatory posture check BEFORE shield creation. The LLM
 * classifies the hedge asset's regulatory class (e.g. USDY = regulated yield
 * instrument that may require accredited-investor / jurisdiction checks; mETH =
 * liquid staking token) and flags issues. A deterministic rule set is the
 * always-available fallback, so the check never blocks the demo on LLM downtime.
 *
 * Verdicts:
 *   "pass"   -> proceed
 *   "flag"   -> proceed but surface warnings (e.g. accreditation recommended)
 *   "reject" -> block shield creation (sanctioned / empty jurisdiction)
 */

const nimFallbackService = require('./nimFallbackService');

// Minimal sanctioned-jurisdiction list (ISO-ish codes + common names) for the demo.
const SANCTIONED = new Set([
  'kp', 'north korea', 'ir', 'iran', 'sy', 'syria', 'cu', 'cuba',
  'ru', 'russia', 'by', 'belarus',
]);

// Static regulatory class hints per asset symbol.
const ASSET_CLASS = {
  USDY: {
    assetClass: 'regulated-yield-instrument',
    needsAccreditation: true,
    note: 'USDY is a regulated tokenized US-dollar yield instrument; some jurisdictions require accredited-investor status.',
  },
  METH: {
    assetClass: 'liquid-staking-token',
    needsAccreditation: false,
    note: 'mETH is a liquid staking token; generally treated as a crypto-asset, light-touch compliance.',
  },
  BTC: {
    assetClass: 'crypto-asset',
    needsAccreditation: false,
    note: 'BTC proxy — crypto-asset, standard KYC/AML applies.',
  },
  GOLD: {
    assetClass: 'tokenized-commodity',
    needsAccreditation: false,
    note: 'Tokenized gold proxy — commodity-backed token.',
  },
};

const SYSTEM_PROMPT = `You are a compliance classifier for a tokenized-RWA hedging product on the Mantle network.
Given an asset symbol and a user's jurisdiction, classify the regulatory posture.
Return ONLY valid JSON (no prose, no fences) with EXACTLY these keys:
{
  "verdict": "pass" | "flag" | "reject",
  "assetClass": "<short class label, e.g. regulated-yield-instrument, liquid-staking-token, crypto-asset>",
  "flags": ["<short flag strings>"],
  "notes": "<one short sentence>"
}
Rules:
- USDY is a regulated tokenized US-dollar yield instrument: if the user is not attested accredited, verdict "flag" with an "accreditation-recommended" flag.
- mETH and other liquid staking / crypto assets: usually "pass".
- Empty or sanctioned jurisdiction (North Korea, Iran, Syria, Cuba, Russia, Belarus): verdict "reject".`;

function isConfigured() {
  return nimFallbackService.isConfigured() || !!process.env.OPENAI_API_KEY;
}

function getInfo() {
  return {
    configured: isConfigured(),
    checkedBy: 'aegis-ai-compliance',
    sanctionedCount: SANCTIONED.size,
  };
}

function normalizeJurisdiction(j) {
  return String(j || '').trim().toLowerCase();
}

/**
 * Deterministic compliance ruleset — always available.
 */
function heuristicCheck({ user, asset, jurisdiction, attestedAccredited }) {
  const jur = normalizeJurisdiction(jurisdiction);
  const sym = String(asset || '').toUpperCase();
  const cls = ASSET_CLASS[sym] || { assetClass: 'unknown', needsAccreditation: false, note: 'Unrecognized asset.' };
  const flags = [];

  if (!jur) {
    return {
      verdict: 'reject',
      assetClass: cls.assetClass,
      jurisdiction: jur || null,
      flags: ['missing-jurisdiction'],
      checkedBy: 'aegis-ai-compliance',
      notes: 'Jurisdiction is required to create a shield.',
    };
  }
  if (SANCTIONED.has(jur)) {
    return {
      verdict: 'reject',
      assetClass: cls.assetClass,
      jurisdiction: jur,
      flags: ['sanctioned-jurisdiction'],
      checkedBy: 'aegis-ai-compliance',
      notes: `Jurisdiction "${jurisdiction}" is sanctioned — shield creation blocked.`,
    };
  }

  let verdict = 'pass';
  if (cls.needsAccreditation && !attestedAccredited) {
    verdict = 'flag';
    flags.push('accreditation-recommended');
  }

  return {
    verdict,
    assetClass: cls.assetClass,
    jurisdiction: jur,
    flags,
    checkedBy: 'aegis-ai-compliance',
    notes: cls.note,
  };
}

function parseComplianceJson(text) {
  if (!text || typeof text !== 'string') return null;
  let cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const m = cleaned.match(/\{[\s\S]*\}/);
  const blob = m ? m[0] : cleaned;
  try {
    const j = JSON.parse(blob);
    const verdict = ['pass', 'flag', 'reject'].includes(j.verdict) ? j.verdict : null;
    if (!verdict) return null;
    return {
      verdict,
      assetClass: typeof j.assetClass === 'string' ? j.assetClass : 'unknown',
      flags: Array.isArray(j.flags) ? j.flags.map(String) : [],
      notes: typeof j.notes === 'string' ? j.notes : '',
    };
  } catch {
    return null;
  }
}

/**
 * @param {object} opts
 * @param {string} opts.user
 * @param {string} opts.asset           symbol (e.g. USDY, mETH)
 * @param {string} opts.jurisdiction
 * @param {boolean} [opts.attestedAccredited]
 * @returns {Promise<{verdict, assetClass, jurisdiction, flags, checkedBy, notes}>}
 */
async function checkCompliance({ user, asset, jurisdiction, attestedAccredited } = {}) {
  const jur = normalizeJurisdiction(jurisdiction);

  // Hard rules first — never defer a sanctioned/empty jurisdiction to the LLM.
  if (!jur || SANCTIONED.has(jur)) {
    return heuristicCheck({ user, asset, jurisdiction, attestedAccredited });
  }

  // LLM-assisted classification when configured.
  const userPrompt = `Asset: ${asset}. Jurisdiction: ${jurisdiction}. Attested accredited: ${!!attestedAccredited}. User: ${user || 'n/a'}.`;
  try {
    let llm = null;
    if (nimFallbackService.isConfigured()) {
      llm = await nimFallbackService.chatCompletion({ systemPrompt: SYSTEM_PROMPT, userPrompt });
    } else if (process.env.OPENAI_API_KEY) {
      const oa = require('openai');
      const OpenAICtor = oa.OpenAI || oa.default || oa;
      const client = new OpenAICtor({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
      });
      llm = { content: completion?.choices?.[0]?.message?.content || '' };
    }
    if (llm) {
      const parsed = parseComplianceJson(llm.content);
      if (parsed) {
        return {
          verdict: parsed.verdict,
          assetClass: parsed.assetClass,
          jurisdiction: jur,
          flags: parsed.flags,
          checkedBy: 'aegis-ai-compliance',
          notes: parsed.notes,
        };
      }
    }
  } catch (err) {
    console.warn(`[Compliance] LLM check failed: ${err.message || err} — using heuristic`);
  }

  return heuristicCheck({ user, asset, jurisdiction, attestedAccredited });
}

module.exports = {
  checkCompliance,
  isConfigured,
  getInfo,
  // exposed for tests
  heuristicCheck,
};
