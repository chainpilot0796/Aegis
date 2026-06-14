"""
Core backtest engine for HedgeMyLife.
Compares "Yield Only" vs "Yield Shield" strategy across assets, deposits, and durations.
Uses rolling daily windows over ~2 years of historical data.
"""

import json
import os
from datetime import datetime, timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
APY_DIR = os.path.join(BASE_DIR, "data", "apy")
PRICES_DIR = os.path.join(BASE_DIR, "data", "prices")
RESULTS_DIR = os.path.join(BASE_DIR, "results", "json")

DEPOSIT_AMOUNTS = [1000, 5000, 10000, 50000]
DURATION_MONTHS = [1, 3, 6]


def load_best_apy():
    """Load best APY series and index by date."""
    path = os.path.join(APY_DIR, "best_apy.json")
    if not os.path.exists(path):
        print("ERROR: best_apy.json not found. Run fetch_apy.py first.")
        return {}
    with open(path) as f:
        data = json.load(f)
    return {entry["date"]: entry["apy"] for entry in data}


def load_price_data(asset_name):
    """Load price series for an asset, indexed by date."""
    path = os.path.join(PRICES_DIR, f"{asset_name}.json")
    if not os.path.exists(path):
        return None
    with open(path) as f:
        data = json.load(f)
    return {entry["date"]: entry["price"] for entry in data}


def get_available_assets():
    """List all available price data files."""
    assets = []
    if not os.path.exists(PRICES_DIR):
        return assets
    for f in sorted(os.listdir(PRICES_DIR)):
        if f.endswith(".json"):
            assets.append(f.replace(".json", ""))
    return assets


def add_months(date_obj, months):
    """Add months to a date, handling month boundaries."""
    month = date_obj.month - 1 + months
    year = date_obj.year + month // 12
    month = month % 12 + 1
    day = min(date_obj.day, 28)  # Safe day to avoid overflow
    return datetime(year, month, day)


def get_apy_for_period(apy_by_date, start_date_str, end_date_str):
    """Get the average best APY over a period."""
    start = datetime.strptime(start_date_str, "%Y-%m-%d")
    end = datetime.strptime(end_date_str, "%Y-%m-%d")

    apys = []
    current = start
    while current <= end:
        ds = current.strftime("%Y-%m-%d")
        if ds in apy_by_date:
            apys.append(apy_by_date[ds])
        current += timedelta(days=1)

    if not apys:
        # Fallback: find nearest available APY
        all_dates = sorted(apy_by_date.keys())
        if all_dates:
            nearest = min(all_dates, key=lambda d: abs((datetime.strptime(d, "%Y-%m-%d") - start).days))
            return apy_by_date[nearest]
        return 5.0  # Default fallback

    return sum(apys) / len(apys)


def run_backtest_for_asset(asset_name, prices_by_date, apy_by_date, deposit, duration_months):
    """Run rolling window backtest for one (asset, deposit, duration) combo."""
    sorted_dates = sorted(prices_by_date.keys())
    if not sorted_dates:
        return []

    results = []
    duration_fraction = duration_months / 12.0

    for start_date_str in sorted_dates:
        start_dt = datetime.strptime(start_date_str, "%Y-%m-%d")
        end_dt = add_months(start_dt, duration_months)
        end_date_str = end_dt.strftime("%Y-%m-%d")

        # Need exit price
        if end_date_str not in prices_by_date:
            # Try nearby dates (up to 3 days tolerance)
            found = False
            for offset in range(-3, 4):
                alt = (end_dt + timedelta(days=offset)).strftime("%Y-%m-%d")
                if alt in prices_by_date:
                    end_date_str = alt
                    found = True
                    break
            if not found:
                continue

        entry_price = prices_by_date[start_date_str]
        exit_price = prices_by_date[end_date_str]

        if entry_price <= 0:
            continue

        # Asset return
        asset_return_pct = ((exit_price - entry_price) / entry_price) * 100

        # Best APY for period
        best_apy = get_apy_for_period(apy_by_date, start_date_str, end_date_str)

        # Strategy 1: Yield Only
        yield_earned = deposit * (best_apy / 100) * duration_fraction
        yield_only_return = deposit + yield_earned
        yield_only_profit = yield_earned
        yield_only_profit_pct = (yield_only_profit / deposit) * 100

        # Strategy 2: Yield Shield
        exposure_budget = yield_earned  # Yield goes into exposure
        # 1x long position: payout = budget * (1 + asset_return%), floor at 0
        exposure_payout = max(0, exposure_budget * (1 + asset_return_pct / 100))
        shield_return = deposit + exposure_payout
        shield_profit = shield_return - deposit
        shield_profit_pct = (shield_profit / deposit) * 100

        shield_beats_yield = exposure_payout > yield_earned
        shield_advantage = exposure_payout - yield_earned

        results.append({
            "start_date": start_date_str,
            "end_date": end_date_str,
            "asset": asset_name,
            "deposit": deposit,
            "duration_months": duration_months,
            "entry_price": round(entry_price, 6),
            "exit_price": round(exit_price, 6),
            "asset_return_pct": round(asset_return_pct, 4),
            "best_apy": round(best_apy, 4),
            "yield_earned": round(yield_earned, 2),
            "yield_only_return": round(yield_only_return, 2),
            "yield_only_profit": round(yield_only_profit, 2),
            "yield_only_profit_pct": round(yield_only_profit_pct, 4),
            "exposure_budget": round(exposure_budget, 2),
            "exposure_payout": round(exposure_payout, 2),
            "shield_return": round(shield_return, 2),
            "shield_profit": round(shield_profit, 2),
            "shield_profit_pct": round(shield_profit_pct, 4),
            "shield_beats_yield": shield_beats_yield,
            "shield_advantage": round(shield_advantage, 2),
        })

    return results


def compute_summary(asset_name, duration_months, all_results):
    """Compute summary statistics for an (asset, duration) combo across all deposits."""
    # Use $10,000 deposit for summary stats
    results = [r for r in all_results if r["deposit"] == 10000]
    if not results:
        results = all_results

    if not results:
        return None

    total_windows = len(results)
    shield_wins = sum(1 for r in results if r["shield_beats_yield"])
    shield_win_rate = (shield_wins / total_windows) * 100 if total_windows else 0

    shield_profits = [r["shield_profit_pct"] for r in results]
    yield_profits = [r["yield_only_profit_pct"] for r in results]
    advantages = [r["shield_advantage"] for r in results]

    return {
        "asset": asset_name,
        "duration_months": duration_months,
        "deposit_used_for_stats": 10000,
        "total_windows": total_windows,
        "shield_wins": shield_wins,
        "shield_win_rate": round(shield_win_rate, 2),
        "avg_shield_profit_pct": round(sum(shield_profits) / len(shield_profits), 4),
        "avg_yield_profit_pct": round(sum(yield_profits) / len(yield_profits), 4),
        "avg_shield_advantage": round(sum(advantages) / len(advantages), 2),
        "max_shield_profit_pct": round(max(shield_profits), 4),
        "min_shield_profit_pct": round(min(shield_profits), 4),
        "max_yield_profit_pct": round(max(yield_profits), 4),
        "max_shield_loss_vs_yield": round(min(advantages), 2),
        "worst_case_shield_return": round(min(r["shield_return"] for r in results), 2),
        "worst_case_yield_return": round(min(r["yield_only_return"] for r in results), 2),
        "note": "Shield worst case = principal (no loss). Yield worst case = principal + yield.",
    }


def main():
    print("=" * 60)
    print("RUNNING BACKTEST ENGINE")
    print("=" * 60)

    os.makedirs(RESULTS_DIR, exist_ok=True)

    # Load APY data
    print("\nLoading APY data...")
    apy_by_date = load_best_apy()
    if not apy_by_date:
        print("ERROR: No APY data available. Exiting.")
        return
    print(f"  APY data: {len(apy_by_date)} dates")

    # Get available assets
    assets = get_available_assets()
    if not assets:
        print("ERROR: No price data available. Run fetch_prices.py first.")
        return
    print(f"  Assets available: {', '.join(assets)}")

    summaries = []
    total_combos = len(assets) * len(DURATION_MONTHS)
    combo_count = 0

    for asset_name in assets:
        prices_by_date = load_price_data(asset_name)
        if not prices_by_date:
            print(f"\n  Skipping {asset_name}: no price data")
            continue

        for duration in DURATION_MONTHS:
            combo_count += 1
            print(f"\n[{combo_count}/{total_combos}] {asset_name} / {duration}M")

            all_results_for_combo = []

            for deposit in DEPOSIT_AMOUNTS:
                results = run_backtest_for_asset(
                    asset_name, prices_by_date, apy_by_date, deposit, duration
                )
                all_results_for_combo.extend(results)

            if not all_results_for_combo:
                print(f"  No valid windows for {asset_name}/{duration}M")
                continue

            # Save full results
            out_path = os.path.join(RESULTS_DIR, f"{asset_name}_{duration}m.json")
            with open(out_path, "w") as f:
                json.dump(all_results_for_combo, f, indent=2)

            # Compute summary
            summary = compute_summary(asset_name, duration, all_results_for_combo)
            if summary:
                summaries.append(summary)
                print(f"  Windows: {summary['total_windows']}, "
                      f"Shield wins: {summary['shield_win_rate']:.1f}%, "
                      f"Avg shield profit: {summary['avg_shield_profit_pct']:.2f}%, "
                      f"Avg yield profit: {summary['avg_yield_profit_pct']:.2f}%")

            print(f"  Saved {len(all_results_for_combo)} results to {out_path}")

    # Save summaries
    if summaries:
        summary_path = os.path.join(RESULTS_DIR, "summaries.json")
        with open(summary_path, "w") as f:
            json.dump(summaries, f, indent=2)
        print(f"\nSaved {len(summaries)} summaries to {summary_path}")

    # Print overview
    print("\n" + "=" * 60)
    print("BACKTEST SUMMARY")
    print("=" * 60)
    print(f"{'Asset':<15} {'Duration':<10} {'Windows':<10} {'Shield Win%':<12} {'Avg Adv':<10}")
    print("-" * 57)
    for s in summaries:
        print(f"{s['asset']:<15} {s['duration_months']}M{'':<8} {s['total_windows']:<10} "
              f"{s['shield_win_rate']:<12.1f} ${s['avg_shield_advantage']:<10.2f}")

    print("\nBacktest complete.")


if __name__ == "__main__":
    main()
