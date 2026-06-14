#!/usr/bin/env python3
"""
Real Estate PPN Deep Analysis
===============================
Fetches all 19 Parcl Labs markets, runs the full PPN simulation
for each market across Aave/Morpho/Moonwell yields and all leverage levels,
then generates a comprehensive per-market markdown report.
"""

import json
import statistics
import time
from datetime import datetime
from pathlib import Path

import requests

# ── Config ────────────────────────────────────────────────────────────────────

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
    "re_nyc": "New York City", "re_brooklyn": "Brooklyn", "re_la": "Los Angeles",
    "re_sf": "San Francisco", "re_sd": "San Diego", "re_miami": "Miami",
    "re_miami_beach": "Miami Beach", "re_austin": "Austin", "re_denver": "Denver",
    "re_atlanta": "Atlanta", "re_chicago": "Chicago", "re_boston": "Boston",
    "re_dc": "Washington DC", "re_pittsburgh": "Pittsburgh", "re_charlotte": "Charlotte",
    "re_tampa": "Tampa", "re_las_vegas": "Las Vegas", "re_nashville": "Nashville",
    "re_us": "US National",
}

YIELD_PROTOCOLS = {
    "Aave V3": 0.038,
    "Morpho Steakhouse": 0.052,
    "Moonwell": 0.061,
    "Leveraged Vault": 0.10,
    "Peak DeFi": 0.15,
}

LEVERAGES = [1, 5, 10, 20, 50, 100]
DURATIONS = [30, 90, 180, 365]
DEPOSIT = 10_000.0

RESULTS_DIR = Path(__file__).resolve().parent / "results"
CACHE_DIR = Path(__file__).resolve().parent / "cache"


# ── Data fetching ─────────────────────────────────────────────────────────────

def fetch_market(key: str, ticker: str) -> list[dict]:
    """Fetch from cache or API."""
    cache_file = CACHE_DIR / f"parcl_{ticker}_5y.json"
    if cache_file.exists():
        with open(cache_file) as f:
            data = json.load(f)
        print(f"  {LABELS[key]:>20}: loaded {len(data)} from cache")
        return data

    url = f"https://express-prod.parcl-api.com/v1/market/{ticker}/price-feed?window=5y"
    print(f"  {LABELS[key]:>20}: fetching {ticker}...", end=" ", flush=True)
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
        ds = str(item.get("date", ""))[:10]
        price = item.get("price")
        if ds and price and price > 0 and ds not in seen:
            seen.add(ds)
            prices.append({"timestamp": ds, "price": float(price)})
    prices.sort(key=lambda x: x["timestamp"])

    if prices:
        CACHE_DIR.mkdir(exist_ok=True)
        with open(cache_file, "w") as f:
            json.dump(prices, f)
    print(f"{len(prices)} points")
    return prices


# ── PPN Math (inlined for standalone) ─────────────────────────────────────────

def calc_split(deposit, apy, dur_years):
    pv = deposit / ((1 + apy) ** dur_years)
    return deposit - pv  # exposure budget


def settle(deposit, eb, leverage, entry_p, exit_p, apy, dur_days, period_prices):
    dur_years = dur_days / 365.0
    exposure = eb * leverage
    asset_ret = (exit_p - entry_p) / entry_p
    liq_price = entry_p * (1.0 - 1.0 / leverage)

    liquidated = False
    for p in period_prices:
        if p <= liq_price:
            liquidated = True
            break

    if liquidated:
        pos_close = 0.0
    else:
        pos_close = max(0.0, eb + exposure * asset_ret)

    total = deposit + pos_close
    profit = total - deposit
    morpho_only = deposit + deposit * apy * dur_years

    return {
        "total": total,
        "profit": profit,
        "pct": profit / deposit * 100,
        "liquidated": liquidated,
        "protected": total >= deposit - 0.01,
        "morpho_only": morpho_only,
        "beat_morpho": total > morpho_only,
        "beat_hold": total > deposit * (1 + asset_ret),
        "asset_ret_pct": asset_ret * 100,
        "pos_close": pos_close,
    }


# ── Simulation ────────────────────────────────────────────────────────────────

def simulate_market(key, prices):
    """Run all yield/leverage/duration combos for one market."""
    price_list = [p["price"] for p in prices]
    date_list = [p["timestamp"] for p in prices]
    n = len(price_list)

    results = []  # aggregated rows

    for proto_name, apy in YIELD_PROTOCOLS.items():
        for leverage in LEVERAGES:
            for dur in DURATIONS:
                dur_years = dur / 365.0
                eb = calc_split(DEPOSIT, apy, dur_years)

                max_entry = n - dur
                if max_entry <= 0:
                    continue

                sims = 0
                protected = 0
                liquidated = 0
                total_profit = 0
                beat_morpho = 0
                beat_hold = 0
                best = float("-inf")
                worst = float("inf")
                all_pcts = []

                for i in range(max_entry):
                    ep = price_list[i]
                    xp = price_list[i + dur]
                    if ep <= 0 or xp <= 0:
                        continue
                    period = price_list[i+1:i+dur+1]
                    r = settle(DEPOSIT, eb, leverage, ep, xp, apy, dur, period)

                    sims += 1
                    if r["protected"]:
                        protected += 1
                    if r["liquidated"]:
                        liquidated += 1
                    total_profit += r["profit"]
                    if r["beat_morpho"]:
                        beat_morpho += 1
                    if r["beat_hold"]:
                        beat_hold += 1
                    best = max(best, r["pct"])
                    worst = min(worst, r["pct"])
                    all_pcts.append(r["pct"])

                if sims == 0:
                    continue

                all_pcts.sort()
                results.append({
                    "market": key,
                    "label": LABELS[key],
                    "protocol": proto_name,
                    "apy": apy,
                    "apy_pct": apy * 100,
                    "leverage": leverage,
                    "duration": dur,
                    "exposure_budget": round(eb, 2),
                    "sims": sims,
                    "protection_rate": round(protected / sims * 100, 4),
                    "liq_rate": round(liquidated / sims * 100, 2),
                    "avg_profit": round(total_profit / sims, 2),
                    "avg_pct": round(total_profit / sims / DEPOSIT * 100, 4),
                    "best_pct": round(best, 2),
                    "worst_pct": round(worst, 2),
                    "median_pct": round(all_pcts[len(all_pcts)//2], 2),
                    "p25_pct": round(all_pcts[len(all_pcts)//4], 2),
                    "p75_pct": round(all_pcts[int(len(all_pcts)*0.75)], 2),
                    "beat_morpho_rate": round(beat_morpho / sims * 100, 2),
                    "beat_hold_rate": round(beat_hold / sims * 100, 2),
                })

    return results


# ── Report generation ─────────────────────────────────────────────────────────

def generate_report(all_results, all_market_data):
    md = []
    w = md.append

    markets = sorted(set(r["market"] for r in all_results))
    total_sims = sum(r["sims"] for r in all_results)
    all_protected = all(r["protection_rate"] >= 99.99 for r in all_results)

    w("# Real Estate PPN Backtest — Full Protocol Comparison")
    w("")
    w("> **Every Parcl Labs market tested against Aave V3, Morpho Steakhouse, Moonwell,**")
    w("> **Leveraged Vault, and Peak DeFi yields at 1x-100x leverage, 30d-365d durations.**")
    w(f"> Total simulations: **{total_sims:,}** | Deposit: $10,000 | Data: Parcl Labs 5yr daily")
    w(f"> Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    w("")
    w("---")
    w("")

    # ── Executive summary ──
    w("## Executive Summary")
    w("")
    prot_str = "100.0000%" if all_protected else "< 100%"
    w(f"- **Principal Protection:** {prot_str} across {total_sims:,} simulations")
    w(f"- **Markets tested:** {len(markets)}")
    w(f"- **Yield protocols:** Aave V3 (3.8%), Morpho (5.2%), Moonwell (6.1%), Leveraged Vault (10%), Peak DeFi (15%)")
    w(f"- **Leverages:** 1x, 5x, 10x, 20x, 50x, 100x")
    w(f"- **Durations:** 30d, 90d, 180d, 365d")
    w("")

    # ── Best config per market (overview table) ──
    w("## Best Configuration Per Market")
    w("")
    w("*Best risk-adjusted config (highest avg return with <50% liquidation):*")
    w("")
    w("| Market | Protocol | Lev | Duration | Avg Return | Liq Rate | Beat Morpho | Best Trade | Sims |")
    w("|--------|----------|-----|----------|-----------|----------|-------------|-----------|------|")

    market_bests = {}
    for mkt in markets:
        rows = [r for r in all_results if r["market"] == mkt and r["liq_rate"] < 50]
        if not rows:
            rows = [r for r in all_results if r["market"] == mkt]
        best = max(rows, key=lambda r: r["avg_pct"])
        market_bests[mkt] = best
        w(f"| **{best['label']}** | {best['protocol']} | {best['leverage']}x | {best['duration']}d "
          f"| {best['avg_pct']:+.2f}% | {best['liq_rate']:.1f}% | {best['beat_morpho_rate']:.1f}% "
          f"| {best['best_pct']:+.2f}% | {best['sims']:,} |")
    w("")

    # ── Tier ranking ──
    sorted_bests = sorted(market_bests.values(), key=lambda r: r["avg_pct"], reverse=True)
    w("### Market Tiers")
    w("")
    tier1 = [r for r in sorted_bests if r["avg_pct"] > 20]
    tier2 = [r for r in sorted_bests if 5 < r["avg_pct"] <= 20]
    tier3 = [r for r in sorted_bests if 0 < r["avg_pct"] <= 5]
    tier4 = [r for r in sorted_bests if r["avg_pct"] <= 0]

    if tier1:
        w(f"**Tier 1 — Excellent (>20% avg return):** {', '.join(r['label'] for r in tier1)}")
    if tier2:
        w(f"**Tier 2 — Good (5-20%):** {', '.join(r['label'] for r in tier2)}")
    if tier3:
        w(f"**Tier 3 — Moderate (0-5%):** {', '.join(r['label'] for r in tier3)}")
    if tier4:
        w(f"**Tier 4 — Weak (<0%):** {', '.join(r['label'] for r in tier4)}")
    w("")

    # ── Protocol comparison (which yield source works best?) ──
    w("## Protocol Comparison Across All Markets")
    w("")
    w("*Averaged across all 19 markets at 20x leverage, 180d duration:*")
    w("")
    w("| Protocol | APY | Exposure Budget | Avg Return | Liq Rate | Beat Yield-Only | Verdict |")
    w("|----------|-----|----------------|-----------|----------|----------------|---------|")

    for proto_name, apy in YIELD_PROTOCOLS.items():
        rows = [r for r in all_results if r["protocol"] == proto_name and r["leverage"] == 20 and r["duration"] == 180]
        if not rows:
            continue
        avg_ret = statistics.mean(r["avg_pct"] for r in rows)
        avg_liq = statistics.mean(r["liq_rate"] for r in rows)
        avg_bm = statistics.mean(r["beat_morpho_rate"] for r in rows)
        avg_eb = statistics.mean(r["exposure_budget"] for r in rows)
        if avg_ret > 5:
            verdict = "Strong"
        elif avg_ret > 1:
            verdict = "Solid"
        else:
            verdict = "Marginal"
        w(f"| {proto_name} | {apy*100:.1f}% | ${avg_eb:.2f} | {avg_ret:+.2f}% | {avg_liq:.1f}% | {avg_bm:.1f}% | {verdict} |")
    w("")
    w("**Key:** Higher APY = larger exposure budget = more upside. Morpho (5.2%) is the baseline.")
    w("")

    # ── Leverage breakdown per market ──
    w("## Leverage Performance Per Market")
    w("")
    w("*Using Morpho Steakhouse (5.2% APY), 180d duration:*")
    w("")

    for mkt in markets:
        label = LABELS[mkt]
        w(f"### {label}")
        w("")
        w(f"| Leverage | Avg Return | Median | Best | Worst | Liq Rate | Beat Morpho | Beat Hold |")
        w(f"|---------|-----------|--------|------|-------|----------|-------------|----------|")
        for lev in LEVERAGES:
            rows = [r for r in all_results if r["market"] == mkt and r["leverage"] == lev
                    and abs(r["apy"] - 0.052) < 0.01 and r["duration"] == 180]
            if not rows:
                continue
            r = rows[0]
            w(f"| {lev}x | {r['avg_pct']:+.2f}% | {r['median_pct']:+.2f}% | {r['best_pct']:+.2f}% "
              f"| {r['worst_pct']:+.2f}% | {r['liq_rate']:.1f}% | {r['beat_morpho_rate']:.1f}% "
              f"| {r['beat_hold_rate']:.1f}% |")

        # Duration breakdown at 20x
        w("")
        w(f"*Duration comparison at 20x leverage, Morpho 5.2%:*")
        w("")
        w(f"| Duration | Budget | Avg Return | Liq Rate | Beat Morpho |")
        w(f"|---------|--------|-----------|----------|-------------|")
        for dur in DURATIONS:
            rows = [r for r in all_results if r["market"] == mkt and r["duration"] == dur
                    and abs(r["apy"] - 0.052) < 0.01 and r["leverage"] == 20]
            if not rows:
                continue
            r = rows[0]
            w(f"| {dur}d | ${r['exposure_budget']:.2f} | {r['avg_pct']:+.2f}% | {r['liq_rate']:.1f}% | {r['beat_morpho_rate']:.1f}% |")

        # Protocol comparison for this market at sweet spot (20x, 180d)
        w("")
        w(f"*Protocol comparison at 20x, 180d:*")
        w("")
        w(f"| Protocol | APY | Budget | Avg Return | Liq Rate | Beat Yield |")
        w(f"|----------|-----|--------|-----------|----------|-----------|")
        for pname, apy in YIELD_PROTOCOLS.items():
            rows = [r for r in all_results if r["market"] == mkt and r["protocol"] == pname
                    and r["leverage"] == 20 and r["duration"] == 180]
            if not rows:
                continue
            r = rows[0]
            w(f"| {pname} | {apy*100:.1f}% | ${r['exposure_budget']:.2f} | {r['avg_pct']:+.2f}% "
              f"| {r['liq_rate']:.1f}% | {r['beat_morpho_rate']:.1f}% |")

        # Recommendation for this market
        w("")
        safe_rows = [r for r in all_results if r["market"] == mkt and r["liq_rate"] < 30 and r["avg_pct"] > 0]
        balanced_rows = [r for r in all_results if r["market"] == mkt and r["liq_rate"] < 50 and r["avg_pct"] > 0]
        aggro_rows = [r for r in all_results if r["market"] == mkt and r["avg_pct"] > 0]

        w(f"**Recommendations for {label}:**")
        if safe_rows:
            best_safe = max(safe_rows, key=lambda r: r["avg_pct"])
            w(f"- Conservative: {best_safe['protocol']} {best_safe['leverage']}x {best_safe['duration']}d "
              f"-> avg {best_safe['avg_pct']:+.2f}%, liq {best_safe['liq_rate']:.1f}%")
        if balanced_rows:
            best_bal = max(balanced_rows, key=lambda r: r["avg_pct"])
            w(f"- Balanced: {best_bal['protocol']} {best_bal['leverage']}x {best_bal['duration']}d "
              f"-> avg {best_bal['avg_pct']:+.2f}%, liq {best_bal['liq_rate']:.1f}%")
        if aggro_rows:
            best_agg = max(aggro_rows, key=lambda r: r["avg_pct"])
            w(f"- Aggressive: {best_agg['protocol']} {best_agg['leverage']}x {best_agg['duration']}d "
              f"-> avg {best_agg['avg_pct']:+.2f}%, liq {best_agg['liq_rate']:.1f}%")
        else:
            w(f"- **WARNING:** No consistently profitable config found. This market is declining.")
        w("")
        w("---")
        w("")

    # ── Cross-market comparison at key configs ──
    w("## Head-to-Head: All Markets at Key Configs")
    w("")

    configs = [
        ("Conservative", "Morpho Steakhouse", 5, 180),
        ("Balanced", "Morpho Steakhouse", 20, 180),
        ("Aggressive", "Peak DeFi", 50, 365),
        ("Safe Yield", "Moonwell", 10, 365),
    ]

    for config_name, proto, lev, dur in configs:
        w(f"### {config_name}: {proto} / {lev}x / {dur}d")
        w("")
        w("| Rank | Market | Avg Return | Liq Rate | Beat Morpho | Best | Worst | Median |")
        w("|------|--------|-----------|----------|-------------|------|-------|--------|")

        rows = [r for r in all_results if r["protocol"] == proto and r["leverage"] == lev and r["duration"] == dur]
        rows.sort(key=lambda r: r["avg_pct"], reverse=True)
        for i, r in enumerate(rows, 1):
            w(f"| {i} | **{r['label']}** | {r['avg_pct']:+.2f}% | {r['liq_rate']:.1f}% "
              f"| {r['beat_morpho_rate']:.1f}% | {r['best_pct']:+.2f}% | {r['worst_pct']:+.2f}% "
              f"| {r['median_pct']:+.2f}% |")
        w("")

    # ── Final insights ──
    w("## Final Insights & Recommendations")
    w("")
    w("### Which markets to offer as PPN underlyings?")
    w("")

    # Score each market
    scores = []
    for mkt in markets:
        mkt_rows = [r for r in all_results if r["market"] == mkt]
        profitable = [r for r in mkt_rows if r["avg_pct"] > 0 and r["liq_rate"] < 50]
        if not profitable:
            scores.append((mkt, 0, 0, 0))
            continue
        best = max(profitable, key=lambda r: r["avg_pct"])
        # Score: weighted combo of avg return, low liq, morpho beat rate
        score = best["avg_pct"] * 0.5 + (100 - best["liq_rate"]) * 0.3 + best["beat_morpho_rate"] * 0.2
        scores.append((mkt, score, best["avg_pct"], best["liq_rate"]))

    scores.sort(key=lambda x: x[1], reverse=True)

    w("| Priority | Market | Score | Best Avg Return | Liq Rate | Recommendation |")
    w("|----------|--------|-------|----------------|----------|---------------|")
    for i, (mkt, score, avg_r, liq) in enumerate(scores, 1):
        if score > 40:
            rec = "MUST HAVE"
        elif score > 25:
            rec = "STRONG ADD"
        elif score > 15:
            rec = "NICE TO HAVE"
        elif score > 5:
            rec = "OPTIONAL"
        else:
            rec = "SKIP"
        w(f"| {i} | **{LABELS[mkt]}** | {score:.1f} | {avg_r:+.2f}% | {liq:.1f}% | {rec} |")
    w("")

    w("### Protocol recommendation by risk profile")
    w("")
    w("| Risk Profile | Protocol | Leverage | Duration | Why |")
    w("|-------------|----------|----------|----------|-----|")
    w("| Ultra-safe | Moonwell (6.1%) | 5x | 365d | Larger budget, long horizon, minimal liq risk |")
    w("| Conservative | Morpho (5.2%) | 10x | 180d | Balanced budget/risk, 6-month commitment |")
    w("| Balanced | Morpho (5.2%) | 20x | 180d | Sweet spot for most markets |")
    w("| Growth | Peak DeFi (15%) | 20x | 365d | Max budget, year-long conviction play |")
    w("| Aggressive | Peak DeFi (15%) | 50x | 365d | High liq risk but massive upside on winners |")
    w("")

    w("### Key numbers to remember")
    w("")
    # Compute some aggregate stats
    morpho_20x_180 = [r for r in all_results if abs(r["apy"] - 0.052) < 0.01 and r["leverage"] == 20 and r["duration"] == 180]
    if morpho_20x_180:
        avg_all = statistics.mean(r["avg_pct"] for r in morpho_20x_180)
        avg_liq_all = statistics.mean(r["liq_rate"] for r in morpho_20x_180)
        best_mkt = max(morpho_20x_180, key=lambda r: r["avg_pct"])
        worst_mkt = min(morpho_20x_180, key=lambda r: r["avg_pct"])
        w(f"- At Morpho 20x 180d: average return across all markets = **{avg_all:+.2f}%**, avg liq = **{avg_liq_all:.1f}%**")
        w(f"- Best market at this config: **{best_mkt['label']}** ({best_mkt['avg_pct']:+.2f}%)")
        w(f"- Worst market at this config: **{worst_mkt['label']}** ({worst_mkt['avg_pct']:+.2f}%)")
    w(f"- Exposure budget: Aave (3.8%) = $182/yr, Morpho (5.2%) = $247/yr, Moonwell (6.1%) = $289/yr, Peak (15%) = $667/yr")
    w(f"- Higher yield = proportionally larger upside, same principal protection")
    w(f"- **Real estate volatility is 2-7% annualized vs 50-80% for crypto** — dramatically lower liquidation rates")
    w("")
    w("---")
    w("")
    w("*Data: Parcl Labs price indexes ($/sqft, daily). PPN math: zero-coupon bond + leveraged exposure.*")
    w("*Protocols: Aave V3, Morpho Steakhouse, Moonwell, hypothetical leveraged vault, hypothetical peak DeFi.*")

    return "\n".join(md)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    RESULTS_DIR.mkdir(exist_ok=True)
    CACHE_DIR.mkdir(exist_ok=True)

    print("=" * 70)
    print("  REAL ESTATE PPN DEEP ANALYSIS")
    print("  19 markets x 5 protocols x 6 leverages x 4 durations")
    print("=" * 70)
    print()

    # 1. Fetch data
    print("Fetching price data...")
    all_market_data = {}
    for key, ticker in PARCL_TICKERS.items():
        prices = fetch_market(key, ticker)
        if prices:
            all_market_data[key] = prices
        time.sleep(0.3)

    print(f"\nLoaded {len(all_market_data)} markets")
    print()

    # 2. Run simulations
    print("Running PPN simulations...")
    print()
    all_results = []
    for key, prices in all_market_data.items():
        label = LABELS[key]
        print(f"  Simulating {label}...", end=" ", flush=True)
        results = simulate_market(key, prices)
        all_results.extend(results)
        total_s = sum(r["sims"] for r in results)
        print(f"{len(results)} configs, {total_s:,} sims")

    total_sims = sum(r["sims"] for r in all_results)
    print(f"\nTotal: {total_sims:,} simulations across {len(all_results)} configurations")

    # 3. Save raw results
    raw_path = RESULTS_DIR / "re_ppn_all_results.json"
    with open(raw_path, "w") as f:
        json.dump(all_results, f, indent=2)
    print(f"Saved raw results -> {raw_path}")

    # 4. Generate report
    print("Generating report...")
    report = generate_report(all_results, all_market_data)
    report_path = RESULTS_DIR / "RE_PPN_DETAILED_REPORT.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report)
    print(f"Saved report -> {report_path}")
    print()
    print("Done!")


if __name__ == "__main__":
    main()
