/**
 * Bybit Market Data Service
 *
 * Pulls live spot prices from Bybit's public v5 market API (no key required) to
 * set the on-chain entry price for a shield. The AI risk engine maps each hedge
 * asset to its Bybit symbol; mETH tracks ETH, so ETHUSDT is used as its mark.
 * Falls back to a per-asset placeholder if Bybit is unreachable, so the on-chain
 * flow never blocks on an external feed.
 */

const axios = require('axios');

const BASE_URL = process.env.BYBIT_BASE_URL || 'https://api.bybit.com';
const TIMEOUT_MS = Number(process.env.BYBIT_TIMEOUT_MS) || 8000;

// Aegis hedge asset -> Bybit spot symbol. mETH is marked off ETH (it is a
// liquid-staking derivative of ETH); USDY is a ~$1 yield stable; GOLD has no
// Bybit spot pair, so it uses the deterministic placeholder.
const SYMBOL_MAP = {
  METH: 'ETHUSDT',
  ETH: 'ETHUSDT',
  BTC: 'BTCUSDT',
  MNT: 'MNTUSDT',
};

const PLACEHOLDER = { METH: 3500, ETH: 3500, USDY: 1, BTC: 65000, GOLD: 2400 };

/**
 * Live spot price (USD) for an Aegis asset symbol from Bybit, or a placeholder.
 * @param {string} asset  e.g. 'mETH', 'BTC', 'USDY', 'GOLD'
 * @returns {Promise<{ price: number, source: 'bybit' | 'placeholder', symbol: string|null }>}
 */
async function getPrice(asset) {
  const sym = String(asset || '').toUpperCase();
  if (sym === 'USDY') return { price: 1, source: 'placeholder', symbol: null };
  const bybitSymbol = SYMBOL_MAP[sym];
  if (bybitSymbol) {
    try {
      const res = await axios.get(`${BASE_URL}/v5/market/tickers`, {
        params: { category: 'spot', symbol: bybitSymbol },
        timeout: TIMEOUT_MS,
      });
      const last = res.data?.result?.list?.[0]?.lastPrice;
      const price = Number(last);
      if (Number.isFinite(price) && price > 0) {
        return { price, source: 'bybit', symbol: bybitSymbol };
      }
    } catch (err) {
      console.warn(`[Bybit] ${bybitSymbol} fetch failed: ${err.message || err}`);
    }
  }
  return { price: PLACEHOLDER[sym] || 1, source: 'placeholder', symbol: bybitSymbol || null };
}

function isConfigured() {
  return true; // public endpoint, no key required
}

function getInfo() {
  return { configured: true, baseUrl: BASE_URL, symbols: Object.values(SYMBOL_MAP) };
}

module.exports = { getPrice, isConfigured, getInfo, SYMBOL_MAP };
