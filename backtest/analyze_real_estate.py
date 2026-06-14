#!/usr/bin/env python3
"""
Parcl Labs Real Estate Analytics
=================================
Fetches 5-year price data for all Parcl markets, saves raw data,
runs comprehensive analytics, and generates a markdown report.
"""

import json
import time
import statistics
from datetime import datetime
from pathlib import Path

import requests

PARCL_TICKERS = {
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

LABELS = {
    "re_nyc": "New York City",
    "re_brooklyn": "Brooklyn",
    "re_la": "Los Angeles",
    "re_sf": "San Francisco",
    "re_sd": "San Diego",
    "re_miami": "Miami",
    "re_miami_beach": "Miami Beach",
    "re_austin": "Austin",
    "re_denver": "Denver",
    "re_atlanta": "Atlanta",
    "re_chicago": "Chicago",
    "re_boston": "Boston",
    "re_dc": "Washington DC",
    "re_pittsburgh": "Pittsburgh",
    "re_charlotte": "Charlotte",
    "re_tampa": "Tampa",
    "re_las_vegas": "Las Vegas",
    "re_nashville": "Nashville",
    "re_us": "US National",
}

RESULTS_DIR = Path(__file__).resolve().parent / "results"
DATA_DIR = RESULTS_DIR / "parcl_data"


def fetch_market(key: str, ticker: str) -> list[dict]:
    """Fetch 5y price feed from Parcl Labs."""
    url = f"https://express-prod.parcl-api.com/v1/market/{ticker}/price-feed?window=5y"
    label = LABELS[key]
    print(f"  {label:>20}: fetching from {ticker}...", end=" ", flush=True)

    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        raw = resp.json()
    except Exception as e:
        print(f"FAILED: {e}")
        return []

    feed = raw.get("priceFeed", [])
    prices = []
    seen = set()
    for item in feed:
        date_str = str(item.get("date", ""))[:10]
        price = item.get("price")
        if date_str and price and price > 0 and date_str not in seen:
            seen.add(date_str)
            prices.append({"date": date_str, "price": float(price)})

    prices.sort(key=lambda x: x["date"])
    print(f"{len(prices)} data points")
    return prices


def compute_analytics(key: str, prices: list[dict]) -> dict:
    """Compute comprehensive analytics for a single market."""
    if len(prices) < 30:
        return None

    p = [x["price"] for x in prices]
    dates = [x["date"] for x in prices]
    n = len(p)

    # Basic stats
    current = p[-1]
    start = p[0]
    high = max(p)
    low = min(p)
    high_date = dates[p.index(high)]
    low_date = dates[p.index(low)]

    total_return_pct = (current - start) / start * 100
    years = (datetime.strptime(dates[-1], "%Y-%m-%d") - datetime.strptime(dates[0], "%Y-%m-%d")).days / 365.25
    cagr = ((current / start) ** (1 / years) - 1) * 100 if years > 0 else 0

    # Daily returns
    daily_returns = [(p[i] - p[i-1]) / p[i-1] * 100 for i in range(1, n)]

    # Volatility (annualized)
    daily_vol = statistics.stdev(daily_returns) if len(daily_returns) > 1 else 0
    annual_vol = daily_vol * (252 ** 0.5)

    # Max drawdown
    peak = p[0]
    max_dd = 0
    max_dd_start = dates[0]
    max_dd_end = dates[0]
    dd_peak_date = dates[0]
    for i in range(1, n):
        if p[i] > peak:
            peak = p[i]
            dd_peak_date = dates[i]
        dd = (p[i] - peak) / peak * 100
        if dd < max_dd:
            max_dd = dd
            max_dd_start = dd_peak_date
            max_dd_end = dates[i]

    # Rolling returns (30d, 90d, 180d, 365d)
    rolling = {}
    for window in [30, 90, 180, 365]:
        if n <= window:
            continue
        rets = [(p[i] - p[i - window]) / p[i - window] * 100 for i in range(window, n)]
        rolling[f"{window}d"] = {
            "avg": statistics.mean(rets),
            "median": statistics.median(rets),
            "best": max(rets),
            "worst": min(rets),
            "positive_pct": sum(1 for r in rets if r > 0) / len(rets) * 100,
            "count": len(rets),
        }

    # Recent performance
    recent = {}
    for label, days in [("1m", 30), ("3m", 90), ("6m", 180), ("1y", 365), ("2y", 730)]:
        if n > days:
            ret = (p[-1] - p[-1 - days]) / p[-1 - days] * 100
            recent[label] = ret

    # Sharpe ratio (using 4% risk-free rate)
    excess_daily = [(r - 4.0/252) for r in daily_returns]
    sharpe = (statistics.mean(excess_daily) / statistics.stdev(excess_daily) * (252 ** 0.5)) if len(excess_daily) > 1 and statistics.stdev(excess_daily) > 0 else 0

    # Sortino ratio (downside deviation only)
    downside = [r for r in daily_returns if r < 0]
    downside_dev = statistics.stdev(downside) * (252 ** 0.5) if len(downside) > 1 else 1
    sortino = (cagr - 4.0) / downside_dev if downside_dev > 0 else 0

    # Longest winning/losing streak
    win_streak = 0
    lose_streak = 0
    max_win_streak = 0
    max_lose_streak = 0
    for r in daily_returns:
        if r > 0:
            win_streak += 1
            lose_streak = 0
        elif r < 0:
            lose_streak += 1
            win_streak = 0
        else:
            win_streak = 0
            lose_streak = 0
        max_win_streak = max(max_win_streak, win_streak)
        max_lose_streak = max(max_lose_streak, lose_streak)

    # Year-over-year returns
    yoy = {}
    year_groups = {}
    for item in prices:
        yr = item["date"][:4]
        year_groups.setdefault(yr, []).append(item["price"])
    years_list = sorted(year_groups.keys())
    for i in range(1, len(years_list)):
        prev_end = year_groups[years_list[i-1]][-1]
        curr_end = year_groups[years_list[i]][-1]
        yoy[years_list[i]] = (curr_end - prev_end) / prev_end * 100

    return {
        "key": key,
        "label": LABELS[key],
        "ticker": PARCL_TICKERS[key],
        "data_points": n,
        "date_range": f"{dates[0]} to {dates[-1]}",
        "start_price": round(start, 2),
        "current_price": round(current, 2),
        "all_time_high": round(high, 2),
        "all_time_high_date": high_date,
        "all_time_low": round(low, 2),
        "all_time_low_date": low_date,
        "total_return_pct": round(total_return_pct, 2),
        "cagr_pct": round(cagr, 2),
        "annual_volatility_pct": round(annual_vol, 2),
        "max_drawdown_pct": round(max_dd, 2),
        "max_drawdown_period": f"{max_dd_start} to {max_dd_end}",
        "sharpe_ratio": round(sharpe, 2),
        "sortino_ratio": round(sortino, 2),
        "rolling_returns": rolling,
        "recent_performance": {k: round(v, 2) for k, v in recent.items()},
        "year_over_year": {k: round(v, 2) for k, v in yoy.items()},
        "max_win_streak_days": max_win_streak,
        "max_lose_streak_days": max_lose_streak,
        "positive_days_pct": round(sum(1 for r in daily_returns if r > 0) / len(daily_returns) * 100, 1),
    }


def generate_report(all_analytics: list[dict]) -> str:
    """Generate comprehensive markdown report."""
    md = []
    w = md.append

    w("# Parcl Labs Real Estate Market Analytics")
    w("")
    w(f"> **19 US real estate markets analyzed using Parcl Labs price index data.**")
    w(f"> Data source: `https://express-prod.parcl-api.com/v1/market/{{ticker}}/price-feed?window=5y`")
    w(f"> Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}")
    w("")
    w("---")
    w("")

    # ── Executive Summary ──
    w("## Executive Summary")
    w("")
    sorted_by_return = sorted(all_analytics, key=lambda x: x["total_return_pct"], reverse=True)
    sorted_by_cagr = sorted(all_analytics, key=lambda x: x["cagr_pct"], reverse=True)
    sorted_by_sharpe = sorted(all_analytics, key=lambda x: x["sharpe_ratio"], reverse=True)
    sorted_by_vol = sorted(all_analytics, key=lambda x: x["annual_volatility_pct"])

    avg_return = statistics.mean(a["total_return_pct"] for a in all_analytics)
    avg_cagr = statistics.mean(a["cagr_pct"] for a in all_analytics)
    avg_vol = statistics.mean(a["annual_volatility_pct"] for a in all_analytics)

    w(f"| Metric | Value |")
    w(f"|--------|-------|")
    w(f"| Markets analyzed | **{len(all_analytics)}** |")
    w(f"| Average total return (5yr) | **{avg_return:+.2f}%** |")
    w(f"| Average CAGR | **{avg_cagr:.2f}%** |")
    w(f"| Average annual volatility | **{avg_vol:.2f}%** |")
    w(f"| Best performer | **{sorted_by_return[0]['label']}** ({sorted_by_return[0]['total_return_pct']:+.2f}%) |")
    w(f"| Worst performer | **{sorted_by_return[-1]['label']}** ({sorted_by_return[-1]['total_return_pct']:+.2f}%) |")
    w(f"| Best risk-adjusted (Sharpe) | **{sorted_by_sharpe[0]['label']}** ({sorted_by_sharpe[0]['sharpe_ratio']:.2f}) |")
    w(f"| Lowest volatility | **{sorted_by_vol[0]['label']}** ({sorted_by_vol[0]['annual_volatility_pct']:.2f}%) |")
    w("")

    # ── Full Rankings Table ──
    w("## Market Rankings (5-Year Performance)")
    w("")
    w("| Rank | Market | Total Return | CAGR | Volatility | Max Drawdown | Sharpe | Current Price |")
    w("|------|--------|-------------|------|-----------|-------------|--------|--------------|")
    for i, a in enumerate(sorted_by_return, 1):
        w(f"| {i} | **{a['label']}** | {a['total_return_pct']:+.2f}% | {a['cagr_pct']:.2f}% | {a['annual_volatility_pct']:.2f}% | {a['max_drawdown_pct']:.2f}% | {a['sharpe_ratio']:.2f} | ${a['current_price']:,.2f} |")
    w("")

    # ── Recent Performance ──
    w("## Recent Performance")
    w("")
    w("| Market | 1 Month | 3 Months | 6 Months | 1 Year | 2 Years |")
    w("|--------|---------|----------|----------|--------|---------|")
    for a in sorted_by_return:
        rp = a["recent_performance"]
        w(f"| **{a['label']}** | {rp.get('1m', 'N/A'):+.2f}% | {rp.get('3m', 'N/A'):+.2f}% | {rp.get('6m', 'N/A'):+.2f}% | {rp.get('1y', 'N/A'):+.2f}% | {rp.get('2y', 'N/A'):+.2f}% |")
    w("")

    # ── Year-over-Year ──
    w("## Year-over-Year Returns")
    w("")
    all_years = sorted(set(y for a in all_analytics for y in a["year_over_year"]))
    header = "| Market | " + " | ".join(all_years) + " |"
    sep = "|--------|" + "|".join(["--------"] * len(all_years)) + "|"
    w(header)
    w(sep)
    for a in sorted_by_return:
        cols = []
        for yr in all_years:
            val = a["year_over_year"].get(yr)
            cols.append(f"{val:+.2f}%" if val is not None else "N/A")
        w(f"| **{a['label']}** | " + " | ".join(cols) + " |")
    w("")

    # ── Volatility & Risk Analysis ──
    w("## Risk Analysis")
    w("")
    w("| Market | Annual Vol | Max Drawdown | Drawdown Period | Sharpe | Sortino | Positive Days |")
    w("|--------|-----------|-------------|----------------|--------|---------|--------------|")
    for a in sorted_by_vol:
        w(f"| **{a['label']}** | {a['annual_volatility_pct']:.2f}% | {a['max_drawdown_pct']:.2f}% | {a['max_drawdown_period']} | {a['sharpe_ratio']:.2f} | {a['sortino_ratio']:.2f} | {a['positive_days_pct']:.1f}% |")
    w("")

    # ── Rolling Returns Analysis ──
    w("## Rolling Returns Analysis")
    w("")
    for window in ["30d", "90d", "180d", "365d"]:
        w(f"### {window} Rolling Returns")
        w("")
        w(f"| Market | Avg | Median | Best | Worst | % Positive |")
        w(f"|--------|-----|--------|------|-------|-----------|")
        markets_with_window = [a for a in all_analytics if window in a["rolling_returns"]]
        markets_with_window.sort(key=lambda x: x["rolling_returns"][window]["avg"], reverse=True)
        for a in markets_with_window:
            r = a["rolling_returns"][window]
            w(f"| **{a['label']}** | {r['avg']:+.2f}% | {r['median']:+.2f}% | {r['best']:+.2f}% | {r['worst']:+.2f}% | {r['positive_pct']:.1f}% |")
        w("")

    # ── PPN Suitability Score ──
    w("## PPN Suitability Score")
    w("")
    w("A composite score rating each market's suitability for Principal-Protected Notes,")
    w("based on: appreciation (40%), low volatility (30%), Sharpe ratio (20%), and low drawdown (10%).")
    w("")

    # Normalize and score
    max_ret = max(a["total_return_pct"] for a in all_analytics)
    min_ret = min(a["total_return_pct"] for a in all_analytics)
    max_vol = max(a["annual_volatility_pct"] for a in all_analytics)
    min_vol = min(a["annual_volatility_pct"] for a in all_analytics)
    max_sharpe = max(a["sharpe_ratio"] for a in all_analytics)
    min_sharpe = min(a["sharpe_ratio"] for a in all_analytics)
    max_dd = max(abs(a["max_drawdown_pct"]) for a in all_analytics)
    min_dd = min(abs(a["max_drawdown_pct"]) for a in all_analytics)

    def norm(val, lo, hi):
        return (val - lo) / (hi - lo) if hi != lo else 0.5

    scored = []
    for a in all_analytics:
        ret_score = norm(a["total_return_pct"], min_ret, max_ret)
        vol_score = 1 - norm(a["annual_volatility_pct"], min_vol, max_vol)  # lower is better
        sharpe_score = norm(a["sharpe_ratio"], min_sharpe, max_sharpe)
        dd_score = 1 - norm(abs(a["max_drawdown_pct"]), min_dd, max_dd)  # lower is better

        total = ret_score * 0.40 + vol_score * 0.30 + sharpe_score * 0.20 + dd_score * 0.10
        scored.append((a, round(total * 100, 1)))

    scored.sort(key=lambda x: x[1], reverse=True)

    w("| Rank | Market | PPN Score | Return | Volatility | Sharpe | Max DD | Verdict |")
    w("|------|--------|-----------|--------|-----------|--------|--------|---------|")
    for i, (a, score) in enumerate(scored, 1):
        if score >= 70:
            verdict = "Excellent"
        elif score >= 50:
            verdict = "Good"
        elif score >= 30:
            verdict = "Moderate"
        else:
            verdict = "Weak"
        w(f"| {i} | **{a['label']}** | **{score}** | {a['total_return_pct']:+.2f}% | {a['annual_volatility_pct']:.2f}% | {a['sharpe_ratio']:.2f} | {a['max_drawdown_pct']:.2f}% | {verdict} |")
    w("")

    # ── Key Insights ──
    w("## Key Insights")
    w("")

    # 1. Best overall
    best = sorted_by_return[0]
    worst = sorted_by_return[-1]
    w(f"### 1. Market Performance Spread")
    w(f"- **Best market:** {best['label']} with **{best['total_return_pct']:+.2f}%** total return ({best['cagr_pct']:.2f}% CAGR)")
    w(f"- **Worst market:** {worst['label']} with **{worst['total_return_pct']:+.2f}%** total return ({worst['cagr_pct']:.2f}% CAGR)")
    w(f"- **Spread:** {best['total_return_pct'] - worst['total_return_pct']:.2f} percentage points — market selection matters enormously")
    w("")

    # 2. Risk-reward
    best_sharpe = sorted_by_sharpe[0]
    w(f"### 2. Best Risk-Adjusted Returns")
    w(f"- **{best_sharpe['label']}** has the highest Sharpe ratio ({best_sharpe['sharpe_ratio']:.2f})")
    w(f"- This means it delivers the most return per unit of risk taken")
    w(f"- CAGR: {best_sharpe['cagr_pct']:.2f}% with only {best_sharpe['annual_volatility_pct']:.2f}% annual volatility")
    w("")

    # 3. Volatility clusters
    low_vol = [a for a in all_analytics if a["annual_volatility_pct"] < avg_vol]
    high_vol = [a for a in all_analytics if a["annual_volatility_pct"] >= avg_vol]
    w(f"### 3. Volatility Clusters")
    w(f"- **Low volatility** (<{avg_vol:.1f}%): {', '.join(a['label'] for a in sorted(low_vol, key=lambda x: x['annual_volatility_pct']))}")
    w(f"- **High volatility** (>{avg_vol:.1f}%): {', '.join(a['label'] for a in sorted(high_vol, key=lambda x: x['annual_volatility_pct'], reverse=True))}")
    w(f"- Lower volatility means less liquidation risk in PPN leveraged positions")
    w("")

    # 4. Drawdown warning
    deep_dd = [a for a in all_analytics if a["max_drawdown_pct"] < -10]
    w(f"### 4. Drawdown Risk")
    if deep_dd:
        w(f"- **{len(deep_dd)} markets** experienced drawdowns exceeding 10%:")
        for a in sorted(deep_dd, key=lambda x: x["max_drawdown_pct"]):
            w(f"  - {a['label']}: **{a['max_drawdown_pct']:.2f}%** ({a['max_drawdown_period']})")
    else:
        w(f"- No market experienced a drawdown exceeding 10% — real estate indexes are remarkably stable")
    shallow_dd = [a for a in all_analytics if a["max_drawdown_pct"] > -5]
    if shallow_dd:
        w(f"- **{len(shallow_dd)} markets** stayed within 5% drawdown — extremely safe for leveraged PPN exposure")
    w("")

    # 5. PPN recommendations
    top3 = scored[:3]
    w(f"### 5. PPN Strategy Recommendations")
    w("")
    w(f"**Top 3 markets for Principal-Protected Notes:**")
    for i, (a, score) in enumerate(top3, 1):
        r365 = a["rolling_returns"].get("365d", {})
        w(f"")
        w(f"**{i}. {a['label']}** (PPN Score: {score})")
        w(f"   - 5-year return: {a['total_return_pct']:+.2f}% | CAGR: {a['cagr_pct']:.2f}%")
        w(f"   - Volatility: {a['annual_volatility_pct']:.2f}% | Max DD: {a['max_drawdown_pct']:.2f}%")
        if r365:
            w(f"   - 365d rolling: avg {r365['avg']:+.2f}%, positive {r365['positive_pct']:.1f}% of the time")
        w(f"   - Sharpe: {a['sharpe_ratio']:.2f} | Sortino: {a['sortino_ratio']:.2f}")
    w("")

    w(f"**Conservative strategy (low liquidation risk):**")
    conservative = [s for s in scored if s[0]["annual_volatility_pct"] < avg_vol][:3]
    for a, score in conservative:
        w(f"- {a['label']}: {a['annual_volatility_pct']:.2f}% vol, {a['total_return_pct']:+.2f}% return — safe at 20-50x leverage")
    w("")

    w(f"**Aggressive strategy (max upside):**")
    aggressive = sorted(all_analytics, key=lambda x: x["total_return_pct"], reverse=True)[:3]
    for a in aggressive:
        w(f"- {a['label']}: {a['total_return_pct']:+.2f}% return, {a['annual_volatility_pct']:.2f}% vol — use 5-20x leverage")
    w("")

    # 6. Correlation insight
    w("### 6. Geographic Diversification")
    w("")
    w("Markets are grouped by region for diversification:")
    w("")
    regions = {
        "Northeast": ["re_nyc", "re_brooklyn", "re_boston", "re_pittsburgh", "re_dc"],
        "Southeast": ["re_miami", "re_miami_beach", "re_atlanta", "re_charlotte", "re_tampa", "re_nashville"],
        "West": ["re_la", "re_sf", "re_sd", "re_las_vegas", "re_denver"],
        "Central": ["re_austin", "re_chicago"],
        "National": ["re_us"],
    }
    by_key = {a["key"]: a for a in all_analytics}
    for region, keys in regions.items():
        members = [by_key[k] for k in keys if k in by_key]
        if members:
            avg_r = statistics.mean(a["total_return_pct"] for a in members)
            avg_v = statistics.mean(a["annual_volatility_pct"] for a in members)
            w(f"- **{region}**: {', '.join(a['label'] for a in members)} — avg return {avg_r:+.2f}%, avg vol {avg_v:.2f}%")
    w("")

    w("---")
    w("")
    w("*Data: Parcl Labs price feed indexes ($/sqft). All returns are price-index returns, not total returns with rental income.*")

    return "\n".join(md)


def main():
    RESULTS_DIR.mkdir(exist_ok=True)
    DATA_DIR.mkdir(exist_ok=True)

    print("=" * 60)
    print("  PARCL LABS REAL ESTATE ANALYTICS")
    print("=" * 60)
    print()

    # 1. Fetch all markets
    all_data = {}
    print("Fetching 5-year price data for all markets...")
    print()
    for key, ticker in PARCL_TICKERS.items():
        prices = fetch_market(key, ticker)
        if prices:
            all_data[key] = prices
        time.sleep(0.5)

    print(f"\nLoaded {len(all_data)} / {len(PARCL_TICKERS)} markets")

    # 2. Save raw data
    raw_path = DATA_DIR / "all_markets_raw.json"
    with open(raw_path, "w") as f:
        json.dump(all_data, f, indent=2)
    print(f"Saved raw data -> {raw_path}")

    # Save per-market files
    for key, prices in all_data.items():
        p = DATA_DIR / f"{key}.json"
        with open(p, "w") as f:
            json.dump(prices, f, indent=2)

    # 3. Run analytics
    print("\nRunning analytics...")
    all_analytics = []
    for key, prices in all_data.items():
        result = compute_analytics(key, prices)
        if result:
            all_analytics.append(result)
            print(f"  {result['label']:>20}: {result['total_return_pct']:+.2f}% total | {result['cagr_pct']:.2f}% CAGR | {result['annual_volatility_pct']:.2f}% vol")

    # Save analytics JSON
    analytics_path = RESULTS_DIR / "real_estate_analytics.json"
    with open(analytics_path, "w") as f:
        json.dump(all_analytics, f, indent=2)
    print(f"\nSaved analytics -> {analytics_path}")

    # 4. Generate markdown report
    report = generate_report(all_analytics)
    report_path = RESULTS_DIR / "REAL_ESTATE_REPORT.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report)
    print(f"Saved report -> {report_path}")
    print()
    print("Done!")


if __name__ == "__main__":
    main()
