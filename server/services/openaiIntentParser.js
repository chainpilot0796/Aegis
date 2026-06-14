/**
 * OpenAI NLP Intent Parser for Trade Commands
 * Converts natural language (e.g. "Long $300 ETH 3x — Open long") to our required format.
 * Used by Elsa agent via WhatsApp webhook for flexible trade intent parsing.
 */

const OpenAI = require('openai').default;

const VALID_ASSETS = [
  'ethereum', 'bitcoin', 'solana', 'gold', 'silver', 'wti_oil', 'natural_gas',
  'usd_inr', 'eur_usd', 'gbp_usd',
  're_nyc', 're_miami', 're_la', 're_sf', 're_brooklyn', 're_miami_beach',
  're_sd', 're_austin', 're_denver', 're_atlanta', 're_chicago', 're_boston',
  're_dc', 're_vegas', 're_pittsburgh'
];

const ASSET_MAP = {
  eth: 'ethereum', ethereum: 'ethereum',
  btc: 'bitcoin', bitcoin: 'bitcoin',
  sol: 'solana', solana: 'solana',
  gold: 'gold', silver: 'silver',
  oil: 'wti_oil', wti: 'wti_oil',
  gas: 'natural_gas', 'natural gas': 'natural_gas',
};

function isConfigured() {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Parse user message with OpenAI into structured trade intent.
 * @param {string} message - Raw user message (e.g. "Long $300 ETH 3x — Open long")
 * @returns {Promise<{ intent: string, asset?: string, margin?: number, leverage?: number } | null>}
 */
async function parseTradeIntent(message) {
  if (!isConfigured() || !message?.trim()) return null;

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const systemPrompt = `You are a trade intent parser for a hedging/trading bot. Extract trading intents from user messages.

Return ONLY valid JSON, no other text. Use this exact structure:
- For opening LONG: {"intent":"open_long","asset":"<market_id>","margin":<number>,"leverage":<number>}
- For opening SHORT: {"intent":"open_short","asset":"<market_id>","margin":<number>,"leverage":<number>}
- If not a trade: {"intent":"unknown"}

Valid assets (market_id): ${VALID_ASSETS.join(', ')}
Common aliases: eth/ethereum, btc/bitcoin, sol/solana, gold, silver, oil/wti_oil.

Rules:
- margin: USD amount (number), default 100 if unclear, max 10000
- leverage: 1-50, default 2 if unclear
- Extract $300 as margin 300, "3x" as leverage 3
- "Open long", "go long", "buy", "long" = open_long
- "Open short", "go short", "short", "sell short" = open_short`;

    const userPrompt = `Parse this message into a trade intent JSON: "${message.trim()}"`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 150,
    });

    const content = completion.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    // Extract JSON (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    const parsed = JSON.parse(jsonStr);

    if (parsed.intent === 'unknown') return parsed;

    if (parsed.intent === 'open_long' || parsed.intent === 'open_short') {
      const asset = normalizeAsset(parsed.asset);
      const margin = Math.min(Math.max(Number(parsed.margin) || 100, 1), 10000);
      const leverage = Math.min(Math.max(Number(parsed.leverage) || 2, 1), 50);
      return {
        intent: parsed.intent,
        asset: asset || 'ethereum',
        margin,
        leverage,
      };
    }

    return parsed;
  } catch (err) {
    console.warn('[OpenAIIntentParser] Parse failed:', err.message);
    return null;
  }
}

function normalizeAsset(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const lower = raw.toLowerCase().trim();
  if (ASSET_MAP[lower]) return ASSET_MAP[lower];
  if (VALID_ASSETS.includes(lower)) return lower;
  return null;
}

module.exports = {
  isConfigured,
  parseTradeIntent,
  VALID_ASSETS,
};
