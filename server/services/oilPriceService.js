const axios = require('axios');

const API_BASE = 'https://api.oilpriceapi.com/v1/prices/latest';

async function fetchPrices() {
  try {
    const apiKey = process.env.OILPRICE_API_KEY;

    const [wtiRes, gasRes] = await Promise.all([
      axios.get(API_BASE, {
        params: { by_code: 'WTI_USD' },
        headers: { Authorization: `Token ${apiKey}` },
      }),
      axios.get(API_BASE, {
        params: { by_code: 'NATURAL_GAS_USD' },
        headers: { Authorization: `Token ${apiKey}` },
      }),
    ]);

    const result = {};

    if (wtiRes.data && wtiRes.data.data) {
      result.wti_oil = {
        price: wtiRes.data.data.price,
        change24h: wtiRes.data.data.change_percent || 0,
      };
    }

    if (gasRes.data && gasRes.data.data) {
      result.natural_gas = {
        price: gasRes.data.data.price,
        change24h: gasRes.data.data.change_percent || 0,
      };
    }

    return result;
  } catch (error) {
    console.error('[OilPrice] Error fetching prices:', error.message);
    return null;
  }
}

module.exports = { fetchPrices };
