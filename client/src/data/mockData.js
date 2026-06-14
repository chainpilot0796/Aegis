import { MARKETS as BASE_MARKETS } from "./markets";

// Landing page: extend first 12 markets with mock price/chart data for ASCII terminal
const MOCK_PRICES = [
  { base: 2650, vol: 0.008, drift: 0.0001 },   // gold
  { base: 32, vol: 0.012, drift: 0.0002 },    // silver
  { base: 78, vol: 0.02, drift: -0.0003 },    // wti_oil
  { base: 2.8, vol: 0.03, drift: 0.0002 },   // natural_gas
  { base: 98500, vol: 0.015, drift: 0.0005 }, // bitcoin
  { base: 3650, vol: 0.018, drift: 0.0003 },  // ethereum
  { base: 245, vol: 0.025, drift: 0.0004 },   // solana
  { base: 83.5, vol: 0.005, drift: 0.00005 }, // usd_inr
  { base: 1.08, vol: 0.004, drift: 0 },       // eur_usd
  { base: 1.27, vol: 0.005, drift: 0 },       // gbp_usd
  { base: 1250, vol: 0.01, drift: 0.0002 },   // re_nyc
  { base: 890, vol: 0.012, drift: 0.00015 },  // re_brooklyn
];

export const MARKETS = BASE_MARKETS.slice(0, 12).map((m, i) => {
  const mock = MOCK_PRICES[i] || { base: 1000, vol: 0.01, drift: 0 };
  const change24hPct = (Math.random() - 0.5) * 0.08;
  return {
    ...m,
    basePrice: mock.base,
    currentPrice: mock.base * (1 + change24hPct),
    volatility: mock.vol,
    drift: mock.drift,
    volume24h: 2.1e6 + Math.random() * 4e6,
    openInterest: 1.5e6 + Math.random() * 3e6,
    fundingRate: 0.0001 * (Math.random() - 0.5),
    change24hPct,
  };
});
