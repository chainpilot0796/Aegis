const axios = require('axios');
const { MARKETS } = require('../config/markets');

const PARCL_API_BASE = 'https://express-prod.parcl-api.com/v1/market';

// Build market map dynamically from config — all markets with source === 'parcl'
const MARKET_MAP = {};
for (const m of MARKETS) {
  if (m.source === 'parcl' && m.sourceId) {
    MARKET_MAP[m.sourceId] = m.id;
  }
}

async function fetchPrices() {
  try {
    const marketCodes = Object.keys(MARKET_MAP);
    const results = {};

    // Fetch in parallel
    const promises = marketCodes.map(async (marketCode) => {
      try {
        const { data } = await axios.get(
          `${PARCL_API_BASE}/${marketCode}/price-feed`,
          { params: { window: '1y' } }
        );

        const key = MARKET_MAP[marketCode];

        // Response format: { priceFeed: [{ date, price }, ...] } sorted newest first
        if (data && data.priceFeed && Array.isArray(data.priceFeed) && data.priceFeed.length > 0) {
          const latest = data.priceFeed[0];
          const prev = data.priceFeed.length > 1 ? data.priceFeed[1] : null;
          const price = latest.price;
          const change24h = prev
            ? ((price - prev.price) / prev.price) * 100
            : 0;

          if (price) {
            results[key] = { price, change24h: Math.round(change24h * 100) / 100 };
          }
        }
      } catch (err) {
        console.error(`[Parcl] Error fetching ${marketCode}:`, err.message);
      }
    });

    await Promise.all(promises);

    console.log(`[Parcl] Fetched ${Object.keys(results).length}/${marketCodes.length} markets`);
    return Object.keys(results).length > 0 ? results : null;
  } catch (error) {
    console.error('[Parcl] Error fetching prices:', error.message);
    return null;
  }
}

module.exports = { fetchPrices };
