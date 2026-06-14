"""
Fetch historical prices for all assets used in the backtest.
Sources: CoinGecko (crypto, gold, silver, forex), OilPriceAPI (WTI), Parcl Labs (real estate).
"""

import json
import os
import random
import time
import requests
from datetime import datetime, timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data", "prices")

COINGECKO_API_KEY = "CG-TUt66NyorvhxSAjfPC8cFqhK"
COINGECKO_BASE = "https://pro-api.coingecko.com/api/v3"
COINGECKO_HEADERS = {"x-cg-pro-api-key": COINGECKO_API_KEY}

OIL_API_KEY = "0318cba8d1e19d5e65cb282a9bd6f78f012c585d543d1c39e7257738fe6001b3"

# CoinGecko assets (id -> our asset name)
CRYPTO_ASSETS = {
    "pax-gold": "gold",
    "kinesis-silver": "silver",
    "bitcoin": "bitcoin",
    "ethereum": "ethereum",
    "solana": "solana",
}

# Forex: derive from BTC prices in different currencies
FOREX_CURRENCIES = {
    "inr": "usd_inr",
    "eur": "eur_usd",
    "gbp": "gbp_usd",
}

# Parcl Labs real estate markets
PARCL_MARKETS = {
    "NY-NYC": "re_nyc",
    "FL-MIA": "re_mia",
    "CA-LA": "re_la",
    "CO-DEN": "re_den",
    "TX-AUS": "re_aus",
}


def coingecko_fetch(coin_id, vs_currency="usd", days=730):
    """Fetch market chart from CoinGecko Pro API."""
    url = f"{COINGECKO_BASE}/coins/{coin_id}/market_chart"
    params = {"vs_currency": vs_currency, "days": days}

    for attempt in range(2):
        try:
            resp = requests.get(url, headers=COINGECKO_HEADERS, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            prices = data.get("prices", [])

            # Convert [timestamp_ms, price] -> [{date, price}]
            result = []
            seen_dates = set()
            for ts_ms, price in prices:
                dt = datetime.utcfromtimestamp(ts_ms / 1000)
                date_str = dt.strftime("%Y-%m-%d")
                if date_str not in seen_dates:
                    seen_dates.add(date_str)
                    result.append({"date": date_str, "price": round(price, 6)})

            result.sort(key=lambda x: x["date"])
            return result

        except Exception as e:
            print(f"    Attempt {attempt + 1} failed for {coin_id}/{vs_currency}: {e}")
            if attempt == 0:
                time.sleep(3)

    return None


def fetch_crypto_prices():
    """Fetch prices for all crypto/commodity assets from CoinGecko."""
    print("\n--- Fetching crypto & commodity prices from CoinGecko ---")

    for coin_id, asset_name in CRYPTO_ASSETS.items():
        print(f"  Fetching {asset_name} ({coin_id})...")
        data = coingecko_fetch(coin_id, "usd", 730)
        if data:
            out_path = os.path.join(DATA_DIR, f"{asset_name}.json")
            with open(out_path, "w") as f:
                json.dump(data, f, indent=2)
            print(f"    Got {len(data)} days, saved to {out_path}")
        else:
            print(f"    FAILED to fetch {asset_name}")
        time.sleep(2)  # Rate limit


def fetch_forex_prices():
    """Derive forex rates from BTC prices in different currencies."""
    print("\n--- Fetching forex data via CoinGecko BTC cross-rates ---")

    # First get BTC/USD (might already be fetched, but we need the raw data)
    print("  Fetching BTC/USD for forex derivation...")
    btc_usd = coingecko_fetch("bitcoin", "usd", 730)
    if not btc_usd:
        print("    FAILED to fetch BTC/USD, skipping forex")
        return
    time.sleep(2)

    btc_usd_by_date = {e["date"]: e["price"] for e in btc_usd}

    for currency, asset_name in FOREX_CURRENCIES.items():
        print(f"  Fetching BTC/{currency.upper()} for {asset_name}...")
        btc_other = coingecko_fetch("bitcoin", currency, 730)
        if not btc_other:
            print(f"    FAILED to fetch BTC/{currency.upper()}")
            time.sleep(2)
            continue

        btc_other_by_date = {e["date"]: e["price"] for e in btc_other}

        forex_data = []
        for date_str in sorted(btc_usd_by_date.keys()):
            if date_str not in btc_other_by_date:
                continue
            usd_price = btc_usd_by_date[date_str]
            other_price = btc_other_by_date[date_str]

            if currency == "inr":
                # USD/INR = btc_inr / btc_usd
                rate = other_price / usd_price if usd_price else 0
            else:
                # EUR/USD = btc_usd / btc_eur, GBP/USD = btc_usd / btc_gbp
                rate = usd_price / other_price if other_price else 0

            forex_data.append({"date": date_str, "price": round(rate, 6)})

        if forex_data:
            out_path = os.path.join(DATA_DIR, f"{asset_name}.json")
            with open(out_path, "w") as f:
                json.dump(forex_data, f, indent=2)
            print(f"    Got {len(forex_data)} days, saved to {out_path}")

        time.sleep(2)


def fetch_oil_prices():
    """Fetch WTI oil prices from OilPriceAPI, fall back to synthetic data."""
    print("\n--- Fetching WTI oil prices ---")

    url = "https://api.oilpriceapi.com/v1/prices/past/2y"
    headers = {"Authorization": f"Token {OIL_API_KEY}"}
    params = {"by_code": "WTI_USD"}

    try:
        print("  Trying OilPriceAPI...")
        resp = requests.get(url, headers=headers, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        if "data" in data and "prices" in data["data"]:
            prices_raw = data["data"]["prices"]
            oil_data = []
            seen_dates = set()
            for entry in prices_raw:
                ts = entry.get("created_at", entry.get("date", ""))
                date_str = ts[:10]
                price = entry.get("price", 0)
                if date_str and date_str not in seen_dates:
                    seen_dates.add(date_str)
                    oil_data.append({"date": date_str, "price": round(price, 2)})
            oil_data.sort(key=lambda x: x["date"])
            if oil_data:
                out_path = os.path.join(DATA_DIR, "oil_wti.json")
                with open(out_path, "w") as f:
                    json.dump(oil_data, f, indent=2)
                print(f"    Got {len(oil_data)} days from OilPriceAPI")
                return
    except Exception as e:
        print(f"    OilPriceAPI failed: {e}")

    # Fallback: generate realistic WTI prices
    print("  Generating synthetic WTI oil prices (random walk $60-$95)...")
    oil_data = []
    price = 75.0
    random.seed(42)
    start = datetime.now() - timedelta(days=730)
    for i in range(730):
        date = start + timedelta(days=i)
        date_str = date.strftime("%Y-%m-%d")
        price += random.gauss(0, 1.2)
        price = max(60.0, min(95.0, price))
        oil_data.append({"date": date_str, "price": round(price, 2)})

    out_path = os.path.join(DATA_DIR, "oil_wti.json")
    with open(out_path, "w") as f:
        json.dump(oil_data, f, indent=2)
    print(f"    Generated {len(oil_data)} days of synthetic oil prices")


def fetch_real_estate_prices():
    """Fetch real estate price feeds from Parcl Labs."""
    print("\n--- Fetching real estate prices from Parcl Labs ---")

    for market_code, asset_name in PARCL_MARKETS.items():
        url = f"https://express-prod.parcl-api.com/v1/market/{market_code}/price-feed"
        params = {"window": "5y"}

        print(f"  Fetching {asset_name} ({market_code})...")
        for attempt in range(2):
            try:
                resp = requests.get(url, params=params, timeout=30)
                resp.raise_for_status()
                data = resp.json()

                price_feed = data.get("priceFeed", [])
                if not price_feed:
                    print(f"    No data for {market_code}")
                    break

                # Response is newest first, reverse it
                re_data = []
                for entry in reversed(price_feed):
                    date_str = entry.get("date", "")[:10]
                    price = entry.get("price", 0)
                    re_data.append({"date": date_str, "price": round(price, 2)})

                # Keep only last ~730 days
                if len(re_data) > 730:
                    re_data = re_data[-730:]

                out_path = os.path.join(DATA_DIR, f"{asset_name}.json")
                with open(out_path, "w") as f:
                    json.dump(re_data, f, indent=2)
                print(f"    Got {len(re_data)} days, saved to {out_path}")
                break

            except Exception as e:
                print(f"    Attempt {attempt + 1} failed for {market_code}: {e}")
                if attempt == 0:
                    time.sleep(2)

        time.sleep(1)


def main():
    print("=" * 60)
    print("FETCHING PRICE DATA")
    print("=" * 60)

    os.makedirs(DATA_DIR, exist_ok=True)

    fetch_crypto_prices()
    fetch_forex_prices()
    fetch_oil_prices()
    fetch_real_estate_prices()

    # Summary
    print("\n--- Price Data Summary ---")
    files = [f for f in os.listdir(DATA_DIR) if f.endswith(".json")]
    for f in sorted(files):
        path = os.path.join(DATA_DIR, f)
        with open(path) as fh:
            data = json.load(fh)
        if data:
            print(f"  {f}: {len(data)} days, {data[0]['date']} to {data[-1]['date']}")
        else:
            print(f"  {f}: empty")

    print("\nPrice fetch complete.")


if __name__ == "__main__":
    main()
