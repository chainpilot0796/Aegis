const axios = require('axios');

// Free public API works without a key for /simple/price (rate-limited ~30 calls/min).
// If COINGECKO_API_KEY is set, switch to the pro endpoint for higher limits.
const FREE_API = 'https://api.coingecko.com/api/v3';
const PRO_API  = 'https://pro-api.coingecko.com/api/v3';

async function fetchPrices() {
  const apiKey = process.env.COINGECKO_API_KEY;
  const usePro = Boolean(apiKey && apiKey.length > 0 && apiKey !== 'your_coingecko_api_key');
  const baseUrl = usePro ? PRO_API : FREE_API;
  const ids = 'pax-gold,kinesis-silver,bitcoin,ethereum,solana';
  const vsCurrencies = 'usd,inr,eur,gbp';

  try {
    const { data } = await axios.get(`${baseUrl}/simple/price`, {
      params: {
        ids,
        vs_currencies: vsCurrencies,
        include_24hr_change: true,
      },
      headers: usePro ? { 'x-cg-pro-api-key': apiKey } : {},
      timeout: 12000,
    });

    const result = {};

    if (data['pax-gold']) {
      result.gold = {
        price: data['pax-gold'].usd,
        change24h: data['pax-gold'].usd_24h_change || 0,
      };
    }
    if (data['kinesis-silver']) {
      result.silver = {
        price: data['kinesis-silver'].usd,
        change24h: data['kinesis-silver'].usd_24h_change || 0,
      };
    }
    if (data.bitcoin) {
      result.bitcoin = {
        price: data.bitcoin.usd,
        change24h: data.bitcoin.usd_24h_change || 0,
      };
    }
    if (data.ethereum) {
      result.ethereum = {
        price: data.ethereum.usd,
        change24h: data.ethereum.usd_24h_change || 0,
      };
    }
    if (data.solana) {
      result.solana = {
        price: data.solana.usd,
        change24h: data.solana.usd_24h_change || 0,
      };
    }

    // Derive forex rates from cross-currency bitcoin pricing
    if (data.bitcoin && data.bitcoin.usd && data.bitcoin.inr) {
      const btcUsd = data.bitcoin.usd;
      const btcInr = data.bitcoin.inr;
      const btcEur = data.bitcoin.eur;
      const btcGbp = data.bitcoin.gbp;

      result.usd_inr = { price: btcInr / btcUsd, change24h: 0 };
      if (btcEur) result.eur_usd = { price: btcUsd / btcEur, change24h: 0 };
      if (btcGbp) result.gbp_usd = { price: btcUsd / btcGbp, change24h: 0 };
    }

    return result;
  } catch (error) {
    console.error(
      `[CoinGecko] Error fetching prices (${usePro ? 'pro' : 'free'} endpoint):`,
      error.response?.status || '',
      error.message
    );
    return null;
  }
}

module.exports = { fetchPrices };
