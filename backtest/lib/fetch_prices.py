"""
Multi-source historical price fetcher with local caching.

Sources:
  - CoinGecko Pro: BTC, ETH, SOL, XRP
  - Yahoo Finance (yfinance): Gold (GC=F), Silver (SI=F) — real futures prices
  - Parcl Labs: Real estate indexes (NYC, LA, Miami, SF, etc.)
"""

import json
import os
import time
from datetime import datetime, timedelta
from pathlib import Path

import requests
import yfinance as yf

CACHE_DIR = Path(__file__).resolve().parent.parent / "cache"
CACHE_DIR.mkdir(exist_ok=True)

# ── CoinGecko assets ──────────────────────────────────────────────────────────
COINGECKO_ASSETS = {
    "bitcoin": "bitcoin",
    "ethereum": "ethereum",
    "solana": "solana",
    "xrp": "ripple",
}

# ── Yahoo Finance metals (real commodity futures) ────────────────────────────
YAHOO_METALS = {
    "gold": "GC=F",    # COMEX Gold Futures (USD/troy oz)
    "silver": "SI=F",  # COMEX Silver Futures (USD/troy oz)
}

# ── Parcl Labs tickers (all available from app.parcl.co) ─────────────────────
PARCL_TICKERS = {
    # Sales indexes
    "re_nyc": "NY-NYC",
    "re_brooklyn": "NY-BRK",
    "re_la": "CA-LA",
    "re_sf": "CA-SF",
    "re_sd": "CA-SD",
    "re_miami": "FL-MIA",
    "re_miami_beach": "FL-MB",
    "re_austin": "TX-AUS",
    "re_denver": "CO-DEN",
    "re_atlanta": "GA-ATL",
    "re_chicago": "IL-CHI",
    "re_boston": "MA-BOS",
    "re_dc": "DC-WAS",
    "re_pittsburgh": "PA-PIT",
    "re_charlotte": "NC-CHA",
    "re_tampa": "FL-TPA",
    "re_las_vegas": "NV-LV",
    "re_nashville": "TN-NASH",
    "re_us": "NA-US",
}

ASSET_LABELS = {
    "gold": "Gold (XAU)",
    "silver": "Silver (XAG)",
    "bitcoin": "Bitcoin",
    "ethereum": "Ethereum",
    "solana": "Solana",
    "xrp": "XRP",
}
for k in PARCL_TICKERS:
    ASSET_LABELS[k] = k.replace("re_", "RE ").title()


def _load_cache(key: str) -> list[dict] | None:
    f = CACHE_DIR / f"{key}.json"
    if f.exists() and (time.time() - f.stat().st_mtime) / 3600 < 48:
        with open(f) as fh:
            return json.load(fh)
    return None


def _save_cache(key: str, data: list[dict]):
    with open(CACHE_DIR / f"{key}.json", "w") as fh:
        json.dump(data, fh)


# ── Yahoo Finance (Gold & Silver futures) ─────────────────────────────────────
def fetch_yahoo_metal(metal: str, ticker: str, days: int = 730) -> list[dict]:
    """Fetch real Gold/Silver futures prices from Yahoo Finance via yfinance."""
    cache_key = f"yahoo_{metal}_{days}d"
    cached = _load_cache(cache_key)
    label = ASSET_LABELS.get(metal, metal)
    if cached:
        print(f"  {label:>15}: loaded {len(cached)} points from cache")
        return cached

    print(f"  {label:>15}: fetching {days}d from Yahoo Finance ({ticker})...", end=" ", flush=True)

    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        df = yf.download(
            ticker,
            start=start_date.strftime("%Y-%m-%d"),
            end=end_date.strftime("%Y-%m-%d"),
            progress=False,
        )

        if df.empty:
            print("NO DATA")
            return []

        prices = []
        seen = set()
        for idx, row in df.iterrows():
            ds = idx.strftime("%Y-%m-%d") if hasattr(idx, "strftime") else str(idx)[:10]
            # yfinance returns multi-level columns when single ticker; handle both
            close = row["Close"]
            if hasattr(close, "item"):
                close = close.item()
            close = float(close)
            if ds not in seen and close > 0:
                seen.add(ds)
                prices.append({"timestamp": ds, "price": round(close, 2)})

        prices.sort(key=lambda x: x["timestamp"])
        if prices:
            _save_cache(cache_key, prices)
        print(f"{len(prices)} data points")
        return prices

    except Exception as e:
        print(f"FAILED: {e}")
        return []


# ── CoinGecko Pro ────────────────────────────────────────────────────────────
def fetch_coingecko_prices(coin_id: str, label: str, days: int = 730) -> list[dict]:
    """Fetch from CoinGecko Pro API."""
    cache_key = f"cg_pro_{coin_id}_{days}d"
    cached = _load_cache(cache_key)
    if cached:
        print(f"  {label:>15}: loaded {len(cached)} points from cache")
        return cached

    api_key = os.getenv("COINGECKO_API_KEY", "")
    is_pro = os.getenv("COINGECKO_IS_PRO", "false").lower() == "true"

    if is_pro and api_key:
        base = "https://pro-api.coingecko.com/api/v3"
        headers = {"x-cg-pro-api-key": api_key}
    else:
        base = "https://api.coingecko.com/api/v3"
        headers = {"x-cg-demo-api-key": api_key} if api_key else {}

    print(f"  {label:>15}: fetching {days}d from CoinGecko Pro...", end=" ", flush=True)

    # Try max days first, fall back
    for try_days in [days, 365]:
        try:
            resp = requests.get(
                f"{base}/coins/{coin_id}/market_chart",
                params={"vs_currency": "usd", "days": try_days},
                headers=headers,
                timeout=30,
            )
            if resp.status_code == 200:
                break
            if try_days == days and try_days > 365:
                print(f"(falling back to 365d)...", end=" ", flush=True)
                time.sleep(2)
        except Exception:
            pass
    else:
        resp.raise_for_status()

    raw = resp.json()
    prices = []
    seen = set()
    for ts_ms, price in raw.get("prices", []):
        dt = datetime.utcfromtimestamp(ts_ms / 1000)
        ds = dt.strftime("%Y-%m-%d")
        if ds not in seen:
            seen.add(ds)
            prices.append({"timestamp": ds, "price": price})
    prices.sort(key=lambda x: x["timestamp"])

    if prices:
        _save_cache(cache_key, prices)
    print(f"{len(prices)} data points")
    return prices


# ── Parcl Labs (Real Estate) ────────────────────────────────────────────────
def fetch_parcl_prices(label: str, ticker: str) -> list[dict]:
    """Fetch 5-year price feed from Parcl Labs."""
    cache_key = f"parcl_{ticker}_5y"
    cached = _load_cache(cache_key)
    if cached:
        print(f"  {label:>15}: loaded {len(cached)} points from cache")
        return cached

    url = f"https://express-prod.parcl-api.com/v1/market/{ticker}/price-feed"
    print(f"  {label:>15}: fetching 5y from Parcl Labs ({ticker})...", end=" ", flush=True)

    try:
        resp = requests.get(url, params={"window": "5y"}, timeout=30)
        resp.raise_for_status()
        raw = resp.json()
    except Exception as e:
        print(f"FAILED: {e}")
        return []

    # Parcl returns {"priceFeed": [{"date": "...", "price": ...}, ...]}
    data = (
        raw.get("priceFeed")
        or raw.get("data")
        or raw.get("prices")
        or (raw if isinstance(raw, list) else [])
    )
    if not isinstance(data, list) or not data:
        print(f"unexpected format: {list(raw.keys()) if isinstance(raw, dict) else type(raw)}")
        return []

    prices = []
    seen = set()
    for item in data:
        ts = item.get("date") or item.get("timestamp") or item.get("t")
        price = item.get("price") or item.get("value") or item.get("p")
        if ts is None or price is None:
            continue

        # Normalize timestamp (ISO string or unix)
        if isinstance(ts, (int, float)):
            if ts > 1e12:
                ts = ts / 1000
            ds = datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d")
        else:
            ds = str(ts)[:10]

        if ds not in seen and price > 0:
            seen.add(ds)
            prices.append({"timestamp": ds, "price": float(price)})

    prices.sort(key=lambda x: x["timestamp"])
    if prices:
        _save_cache(cache_key, prices)
    print(f"{len(prices)} data points")
    return prices


# ── Master fetch ─────────────────────────────────────────────────────────────
def fetch_all_assets(days: int = 730) -> dict[str, list[dict]]:
    """Fetch historical prices for all configured assets from all sources."""
    data = {}

    print("=" * 60)
    print("  FETCHING HISTORICAL DATA")
    print("=" * 60)

    # 1. Metals from Yahoo Finance (real COMEX futures prices)
    print("\n-- Metals (Yahoo Finance — COMEX Futures) --")
    for metal, ticker in YAHOO_METALS.items():
        data[metal] = fetch_yahoo_metal(metal, ticker, days=days)

    # 2. Crypto from CoinGecko Pro
    print("\n-- Crypto (CoinGecko Pro) --")
    for label, coin_id in COINGECKO_ASSETS.items():
        data[label] = fetch_coingecko_prices(coin_id, ASSET_LABELS[label], days=days)
        time.sleep(2)

    # 3. Real Estate from Parcl Labs
    print("\n-- Real Estate (Parcl Labs) --")
    for label, ticker in PARCL_TICKERS.items():
        data[label] = fetch_parcl_prices(ASSET_LABELS.get(label, label), ticker)
        time.sleep(0.5)

    total = sum(len(v) for v in data.values())
    assets_with_data = sum(1 for v in data.values() if v)
    print(f"\n  TOTAL: {total:,} data points across {assets_with_data} assets\n")
    return data
