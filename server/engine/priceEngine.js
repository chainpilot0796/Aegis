const Market = require('../models/Market');
const PriceHistory = require('../models/PriceHistory');
const coingeckoService = require('../services/coingeckoService');
const oilPriceService = require('../services/oilPriceService');
const parclService = require('../services/parclService');


// In-memory price cache
const prices = {};

async function init() {
  // Load last known prices from DB
  try {
    const markets = await Market.find({});
    for (const m of markets) {
      prices[m.marketId] = {
        price: m.price,
        change24h: m.change24h,
        timestamp: m.lastUpdated,
      };
    }
    console.log(`[PriceEngine] Loaded ${markets.length} cached prices from DB`);
  } catch (err) {
    console.warn('[PriceEngine] Could not load cached prices:', err.message);
  }

  // Immediate fetch
  await fetchCoingecko();
  await fetchOilPrice();
  await fetchParcl();

  // Start pollers
  setInterval(fetchCoingecko, 300 * 1000);   // 5 minutes
  setInterval(fetchOilPrice, 1200 * 1000);   // 20 minutes
  setInterval(fetchParcl, 3600 * 1000);      // 1 hour

  console.log('[PriceEngine] Initialized and polling started');
}

async function fetchCoingecko() {
  try {
    const data = await coingeckoService.fetchPrices();
    if (data) {
      const keys = Object.keys(data);
      console.log(`[PriceEngine] CoinGecko updated: ${keys.join(', ')} (${keys.length} markets)`);
      await updatePrices(data);
    } else {
      console.warn('[PriceEngine] CoinGecko returned no data');
    }
  } catch (err) {
    console.error('[PriceEngine] CoinGecko fetch error:', err.message);
  }
}

async function fetchOilPrice() {
  try {
    const data = await oilPriceService.fetchPrices();
    if (data) {
      const keys = Object.keys(data);
      console.log(`[PriceEngine] OilPrice updated: ${keys.join(', ')}`);
      await updatePrices(data);
    } else {
      console.warn('[PriceEngine] OilPrice returned no data');
    }
  } catch (err) {
    console.error('[PriceEngine] OilPrice fetch error:', err.message);
  }
}

async function fetchParcl() {
  try {
    const data = await parclService.fetchPrices();
    if (data) {
      const keys = Object.keys(data);
      console.log(`[PriceEngine] Parcl updated: ${keys.length} RE markets`);
      await updatePrices(data);
    } else {
      console.warn('[PriceEngine] Parcl returned no data');
    }
  } catch (err) {
    console.error('[PriceEngine] Parcl fetch error:', err.message);
  }
}

async function updatePrices(data) {
  const now = new Date();
  for (const [marketId, info] of Object.entries(data)) {
    if (!info || !info.price) continue;

    prices[marketId] = {
      price: info.price,
      change24h: info.change24h || 0,
      timestamp: now,
    };

    // Upsert Market document
    try {
      await Market.findOneAndUpdate(
        { marketId },
        {
          price: info.price,
          change24h: info.change24h || 0,
          lastUpdated: now,
        },
        { upsert: true }
      );
    } catch (err) {
      // Non-fatal
    }

    // Insert price history
    try {
      await PriceHistory.create({
        marketId,
        price: info.price,
        timestamp: now,
      });
    } catch (err) {
      // Non-fatal
    }
  }
}

function getPrice(marketId) {
  return prices[marketId] || null;
}

function getAllPrices() {
  const result = {};
  for (const [id, data] of Object.entries(prices)) {
    result[id] = { p: data.price, c: data.change24h };
  }
  return result;
}

async function getHistory(marketId, timeframe) {
  const now = new Date();
  let since;

  switch (timeframe) {
    case '1h':
      since = new Date(now - 60 * 60 * 1000);
      break;
    case '6h':
      since = new Date(now - 6 * 60 * 60 * 1000);
      break;
    case '12h':
      since = new Date(now - 12 * 60 * 60 * 1000);
      break;
    case '1d':
      since = new Date(now - 24 * 60 * 60 * 1000);
      break;
    case '1w':
      since = new Date(now - 7 * 24 * 60 * 60 * 1000);
      break;
    case '1m':
      since = new Date(now - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      since = new Date(now - 24 * 60 * 60 * 1000);
  }

  try {
    const history = await PriceHistory.find({
      marketId,
      timestamp: { $gte: since },
    })
      .sort({ timestamp: 1 })
      .lean();

    return history.map((h) => ({ price: h.price, timestamp: h.timestamp }));
  } catch (err) {
    console.error('[PriceEngine] Error fetching history:', err.message);
    return [];
  }
}

module.exports = { init, getPrice, getAllPrices, getHistory };
