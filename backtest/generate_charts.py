"""
Generate charts for HedgeMyLife backtest results.
Dark theme matching the app (bg #0A0A0F, green #00FF94, red #FF3B6B).
"""

import json
import os

import matplotlib
matplotlib.use("Agg")  # Non-interactive backend
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import numpy as np
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RESULTS_DIR = os.path.join(BASE_DIR, "results", "json")
CHARTS_DIR = os.path.join(BASE_DIR, "results", "charts")
APY_DIR = os.path.join(BASE_DIR, "data", "apy")

# App theme colors
BG_COLOR = "#0A0A0F"
TEXT_COLOR = "#FFFFFF"
GRID_COLOR = "#1A1A2E"
GREEN = "#00FF94"
RED = "#FF3B6B"
BLUE = "#4DA6FF"
YELLOW = "#FFD700"
PURPLE = "#B266FF"
CYAN = "#00E5FF"
ORANGE = "#FF9500"

POOL_COLORS = {
    "morpho_steakhouse_usdc": GREEN,
    "morpho_gauntlet_usdc": BLUE,
    "aave_v3_usdc": PURPLE,
    "moonwell_usdc_base": ORANGE,
}

POOL_LABELS = {
    "morpho_steakhouse_usdc": "Morpho Steakhouse USDC",
    "morpho_gauntlet_usdc": "Morpho Gauntlet USDC",
    "aave_v3_usdc": "Aave V3 USDC",
    "moonwell_usdc_base": "Moonwell USDC (Base)",
}


def setup_dark_style():
    """Configure matplotlib for dark theme."""
    plt.rcParams.update({
        "figure.facecolor": BG_COLOR,
        "axes.facecolor": BG_COLOR,
        "axes.edgecolor": GRID_COLOR,
        "axes.labelcolor": TEXT_COLOR,
        "text.color": TEXT_COLOR,
        "xtick.color": TEXT_COLOR,
        "ytick.color": TEXT_COLOR,
        "grid.color": GRID_COLOR,
        "grid.alpha": 0.3,
        "legend.facecolor": "#16162A",
        "legend.edgecolor": GRID_COLOR,
        "legend.labelcolor": TEXT_COLOR,
        "font.size": 11,
        "axes.titlesize": 14,
        "figure.dpi": 150,
    })


def load_results(asset, duration):
    """Load backtest results for an asset/duration combo."""
    path = os.path.join(RESULTS_DIR, f"{asset}_{duration}m.json")
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f)


def load_summaries():
    """Load all summaries."""
    path = os.path.join(RESULTS_DIR, "summaries.json")
    if not os.path.exists(path):
        return []
    with open(path) as f:
        return json.load(f)


def chart_per_asset_comparison(asset, duration=3, deposit=10000):
    """
    Per-asset comparison chart: Yield Only vs Yield Shield returns over time.
    """
    results = load_results(asset, duration)
    if not results:
        print(f"  No data for {asset}/{duration}M")
        return

    # Filter to specific deposit
    filtered = [r for r in results if r["deposit"] == deposit]
    if not filtered:
        print(f"  No data for {asset}/{duration}M/${deposit}")
        return

    dates = [datetime.strptime(r["start_date"], "%Y-%m-%d") for r in filtered]
    yield_returns = [r["yield_only_return"] for r in filtered]
    shield_returns = [r["shield_return"] for r in filtered]

    fig, ax = plt.subplots(figsize=(14, 7))

    ax.plot(dates, yield_returns, color=BLUE, linewidth=1.5, label="Yield Only", alpha=0.9)
    ax.plot(dates, shield_returns, color=GREEN, linewidth=1.5, label="Yield Shield", alpha=0.9)
    ax.axhline(y=deposit, color=RED, linestyle="--", linewidth=1, alpha=0.5, label=f"Principal (${deposit:,})")

    # Fill between to highlight where shield beats yield
    y_arr = np.array(yield_returns)
    s_arr = np.array(shield_returns)
    ax.fill_between(dates, yield_returns, shield_returns,
                     where=s_arr >= y_arr, color=GREEN, alpha=0.1, interpolate=True)
    ax.fill_between(dates, yield_returns, shield_returns,
                     where=s_arr < y_arr, color=RED, alpha=0.1, interpolate=True)

    asset_display = asset.replace("_", " ").replace("re ", "RE: ").title()
    ax.set_title(f"{asset_display} - Yield Only vs Yield Shield ({duration}M, ${deposit:,})")
    ax.set_xlabel("Start Date")
    ax.set_ylabel("Total Return ($)")
    ax.legend(loc="upper left")
    ax.grid(True, alpha=0.2)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
    ax.xaxis.set_major_locator(mdates.MonthLocator(interval=2))
    plt.xticks(rotation=45)

    plt.tight_layout()
    out_path = os.path.join(CHARTS_DIR, f"{asset}_{duration}m_comparison.png")
    plt.savefig(out_path, facecolor=BG_COLOR)
    plt.close()
    print(f"  Saved: {out_path}")


def chart_win_rates(duration=3):
    """Bar chart of shield win rates across all assets."""
    summaries = load_summaries()
    if not summaries:
        print("  No summaries found")
        return

    filtered = [s for s in summaries if s["duration_months"] == duration]
    if not filtered:
        print(f"  No summaries for {duration}M")
        return

    filtered.sort(key=lambda s: s["shield_win_rate"], reverse=True)
    assets = [s["asset"].replace("_", " ").title() for s in filtered]
    win_rates = [s["shield_win_rate"] for s in filtered]
    colors = [GREEN if wr > 50 else RED for wr in win_rates]

    fig, ax = plt.subplots(figsize=(14, 7))

    bars = ax.bar(assets, win_rates, color=colors, alpha=0.85, edgecolor="#333333")

    # Add value labels on bars
    for bar, wr in zip(bars, win_rates):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 1,
                f"{wr:.1f}%", ha="center", va="bottom", fontsize=9, color=TEXT_COLOR)

    ax.axhline(y=50, color=YELLOW, linestyle="--", linewidth=1, alpha=0.5, label="50% breakeven")
    ax.set_title(f"Yield Shield Win Rate by Asset ({duration}M Duration)")
    ax.set_ylabel("Shield Win Rate (%)")
    ax.set_ylim(0, 105)
    ax.legend()
    ax.grid(True, axis="y", alpha=0.2)
    plt.xticks(rotation=45, ha="right")

    plt.tight_layout()
    out_path = os.path.join(CHARTS_DIR, f"win_rates_{duration}m.png")
    plt.savefig(out_path, facecolor=BG_COLOR)
    plt.close()
    print(f"  Saved: {out_path}")


def chart_cumulative_comparison(assets_to_show=None, duration=3, deposit=10000):
    """
    Cumulative returns chart: rolling 3M shields vs holding yield.
    Shows what $10K grows to over time by chaining consecutive shield periods.
    """
    if assets_to_show is None:
        assets_to_show = ["gold", "bitcoin", "re_nyc"]

    fig, ax = plt.subplots(figsize=(14, 7))
    colors_list = [GREEN, BLUE, PURPLE, ORANGE, CYAN]
    has_data = False

    for idx, asset in enumerate(assets_to_show):
        results = load_results(asset, duration)
        if not results:
            continue

        filtered = [r for r in results if r["deposit"] == deposit]
        if not filtered:
            continue

        has_data = True
        filtered.sort(key=lambda r: r["start_date"])

        # Build cumulative shield returns by chaining windows
        # Starting with $deposit, each period the asset return compounds the exposure
        dates_shield = []
        cum_shield = []
        dates_yield = []
        cum_yield = []

        running_shield = deposit
        running_yield = deposit

        # Step through non-overlapping windows
        i = 0
        while i < len(filtered):
            r = filtered[i]
            start_dt = datetime.strptime(r["start_date"], "%Y-%m-%d")
            end_dt = datetime.strptime(r["end_date"], "%Y-%m-%d")

            # Shield: use yield as exposure
            apy = r["best_apy"]
            dur_frac = r["duration_months"] / 12.0
            period_yield = running_shield * (apy / 100) * dur_frac
            asset_ret = r["asset_return_pct"] / 100
            exposure_payout = max(0, period_yield * (1 + asset_ret))
            running_shield = running_shield + exposure_payout

            # Yield only
            running_yield = running_yield + running_yield * (apy / 100) * dur_frac

            dates_shield.append(end_dt)
            cum_shield.append(running_shield)
            dates_yield.append(end_dt)
            cum_yield.append(running_yield)

            # Jump to next non-overlapping window
            target_date = r["end_date"]
            next_i = i + 1
            while next_i < len(filtered) and filtered[next_i]["start_date"] < target_date:
                next_i += 1
            i = next_i

        color = colors_list[idx % len(colors_list)]
        asset_label = asset.replace("_", " ").title()
        ax.plot(dates_shield, cum_shield, color=color, linewidth=2,
                label=f"{asset_label} Shield", alpha=0.9)
        ax.plot(dates_yield, cum_yield, color=color, linewidth=1,
                linestyle="--", label=f"{asset_label} Yield Only", alpha=0.6)

    if not has_data:
        print("  No data for cumulative chart")
        plt.close()
        return

    ax.axhline(y=deposit, color=RED, linestyle=":", linewidth=1, alpha=0.4, label="Principal")
    ax.set_title(f"Cumulative Returns: Yield Shield vs Yield Only ({duration}M Rolling, ${deposit:,})")
    ax.set_xlabel("Date")
    ax.set_ylabel("Portfolio Value ($)")
    ax.legend(loc="upper left", fontsize=9)
    ax.grid(True, alpha=0.2)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
    ax.xaxis.set_major_locator(mdates.MonthLocator(interval=2))
    plt.xticks(rotation=45)

    plt.tight_layout()
    out_path = os.path.join(CHARTS_DIR, "cumulative_comparison.png")
    plt.savefig(out_path, facecolor=BG_COLOR)
    plt.close()
    print(f"  Saved: {out_path}")


def chart_apy_history():
    """Show APY history for all 4 yield sources."""
    fig, ax = plt.subplots(figsize=(14, 7))
    has_data = False

    for pool_name, color in POOL_COLORS.items():
        path = os.path.join(APY_DIR, f"{pool_name}.json")
        if not os.path.exists(path):
            continue

        with open(path) as f:
            data = json.load(f)

        if not data:
            continue

        has_data = True
        dates = [datetime.strptime(e["date"], "%Y-%m-%d") for e in data]
        apys = [e["apy"] for e in data]
        label = POOL_LABELS.get(pool_name, pool_name)
        ax.plot(dates, apys, color=color, linewidth=1.2, label=label, alpha=0.85)

    # Also plot best APY
    best_path = os.path.join(APY_DIR, "best_apy.json")
    if os.path.exists(best_path):
        with open(best_path) as f:
            best_data = json.load(f)
        if best_data:
            dates = [datetime.strptime(e["date"], "%Y-%m-%d") for e in best_data]
            apys = [e["apy"] for e in best_data]
            ax.plot(dates, apys, color=YELLOW, linewidth=2, label="Best Available",
                    alpha=0.9, linestyle="-")

    if not has_data:
        print("  No APY data for chart")
        plt.close()
        return

    ax.set_title("USDC Yield Sources - Historical APY")
    ax.set_xlabel("Date")
    ax.set_ylabel("APY (%)")
    ax.legend(loc="upper right", fontsize=9)
    ax.grid(True, alpha=0.2)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
    ax.xaxis.set_major_locator(mdates.MonthLocator(interval=2))
    plt.xticks(rotation=45)

    plt.tight_layout()
    out_path = os.path.join(CHARTS_DIR, "apy_history.png")
    plt.savefig(out_path, facecolor=BG_COLOR)
    plt.close()
    print(f"  Saved: {out_path}")


def main():
    print("=" * 60)
    print("GENERATING CHARTS")
    print("=" * 60)

    os.makedirs(CHARTS_DIR, exist_ok=True)
    setup_dark_style()

    # 1. Per-asset comparison charts (3M, $10K)
    print("\n--- Per-Asset Comparison Charts ---")
    summaries = load_summaries()
    assets_3m = [s["asset"] for s in summaries if s["duration_months"] == 3]
    if not assets_3m:
        # Fallback: try all price files
        prices_dir = os.path.join(BASE_DIR, "data", "prices")
        if os.path.exists(prices_dir):
            assets_3m = [f.replace(".json", "") for f in os.listdir(prices_dir) if f.endswith(".json")]

    for asset in assets_3m:
        chart_per_asset_comparison(asset, duration=3, deposit=10000)

    # 2. Win rate bar chart
    print("\n--- Win Rate Bar Chart ---")
    chart_win_rates(duration=3)

    # 3. Cumulative comparison
    print("\n--- Cumulative Comparison Chart ---")
    # Pick assets that exist
    preferred = ["gold", "bitcoin", "re_nyc"]
    available = [a for a in preferred if os.path.exists(os.path.join(RESULTS_DIR, f"{a}_3m.json"))]
    if not available and assets_3m:
        available = assets_3m[:3]
    if available:
        chart_cumulative_comparison(available, duration=3, deposit=10000)

    # 4. APY history
    print("\n--- APY History Chart ---")
    chart_apy_history()

    print("\nChart generation complete.")


if __name__ == "__main__":
    main()
