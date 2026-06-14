export const MARKETS = [
  // ─── Commodities ───
  { id: 'gold', name: 'Gold', category: 'commodities', emoji: '🥇', description: 'Gold price via PAX Gold token', shieldEligible: true, perpEligible: true },
  { id: 'silver', name: 'Silver', category: 'commodities', emoji: '🥈', description: 'Silver price via Silver token', shieldEligible: true, perpEligible: true },
  { id: 'wti_oil', name: 'WTI Crude Oil', category: 'commodities', emoji: '🛢️', description: 'West Texas Intermediate crude oil', shieldEligible: true, perpEligible: true },
  { id: 'natural_gas', name: 'Natural Gas', category: 'commodities', emoji: '🔥', description: 'Natural gas price', shieldEligible: true, perpEligible: true },

  // ─── Crypto ───
  { id: 'bitcoin', name: 'Bitcoin', category: 'crypto', emoji: '₿', description: 'Bitcoin cryptocurrency', shieldEligible: true, perpEligible: true },
  { id: 'ethereum', name: 'Ethereum', category: 'crypto', emoji: 'Ξ', description: 'Ethereum cryptocurrency', shieldEligible: true, perpEligible: true },
  { id: 'solana', name: 'Solana', category: 'crypto', emoji: '◎', description: 'Solana cryptocurrency', shieldEligible: true, perpEligible: true },

  // ─── Forex ───
  { id: 'usd_inr', name: 'USD/INR', category: 'forex', emoji: '🇮🇳', description: 'US Dollar to Indian Rupee exchange rate', quoteCurrency: 'INR', shieldEligible: true, perpEligible: true },
  { id: 'eur_usd', name: 'EUR/USD', category: 'forex', emoji: '🇪🇺', description: 'Euro to US Dollar exchange rate', quoteCurrency: 'USD', shieldEligible: true, perpEligible: true },
  { id: 'gbp_usd', name: 'GBP/USD', category: 'forex', emoji: '🇬🇧', description: 'British Pound to US Dollar exchange rate', quoteCurrency: 'USD', shieldEligible: true, perpEligible: true },

  // ─── Real Estate (all via Parcl Labs) — price-per-sqft indexes ───
  { id: 're_nyc', name: 'NYC Housing Index', category: 'real_estate', emoji: '🏙️', description: 'New York City price per sqft index', shieldEligible: true, perpEligible: true },
  { id: 're_brooklyn', name: 'Brooklyn RE Index', category: 'real_estate', emoji: '🌉', description: 'Brooklyn price per sqft index', shieldEligible: true, perpEligible: true },
  { id: 're_miami', name: 'Miami RE Index', category: 'real_estate', emoji: '🌴', description: 'Miami price per sqft index', shieldEligible: true, perpEligible: true },
  { id: 're_miami_beach', name: 'Miami Beach RE Index', category: 'real_estate', emoji: '🏖️', description: 'Miami Beach price per sqft index', shieldEligible: true, perpEligible: true },
  { id: 're_la', name: 'LA RE Index', category: 'real_estate', emoji: '🌇', description: 'Los Angeles price per sqft index', shieldEligible: true, perpEligible: true },
  { id: 're_sf', name: 'SF RE Index', category: 'real_estate', emoji: '🌁', description: 'San Francisco price per sqft index', shieldEligible: true, perpEligible: true },
  { id: 're_sd', name: 'San Diego RE Index', category: 'real_estate', emoji: '🏄', description: 'San Diego price per sqft index', shieldEligible: true, perpEligible: true },
  { id: 're_austin', name: 'Austin RE Index', category: 'real_estate', emoji: '🤠', description: 'Austin TX price per sqft index', shieldEligible: true, perpEligible: true },
  { id: 're_denver', name: 'Denver RE Index', category: 'real_estate', emoji: '🏔️', description: 'Denver CO price per sqft index', shieldEligible: true, perpEligible: true },
  { id: 're_atlanta', name: 'Atlanta RE Index', category: 'real_estate', emoji: '🍑', description: 'Atlanta GA price per sqft index', shieldEligible: true, perpEligible: true },
  { id: 're_chicago', name: 'Chicago RE Index', category: 'real_estate', emoji: '🌬️', description: 'Chicago IL price per sqft index', shieldEligible: true, perpEligible: true },
  { id: 're_boston', name: 'Boston RE Index', category: 'real_estate', emoji: '🏛️', description: 'Boston MA price per sqft index', shieldEligible: true, perpEligible: true },
  { id: 're_dc', name: 'DC RE Index', category: 'real_estate', emoji: '🏛️', description: 'Washington DC price per sqft index', shieldEligible: true, perpEligible: true },
  { id: 're_vegas', name: 'Las Vegas RE Index', category: 'real_estate', emoji: '🎰', description: 'Las Vegas NV price per sqft index', shieldEligible: true, perpEligible: true },
  { id: 're_pittsburgh', name: 'Pittsburgh RE Index', category: 'real_estate', emoji: '🏗️', description: 'Pittsburgh PA price per sqft index', shieldEligible: true, perpEligible: true },
];

export const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'commodities', label: 'Commodities' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'forex', label: 'Forex' },
  { id: 'real_estate', label: 'Real Estate' },
];
