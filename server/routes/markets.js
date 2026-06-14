const express = require('express');
const router = express.Router();
const axios = require('axios');
const { MARKETS } = require('../config/markets');
const priceEngine = require('../engine/priceEngine');

// Cache Parcl 5y data in memory (fetched once, reused)
const parclChartCache = {};

// GET / — all markets with live prices
router.get('/', (req, res) => {
  const marketsWithPrices = MARKETS.map((market) => {
    const priceData = priceEngine.getPrice(market.id);
    return {
      ...market,
      price: priceData ? priceData.price : null,
      change24h: priceData ? priceData.change24h : null,
      lastUpdated: priceData ? priceData.timestamp : null,
    };
  });
  res.json({ markets: marketsWithPrices });
});

// GET /category-growth — real category index series (base 100) for chart
router.get('/category-growth', async (req, res) => {
  try {
    const timeframe = req.query.timeframe || '1d';
    const colors = {
      commodities: '#F59E0B',
      crypto: '#3B82F6',
      forex: '#00FF94',
      real_estate: '#EF4444',
    };
    const labels = {
      commodities: 'Commodities',
      crypto: 'Crypto',
      forex: 'Forex',
      real_estate: 'Real Estate',
    };

    // Proxy markets per category (we use price history from DB or Parcl)
    const proxies = {
      commodities: 'gold',
      crypto: 'bitcoin',
      forex: 'usd_inr',
      real_estate: 're_nyc',
    };

    const series = [];

    for (const [categoryId, marketId] of Object.entries(proxies)) {
      const market = MARKETS.find((m) => m.id === marketId);
      if (!market) continue;

      let rawHistory = [];

      if (market.source === 'parcl' && market.sourceId) {
        const cached = parclChartCache[marketId];
        if (cached && Date.now() - cached.fetchedAt < 24 * 60 * 60 * 1000) {
          rawHistory = cached.data.map((e) => ({
            price: e.price,
            timestamp: new Date(e.date || e.timestamp).getTime(),
          }));
        } else {
          try {
            const { data } = await axios.get(
              `https://express-prod.parcl-api.com/v1/market/${market.sourceId}/price-feed`,
              { params: { window: '5y' } }
            );
            if (data?.priceFeed?.length) {
              const history = data.priceFeed.reverse().map((entry) => ({
                date: entry.date,
                price: entry.price,
              }));
              parclChartCache[marketId] = { data: history, fetchedAt: Date.now() };
              rawHistory = history.map((e) => ({
                price: e.price,
                timestamp: new Date(e.date).getTime(),
              }));
            }
          } catch (err) {
            console.error(`[Markets] Parcl category-growth error for ${marketId}:`, err.message);
          }
        }
      } else {
        const hist = await priceEngine.getHistory(marketId, timeframe);
        rawHistory = hist.map((h) => ({
          price: h.price,
          timestamp: h.timestamp instanceof Date ? h.timestamp.getTime() : new Date(h.timestamp).getTime(),
        }));
      }

      if (rawHistory.length < 2) continue;

      const now = Date.now();
      const since = timeframe === '6h' ? now - 6 * 3600 * 1000
        : timeframe === '12h' ? now - 12 * 3600 * 1000
        : timeframe === '1h' ? now - 3600 * 1000
        : timeframe === '1w' ? now - 7 * 24 * 3600 * 1000
        : timeframe === '1m' ? now - 30 * 24 * 3600 * 1000
        : now - 24 * 3600 * 1000;

      const filtered = rawHistory
        .filter((h) => h.timestamp >= since)
        .sort((a, b) => a.timestamp - b.timestamp);

      if (filtered.length < 2) continue;

      const basePrice = filtered[0].price;
      if (!basePrice || basePrice <= 0) continue;

      const data = filtered.map((h) => ({
        time: Math.floor(h.timestamp / 1000),
        value: (h.price / basePrice) * 100,
      }));

      if (data.length < 2) continue;

      series.push({
        id: categoryId,
        data,
        value: data[data.length - 1].value,
        color: colors[categoryId],
        label: labels[categoryId],
      });
    }

    res.json({ series, timeframe });
  } catch (error) {
    console.error('[Markets] category-growth error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /:id — single market with price
router.get('/:id', (req, res) => {
  const market = MARKETS.find((m) => m.id === req.params.id);
  if (!market) {
    return res.status(404).json({ error: 'Market not found' });
  }
  const priceData = priceEngine.getPrice(market.id);
  res.json({
    ...market,
    price: priceData ? priceData.price : null,
    change24h: priceData ? priceData.change24h : null,
    lastUpdated: priceData ? priceData.timestamp : null,
  });
});

// GET /:id/chart — price history
router.get('/:id/chart', async (req, res) => {
  try {
    const marketId = req.params.id;
    const market = MARKETS.find((m) => m.id === marketId);

    // For Parcl real estate markets, fetch directly from Parcl API (cached)
    if (market && market.source === 'parcl' && market.sourceId) {
      // Check cache (refresh every 24h)
      const cached = parclChartCache[marketId];
      if (cached && Date.now() - cached.fetchedAt < 24 * 60 * 60 * 1000) {
        return res.json({ marketId, source: 'parcl', history: cached.data });
      }

      try {
        const { data } = await axios.get(
          `https://express-prod.parcl-api.com/v1/market/${market.sourceId}/price-feed`,
          { params: { window: '5y' } }
        );

        if (data && data.priceFeed && Array.isArray(data.priceFeed)) {
          // Parcl returns newest first, reverse for chronological order
          const history = data.priceFeed.reverse().map((entry) => ({
            date: entry.date,
            price: entry.price,
          }));

          parclChartCache[marketId] = { data: history, fetchedAt: Date.now() };
          return res.json({ marketId, source: 'parcl', history });
        }
      } catch (err) {
        console.error(`[Markets] Parcl chart fetch error for ${marketId}:`, err.message);
      }
    }

    // For other markets, use local price history from DB
    const { timeframe } = req.query;
    const history = await priceEngine.getHistory(marketId, timeframe || '1d');
    res.json({ marketId, timeframe: timeframe || '1d', history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
