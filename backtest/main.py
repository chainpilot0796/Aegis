#!/usr/bin/env python3
"""
PPN Backtest Simulator
======================
Tests the exact principal-protected note math against REAL historical data
from CoinGecko. 6 assets × 5 yields × 6 leverages × 4 durations = 720 combos,
each across every possible entry date → 500k+ simulations.

Usage:
    python main.py          # Full run — all assets, all configs
    python main.py --quick  # Quick test — Gold + BTC, single config
"""

import sys
import time

from dotenv import load_dotenv

load_dotenv()

from lib.fetch_prices import fetch_all_assets
from lib.simulator import run_backtest
from lib.reporter import save_all


def main():
    quick = "--quick" in sys.argv

    print()
    print("=" * 70)
    print("  PPN BACKTEST SIMULATOR")
    print("  Principal-Protected Note math vs real historical prices")
    if quick:
        print("  MODE: --quick (Gold + BTC only, single config)")
    else:
        print("  MODE: full (6 assets × 5 yields × 6 leverages × 4 durations)")
    print("=" * 70)
    print()

    start = time.time()

    # 1. Fetch prices
    days = 365 if quick else 730
    price_data = fetch_all_assets(days=days)

    # 2. Run simulations
    aggregated, per_trade = run_backtest(price_data, quick=quick)

    # 3. Save results
    save_all(aggregated, per_trade)

    elapsed = time.time() - start
    print(f"\nCompleted in {elapsed:.1f}s")
    print(f"Total per-trade records: {len(per_trade):,}")


if __name__ == "__main__":
    main()
