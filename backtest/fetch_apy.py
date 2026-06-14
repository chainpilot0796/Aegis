"""
Fetch historical APY data from DefiLlama yields API for USDC yield pools.
Computes a "best available APY" series across all pools.
"""

import json
import os
import time
import requests
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data", "apy")

POOLS = {
    "morpho_steakhouse_usdc": "b55f43a8-f444-4cd8-a3a4-0a4e786ba566",
    "morpho_gauntlet_usdc": "a306885c-001e-4479-9ae8-459a56527bc1",
    "aave_v3_usdc": "aa70268e-4b52-42bf-a116-608b370f9501",
    "moonwell_usdc_base": "e2c09021-0aa8-42b6-a596-5422c2e35399",
}

DEFILLAMA_URL = "https://yields.llama.fi/chart/{pool_uuid}"


def fetch_pool_apy(pool_name, pool_uuid):
    """Fetch APY history for a single pool from DefiLlama."""
    url = DEFILLAMA_URL.format(pool_uuid=pool_uuid)
    print(f"  Fetching APY for {pool_name} ({pool_uuid})...")

    for attempt in range(2):
        try:
            resp = requests.get(url, timeout=30)
            resp.raise_for_status()
            data = resp.json()

            if data.get("status") != "success" or "data" not in data:
                print(f"    WARNING: Unexpected response format for {pool_name}")
                if attempt == 0:
                    time.sleep(2)
                    continue
                return None

            records = []
            for entry in data["data"]:
                ts = entry.get("timestamp", "")
                date_str = ts[:10] if len(ts) >= 10 else ts
                apy = entry.get("apy", 0) or 0
                apy_base = entry.get("apyBase", 0) or 0
                apy_reward = entry.get("apyReward", 0) or 0
                tvl = entry.get("tvlUsd", 0) or 0
                records.append({
                    "date": date_str,
                    "apy": round(apy, 4),
                    "apy_base": round(apy_base, 4),
                    "apy_reward": round(apy_reward, 4),
                    "tvl_usd": round(tvl, 2),
                })

            print(f"    Got {len(records)} data points for {pool_name}")
            return records

        except Exception as e:
            print(f"    Attempt {attempt + 1} failed for {pool_name}: {e}")
            if attempt == 0:
                time.sleep(2)

    print(f"    SKIPPING {pool_name} after 2 failed attempts")
    return None


def compute_best_apy(all_pool_data):
    """For each date, take the MAX APY across all pools."""
    date_apys = {}

    for pool_name, records in all_pool_data.items():
        if records is None:
            continue
        for entry in records:
            date = entry["date"]
            apy = entry["apy"]
            if date not in date_apys:
                date_apys[date] = {"max_apy": apy, "source": pool_name}
            elif apy > date_apys[date]["max_apy"]:
                date_apys[date] = {"max_apy": apy, "source": pool_name}

    best_apy_series = []
    for date in sorted(date_apys.keys()):
        best_apy_series.append({
            "date": date,
            "apy": round(date_apys[date]["max_apy"], 4),
            "source": date_apys[date]["source"],
        })

    return best_apy_series


def main():
    print("=" * 60)
    print("FETCHING APY DATA FROM DEFILLAMA")
    print("=" * 60)

    os.makedirs(DATA_DIR, exist_ok=True)

    all_pool_data = {}

    for pool_name, pool_uuid in POOLS.items():
        records = fetch_pool_apy(pool_name, pool_uuid)
        all_pool_data[pool_name] = records

        if records is not None:
            out_path = os.path.join(DATA_DIR, f"{pool_name}.json")
            with open(out_path, "w") as f:
                json.dump(records, f, indent=2)
            print(f"    Saved to {out_path}")

        time.sleep(1)

    # Compute best APY series
    print("\nComputing best available APY series...")
    best_apy = compute_best_apy(all_pool_data)
    out_path = os.path.join(DATA_DIR, "best_apy.json")
    with open(out_path, "w") as f:
        json.dump(best_apy, f, indent=2)
    print(f"  Saved {len(best_apy)} data points to {out_path}")

    # Print summary
    if best_apy:
        apys = [e["apy"] for e in best_apy]
        print(f"\n  Best APY range: {min(apys):.2f}% - {max(apys):.2f}%")
        print(f"  Average best APY: {sum(apys)/len(apys):.2f}%")
        print(f"  Date range: {best_apy[0]['date']} to {best_apy[-1]['date']}")

    print("\nAPY fetch complete.")


if __name__ == "__main__":
    main()
