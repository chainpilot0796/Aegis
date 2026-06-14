/**
 * Aegis AI Advisor Service (auditable, risk-driving)
 *
 * This is NOT a chatbot. Given a user's financial concern, the advisor:
 *   (a) PICKS the hedge asset from the Mantle RWA universe, AND
 *   (b) DERIVES the risk-sizing parameters (hedge ratio / principal clamp /
 *       volatility), sizing the hedge ratio from the asset's volatility.
 *
 * The full recommendation + risk params are later hashed (keccak256) into the
 * "shield envelope" and committed on-chain via AegisVault.createShield's
 * `storageRootHash` argument — making the agent's decision verifiable.
 *
 * LLM plumbing reuses the existing fallbacks:
 *   1. NVIDIA NIM  (NIM_API_KEY)            — primary
 *   2. OpenAI      (OPENAI_API_KEY)         — secondary
 *   3. Deterministic heuristic              — always available, so the demo
 *                                             never breaks.
 */

const { ethers } = require('ethers');
const nimFallbackService = require('./nimFallbackService');

// Mantle RWA hedge universe. The on-chain demo uses mETH/USDY; the others are
// offered so the AI can reason over a small realistic set of RWA proxies.
// `vol` is an annualized volatility prior (percent) used to seed risk sizing.
const ASSET_UNIVERSE = [
  { symbol: 'mETH', name: 'Mantle Staked ETH', category: 'lst', vol: 65, onChain: true },
  { symbol: 'USDY', name: 'Ondo US Dollar Yield', category: 'rwa-yield', vol: 1, onChain: true },
  { symbol: 'BTC', name: 'Bitcoin (proxy)', category: 'crypto', vol: 55 },
  { symbol: 'GOLD', name: 'Tokenized Gold (proxy)', category: 'commodity', vol: 15 },
];

const ASSET_BY_SYMBOL = Object.fromEntries(
  ASSET_UNIVERSE.map((a) => [a.symbol.toUpperCase(), a])
);
const SYMBOLS = ASSET_UNIVERSE.map((a) => a.symbol);

const SYSTEM_PROMPT = `You are the Aegis AI risk advisor for a principal-protected yield shield on the Mantle network.
Given a user's financial concern, you must do TWO things:
1. Pick exactly ONE hedge asset from this universe (use the exact symbol): ${SYMBOLS.join(', ')}.
2. Derive risk-sizing parameters, sizing the hedge ratio INVERSELY to the asset's volatility
   (higher volatility => smaller hedge ratio so the yield budget is not over-exposed).

Return ONLY valid JSON (no prose, no markdown fences) with EXACTLY these keys:
{
  "asset": "<one of: ${SYMBOLS.join(', ')}>",
  "reasoning": "<one short sentence, < 30 words, why this hedge fits the concern>",
  "volatilityPct": <number 0-100, your estimate of the asset's annualized volatility>,
  "hedgeRatioBps": <integer 0-10000, fraction of the yield budget to deploy as hedge>,
  "sizingRationale": "<one short sentence on how volatility drove the hedge ratio>"
}

Guidance:
- inflation / dollar debasement / stable income -> USDY (regulated yield instrument)
- ETH / staking / crypto upside -> mETH
- bitcoin / crypto beta -> BTC
- safe haven / gold / hard assets -> GOLD
- Low-vol assets (USDY) can take hedgeRatioBps near 10000; high-vol (mETH, BTC) should be 3000-6000.`;

function clampBps(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 5000;
  return Math.max(0, Math.min(10000, v));
}

/**
 * Deterministic risk-sizing heuristic — higher volatility => lower hedgeRatioBps.
 * Maps a volatility prior (percent) to a hedge ratio in [3000, 10000] bps.
 */
function heuristicHedgeRatio(volPct) {
  const vol = Math.max(0, Number(volPct) || 0);
  // 0% vol -> 10000 bps; 80%+ vol -> 3000 bps. Linear in between.
  const bps = 10000 - (vol / 80) * 7000;
  return clampBps(bps);
}

/**
 * Deterministic keyword-based asset pick. Always returns a valid universe entry.
 */
function heuristicAssetPick(concern) {
  const lower = String(concern || '').toLowerCase();
  if (/inflation|dollar|debase|stable|income|fiat|cash|savings|yield/.test(lower)) {
    return ASSET_BY_SYMBOL.USDY;
  }
  if (/bitcoin|btc/.test(lower)) return ASSET_BY_SYMBOL.BTC;
  if (/gold|silver|safe haven|hard asset|precious/.test(lower)) return ASSET_BY_SYMBOL.GOLD;
  if (/eth|ethereum|stak|defi|crypto/.test(lower)) return ASSET_BY_SYMBOL.METH;
  // Default to mETH — the canonical on-chain hedge target.
  return ASSET_BY_SYMBOL.METH;
}

function parseAdvisorJson(text) {
  if (!text || typeof text !== 'string') return null;
  let cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const m = cleaned.match(/\{[\s\S]*\}/);
  const blob = m ? m[0] : cleaned;
  try {
    const j = JSON.parse(blob);
    const sym = String(j.asset || '').toUpperCase();
    const asset = ASSET_BY_SYMBOL[sym];
    if (!asset) return null;
    return {
      asset,
      reasoning: typeof j.reasoning === 'string' ? j.reasoning : '',
      volatilityPct: Number(j.volatilityPct),
      hedgeRatioBps: j.hedgeRatioBps,
      sizingRationale: typeof j.sizingRationale === 'string' ? j.sizingRationale : '',
    };
  } catch {
    return null;
  }
}

function isConfigured() {
  return nimFallbackService.isConfigured() || !!process.env.OPENAI_API_KEY;
}

function getInfo() {
  return {
    configured: isConfigured(),
    providers: [
      nimFallbackService.isConfigured() ? 'nim' : null,
      process.env.OPENAI_API_KEY ? 'openai' : null,
      'heuristic',
    ].filter(Boolean),
    universe: SYMBOLS,
  };
}

async function callLlm(userPrompt) {
  // 1. NIM
  if (nimFallbackService.isConfigured()) {
    try {
      const r = await nimFallbackService.chatCompletion({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
      });
      return { content: r.content, model: r.model, provider: 'nim' };
    } catch (err) {
      console.warn(`[AI Advisor] NIM failed: ${err.message || err}`);
    }
  }
  // 2. OpenAI
  if (process.env.OPENAI_API_KEY) {
    try {
      const oa = require('openai');
      const OpenAICtor = oa.OpenAI || oa.default || oa;
      const client = new OpenAICtor({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
      });
      return {
        content: completion?.choices?.[0]?.message?.content || '',
        model: completion?.model || 'openai',
        provider: 'openai',
      };
    } catch (err) {
      console.warn(`[AI Advisor] OpenAI failed: ${err.message || err}`);
    }
  }
  return null;
}

/**
 * Recommend a shield: asset pick + AI-derived risk params + entry price.
 *
 * @param {object} opts
 * @param {string} opts.concern          natural-language concern
 * @param {number} [opts.depositAmount]  deposit (for context; not required)
 * @param {number} [opts.durationSeconds]
 * @returns {Promise<{
 *   recommendation: { asset, assetId, direction, reasoning, model, provider },
 *   riskParams: { hedgeRatioBps, principalClampBps, volatilityPct, sizingRationale },
 *   entryPrice: number
 * }>}
 */
async function recommendShield({ concern, depositAmount, durationSeconds } = {}) {
  if (!concern || typeof concern !== 'string') {
    throw new Error('concern (string) required');
  }

  const userPrompt = `Concern: "${concern}". Deposit: ${depositAmount || 'unspecified'}. Duration(s): ${durationSeconds || 'unspecified'}.`;

  let chosen = null;
  let model = 'heuristic';
  let provider = 'heuristic';
  let reasoning = '';
  let volatilityPct = null;
  let hedgeRatioBps = null;
  let sizingRationale = '';

  const llm = await callLlm(userPrompt);
  if (llm) {
    const parsed = parseAdvisorJson(llm.content);
    if (parsed) {
      chosen = parsed.asset;
      model = llm.model;
      provider = llm.provider;
      reasoning = parsed.reasoning;
      volatilityPct = Number.isFinite(parsed.volatilityPct)
        ? parsed.volatilityPct
        : chosen.vol;
      hedgeRatioBps = clampBps(parsed.hedgeRatioBps);
      sizingRationale = parsed.sizingRationale;
    } else {
      console.warn(
        `[AI Advisor] LLM parse failed — raw: ${String(llm.content).slice(0, 120)}`
      );
    }
  }

  // Deterministic fallback (or fill any gaps the LLM left).
  if (!chosen) {
    chosen = heuristicAssetPick(concern);
    provider = 'heuristic';
    model = 'rule-based';
  }
  if (volatilityPct == null || !Number.isFinite(volatilityPct)) {
    volatilityPct = chosen.vol;
  }
  if (hedgeRatioBps == null) {
    hedgeRatioBps = heuristicHedgeRatio(volatilityPct);
  }
  if (!reasoning) {
    reasoning = `Hedging your concern with ${chosen.name} (${chosen.symbol}) on Mantle.`;
  }
  if (!sizingRationale) {
    sizingRationale = `Hedge ratio ${hedgeRatioBps} bps sized inversely to ${volatilityPct}% volatility.`;
  }

  const assetId = ethers.keccak256(ethers.toUtf8Bytes(chosen.symbol));

  // entryPrice is scaled 1e8. Real-time feeds are out of scope for the demo;
  // use a stable per-asset placeholder so the on-chain uint64 is deterministic.
  const PRICE_PLACEHOLDER = { mETH: 3500, USDY: 1, BTC: 65000, GOLD: 2400 };
  const px = PRICE_PLACEHOLDER[chosen.symbol] || 1;
  const entryPrice = Math.max(Math.floor(px * 1e8), 1);

  return {
    recommendation: {
      asset: chosen.symbol,
      assetName: chosen.name,
      assetId,
      direction: 'hedge',
      reasoning,
      model,
      provider,
    },
    riskParams: {
      hedgeRatioBps,
      principalClampBps: 10000, // principal always 100% protected
      volatilityPct,
      sizingRationale,
    },
    entryPrice,
  };
}

module.exports = {
  recommendShield,
  isConfigured,
  getInfo,
  ASSET_UNIVERSE,
  // exposed for tests / reuse
  heuristicHedgeRatio,
  heuristicAssetPick,
};
