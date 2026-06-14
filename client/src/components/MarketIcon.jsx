import {
  Coins,
  CircleDollarSign,
  Flame,
  Fuel,
  Landmark,
  Building2,
  Banknote,
} from 'lucide-react';

const ICON_MAP = {
  gold: Coins,
  silver: CircleDollarSign,
  wti_oil: Fuel,
  natural_gas: Flame,
  bitcoin: Coins,
  ethereum: Landmark,
  solana: CircleDollarSign,
  usd_inr: Banknote,
  eur_usd: Banknote,
  gbp_usd: Banknote,
  re_nyc: Building2,
  re_brooklyn: Building2,
  re_miami: Building2,
  re_miami_beach: Building2,
  re_la: Building2,
  re_sf: Building2,
  re_sd: Building2,
  re_austin: Building2,
  re_denver: Building2,
  re_atlanta: Building2,
  re_chicago: Building2,
  re_boston: Building2,
  re_dc: Landmark,
  re_vegas: Building2,
  re_pittsburgh: Building2,
};

const CATEGORY_FALLBACK = {
  commodities: Coins,
  crypto: Coins,
  forex: Banknote,
  real_estate: Building2,
};

export default function MarketIcon({ market, className = 'w-5 h-5', ...props }) {
  const id = market?.id ?? market;
  const Icon = ICON_MAP[id] ?? (market?.category && CATEGORY_FALLBACK[market.category]) ?? Coins;
  return <Icon className={className} strokeWidth={1.8} {...props} />;
}
