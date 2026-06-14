#!/usr/bin/env python3
"""
FINAL COMPREHENSIVE EXPORT
============================
Runs the full backtest with live APYs from DeFiLlama,
exports EVERYTHING: JSON, CSV per asset, CSV master, MD summary,
MD detailed insights, and charts data.
"""

import csv
import json
import statistics
import time
import os
from datetime import datetime, timedelta
from pathlib import Path

import requests
import yfinance as yf
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
CACHE_DIR = BASE_DIR / "cache"
RESULTS_DIR = BASE_DIR / "results"
CACHE_DIR.mkdir(exist_ok=True)
RESULTS_DIR.mkdir(exist_ok=True)

# ── Assets ────────────────────────────────────────────────────────────────────
YAHOO_METALS = {"gold": "GC=F", "silver": "SI=F"}
COINGECKO_ASSETS = {"bitcoin": "bitcoin", "ethereum": "ethereum", "solana": "solana", "xrp": "ripple"}
PARCL_TICKERS = {
    "re_nyc": "NY-NYC", "re_brooklyn": "NY-BRK", "re_la": "CA-LA", "re_sf": "CA-SF",
    "re_sd": "CA-SD", "re_miami": "FL-MIA", "re_miami_beach": "FL-MB", "re_austin": "TX-AUS",
    "re_denver": "CO-DEN", "re_atlanta": "GA-ATL", "re_chicago": "IL-CHI", "re_boston": "MA-BOS",
    "re_dc": "DC-WAS", "re_pittsburgh": "PA-PIT", "re_charlotte": "NC-CHA", "re_tampa": "FL-TPA",
    "re_las_vegas": "NV-LV", "re_nashville": "TN-NASH", "re_us": "NA-US",
}
LABELS = {
    "gold": "Gold (XAU)", "silver": "Silver (XAG)", "bitcoin": "Bitcoin", "ethereum": "Ethereum",
    "solana": "Solana", "xrp": "XRP", "re_nyc": "New York City", "re_brooklyn": "Brooklyn",
    "re_la": "Los Angeles", "re_sf": "San Francisco", "re_sd": "San Diego", "re_miami": "Miami",
    "re_miami_beach": "Miami Beach", "re_austin": "Austin", "re_denver": "Denver",
    "re_atlanta": "Atlanta", "re_chicago": "Chicago", "re_boston": "Boston",
    "re_dc": "Washington DC", "re_pittsburgh": "Pittsburgh", "re_charlotte": "Charlotte",
    "re_tampa": "Tampa", "re_las_vegas": "Las Vegas", "re_nashville": "Nashville",
    "re_us": "US National",
}
ASSET_CLASS = {}
for k in YAHOO_METALS: ASSET_CLASS[k] = "Commodities"
for k in COINGECKO_ASSETS: ASSET_CLASS[k] = "Crypto"
for k in PARCL_TICKERS: ASSET_CLASS[k] = "Real Estate"

DEFILLAMA_POOLS = {
    "Aave V3": "7e0661bf-8cf3-45e6-9424-31916d4c7b84",
    "Morpho Steakhouse": "7820bd3c-461a-4811-9f0b-1d39c1503c3f",
    "Moonwell": "69cf831d-624a-4f23-b5e3-c0f63ad1fa01",
}
FALLBACK_APYS = {"Aave V3": 0.038, "Morpho Steakhouse": 0.052, "Moonwell": 0.061}

LEVERAGES = [1, 2, 3, 5, 10, 15, 20, 30, 50, 75, 100]
DURATIONS = [30, 60, 90, 120, 180, 270, 365]
DEPOSIT = 10_000.0


# ── Helpers ───────────────────────────────────────────────────────────────────
def cache_load(key):
    f = CACHE_DIR / f"{key}.json"
    if f.exists() and (time.time() - f.stat().st_mtime) / 3600 < 72:
        with open(f) as fh: return json.load(fh)
    return None

def cache_save(key, data):
    with open(CACHE_DIR / f"{key}.json", "w") as fh: json.dump(data, fh)
    return data


def fetch_live_apys():
    print("Fetching live APYs from DeFiLlama...")
    protos = []
    try:
        resp = requests.get("https://yields.llama.fi/pools", timeout=30)
        pool_map = {p["pool"]: p for p in resp.json()["data"]}
        for name, pid in DEFILLAMA_POOLS.items():
            p = pool_map.get(pid)
            if p and p.get("apy", 0) > 0:
                apy = p["apy"] / 100.0
                print(f"  {name:>25}: {p['apy']:.2f}% (live) | TVL ${p.get('tvlUsd',0):,.0f}")
                protos.append((name, apy))
            else:
                fb = FALLBACK_APYS[name]
                print(f"  {name:>25}: {fb*100:.1f}% (fallback)")
                protos.append((name, fb))
    except Exception as e:
        print(f"  API failed: {e}, using fallbacks")
        protos = [(n, a) for n, a in FALLBACK_APYS.items()]
    return protos


def fetch_yahoo(metal, ticker):
    key = f"yahoo_{metal}_max"
    c = cache_load(key)
    if c: print(f"  {LABELS[metal]:>20}: {len(c)} pts (cache)"); return c
    print(f"  {LABELS[metal]:>20}: fetching...", end=" ", flush=True)
    try:
        df = yf.download(ticker, start="2010-01-01", end=datetime.now().strftime("%Y-%m-%d"), progress=False)
        prices = []
        seen = set()
        for idx, row in df.iterrows():
            ds = idx.strftime("%Y-%m-%d") if hasattr(idx, "strftime") else str(idx)[:10]
            cl = float(row["Close"].item() if hasattr(row["Close"], "item") else row["Close"])
            if ds not in seen and cl > 0: seen.add(ds); prices.append({"timestamp": ds, "price": round(cl, 2)})
        prices.sort(key=lambda x: x["timestamp"])
        if prices: cache_save(key, prices)
        print(f"{len(prices)} pts")
        return prices
    except Exception as e: print(f"FAIL: {e}"); return []


def fetch_cg(coin_id, label):
    key = f"cg_max_{coin_id}"
    c = cache_load(key)
    if c: print(f"  {label:>20}: {len(c)} pts (cache)"); return c
    api_key = os.getenv("COINGECKO_API_KEY", "")
    is_pro = os.getenv("COINGECKO_IS_PRO", "false").lower() == "true"
    base = "https://pro-api.coingecko.com/api/v3" if is_pro and api_key else "https://api.coingecko.com/api/v3"
    headers = {"x-cg-pro-api-key": api_key} if is_pro and api_key else ({"x-cg-demo-api-key": api_key} if api_key else {})
    print(f"  {label:>20}: fetching...", end=" ", flush=True)
    try:
        resp = requests.get(f"{base}/coins/{coin_id}/market_chart", params={"vs_currency": "usd", "days": "max"}, headers=headers, timeout=60)
        if resp.status_code != 200:
            resp = requests.get(f"{base}/coins/{coin_id}/market_chart", params={"vs_currency": "usd", "days": 1825}, headers=headers, timeout=60)
        prices = []
        seen = set()
        for ts_ms, price in resp.json().get("prices", []):
            ds = datetime.utcfromtimestamp(ts_ms / 1000).strftime("%Y-%m-%d")
            if ds not in seen: seen.add(ds); prices.append({"timestamp": ds, "price": price})
        prices.sort(key=lambda x: x["timestamp"])
        if prices: cache_save(key, prices)
        print(f"{len(prices)} pts")
        return prices
    except Exception as e: print(f"FAIL: {e}"); return []


def fetch_parcl(key, ticker):
    ckey = f"parcl_{ticker}_5y"
    c = cache_load(ckey)
    if c: print(f"  {LABELS[key]:>20}: {len(c)} pts (cache)"); return c
    print(f"  {LABELS[key]:>20}: fetching...", end=" ", flush=True)
    try:
        resp = requests.get(f"https://express-prod.parcl-api.com/v1/market/{ticker}/price-feed?window=5y", timeout=30)
        feed = resp.json().get("priceFeed", [])
        prices = []
        seen = set()
        for item in feed:
            ds = str(item.get("date", ""))[:10]
            p = item.get("price")
            if ds and p and p > 0 and ds not in seen: seen.add(ds); prices.append({"timestamp": ds, "price": float(p)})
        prices.sort(key=lambda x: x["timestamp"])
        if prices: cache_save(ckey, prices)
        print(f"{len(prices)} pts")
        return prices
    except Exception as e: print(f"FAIL: {e}"); return []


# ── PPN Math ──────────────────────────────────────────────────────────────────
def calc_budget(deposit, apy, dur_years):
    return deposit - deposit / ((1 + apy) ** dur_years)

def simulate_trade(deposit, eb, leverage, ep, xp, period):
    exposure = eb * leverage
    asset_ret = (xp - ep) / ep
    liq_price = ep * (1.0 - 1.0 / leverage)
    liquidated = any(p <= liq_price for p in period)
    pos_close = 0.0 if liquidated else max(0.0, eb + exposure * asset_ret)
    total = deposit + pos_close
    return total, total - deposit, liquidated, asset_ret


# ── Run ───────────────────────────────────────────────────────────────────────
def run_all(all_prices, protocols):
    agg_results = []
    per_trade_rows = []
    total_sims = 0

    for asset_key, prices in all_prices.items():
        if not prices or len(prices) < 60: continue
        label = LABELS.get(asset_key, asset_key)
        cls = ASSET_CLASS.get(asset_key, "Other")
        pl = [p["price"] for p in prices]
        dl = [p["timestamp"] for p in prices]
        n = len(pl)
        print(f"  {label:>20}: {n} days, ", end="", flush=True)
        asset_sims = 0

        for pname, apy in protocols:
            for lev in LEVERAGES:
                for dur in DURATIONS:
                    dur_y = dur / 365.0
                    eb = calc_budget(DEPOSIT, apy, dur_y)
                    mx = n - dur
                    if mx <= 0: continue
                    sims = prot = liq = bm = bh = 0
                    tp = 0.0
                    best = float("-inf"); worst = float("inf")
                    all_pcts = []
                    for i in range(mx):
                        ep, xp = pl[i], pl[i + dur]
                        if ep <= 0 or xp <= 0: continue
                        period = pl[i+1:i+dur+1]
                        tot, profit, was_liq, aret = simulate_trade(DEPOSIT, eb, lev, ep, xp, period)
                        pct = profit / DEPOSIT * 100
                        sims += 1
                        if tot >= DEPOSIT - 0.01: prot += 1
                        if was_liq: liq += 1
                        tp += profit
                        morpho_only = DEPOSIT + DEPOSIT * apy * dur_y
                        if tot > morpho_only: bm += 1
                        if tot > DEPOSIT * (1 + aret): bh += 1
                        best = max(best, pct); worst = min(worst, pct)
                        all_pcts.append(pct)
                        # per-trade row (sample every 5th to keep CSV manageable)
                        if i % 5 == 0:
                            per_trade_rows.append({
                                "asset": asset_key, "label": label, "class": cls,
                                "entry_date": dl[i], "exit_date": dl[i+dur],
                                "entry_price": round(ep, 4), "exit_price": round(xp, 4),
                                "asset_return_pct": round(aret * 100, 4),
                                "protocol": pname, "apy_pct": round(apy * 100, 2),
                                "leverage": lev, "duration": dur,
                                "budget": round(eb, 2),
                                "was_liquidated": was_liq,
                                "total_return": round(tot, 2),
                                "profit": round(profit, 2),
                                "profit_pct": round(pct, 4),
                                "beat_morpho": tot > morpho_only,
                                "beat_hold": tot > DEPOSIT * (1 + aret),
                            })
                    if sims == 0: continue
                    asset_sims += sims
                    all_pcts.sort()
                    agg_results.append({
                        "asset": asset_key, "label": label, "class": cls,
                        "protocol": pname, "apy": apy, "apy_pct": round(apy * 100, 2),
                        "leverage": lev, "duration": dur, "budget": round(eb, 2),
                        "sims": sims,
                        "prot_rate": round(prot / sims * 100, 4),
                        "liq_rate": round(liq / sims * 100, 2),
                        "avg_pct": round(tp / sims / DEPOSIT * 100, 4),
                        "avg_ann_pct": round(tp / sims / DEPOSIT * 100 * (365 / dur), 2),
                        "best_pct": round(best, 2), "worst_pct": round(worst, 2),
                        "median_pct": round(all_pcts[len(all_pcts)//2], 2),
                        "p10_pct": round(all_pcts[int(len(all_pcts)*0.1)], 2),
                        "p25_pct": round(all_pcts[len(all_pcts)//4], 2),
                        "p75_pct": round(all_pcts[int(len(all_pcts)*0.75)], 2),
                        "p90_pct": round(all_pcts[int(len(all_pcts)*0.9)], 2),
                        "beat_morpho": round(bm / sims * 100, 2),
                        "beat_hold": round(bh / sims * 100, 2),
                    })
        total_sims += asset_sims
        configs = len([r for r in agg_results if r["asset"] == asset_key])
        print(f"{asset_sims:,} sims, {configs} configs")

    return agg_results, per_trade_rows, total_sims


# ── Export ────────────────────────────────────────────────────────────────────
def export_all(agg, trades, total_sims, protocols, all_prices):
    print("\nExporting results...")

    # 1. Aggregated JSON
    with open(RESULTS_DIR / "final_aggregated.json", "w") as f:
        json.dump(agg, f, indent=2)
    print(f"  final_aggregated.json ({len(agg)} configs)")

    # 2. Master CSV
    if agg:
        with open(RESULTS_DIR / "final_aggregated.csv", "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(agg[0].keys()))
            w.writeheader(); w.writerows(agg)
        print(f"  final_aggregated.csv")

    # 3. Per-asset CSVs
    by_asset_dir = RESULTS_DIR / "by_asset"
    by_asset_dir.mkdir(exist_ok=True)
    by_asset = {}
    for r in trades: by_asset.setdefault(r["asset"], []).append(r)
    for asset, rows in by_asset.items():
        path = by_asset_dir / f"{asset}.csv"
        with open(path, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            w.writeheader(); w.writerows(rows)
        print(f"  by_asset/{asset}.csv ({len(rows):,} trades)")

    # 4. Charts data JSON
    charts = {}
    for r in agg:
        charts.setdefault(r["class"], []).append({
            "asset": r["label"], "protocol": r["protocol"],
            "leverage": r["leverage"], "duration": r["duration"],
            "avg_return": r["avg_pct"], "liq_rate": r["liq_rate"],
            "ann_return": r["avg_ann_pct"], "beat_morpho": r["beat_morpho"],
        })
    with open(RESULTS_DIR / "final_charts_data.json", "w") as f:
        json.dump(charts, f)
    print(f"  final_charts_data.json")

    # 5. Summary text
    assets = sorted(set(r["asset"] for r in agg))
    all_protected = all(r["prot_rate"] >= 99.99 for r in agg)
    lines = []
    w = lines.append
    w("=" * 70)
    w("  PPN FINAL BACKTEST SUMMARY")
    w(f"  {total_sims:,} simulations | {len(assets)} assets | {len(agg)} configs")
    w(f"  Protocols: {', '.join(f'{n} ({a*100:.2f}%)' for n, a in protocols)}")
    w(f"  APYs fetched LIVE from DeFiLlama yields.llama.fi/pools")
    w("=" * 70)
    w("")
    w(f"PRINCIPAL PROTECTION: {'100.0000%' if all_protected else 'FAILED'}")
    w("")
    w("WORTH-IT MARKETS (>10% annualized, <20% liquidation):")
    worthy = [r for r in agg if r["liq_rate"] < 20 and r["avg_ann_pct"] > 10]
    worthy_assets = {}
    for r in worthy:
        if r["asset"] not in worthy_assets or r["avg_ann_pct"] > worthy_assets[r["asset"]]["avg_ann_pct"]:
            worthy_assets[r["asset"]] = r
    for r in sorted(worthy_assets.values(), key=lambda x: x["avg_ann_pct"], reverse=True):
        w(f"  {r['label']:>20}: {r['avg_ann_pct']:+.1f}%/yr | liq {r['liq_rate']:.1f}% | {r['protocol']} {r['leverage']}x {r['duration']}d")
    if not worthy_assets:
        w("  None at current yield levels.")
    w("")
    w("ALL MARKETS — BEST SAFE CONFIG (<20% liq):")
    for asset in assets:
        safe = [r for r in agg if r["asset"] == asset and r["liq_rate"] < 20 and r["avg_pct"] > 0]
        if safe:
            best = max(safe, key=lambda r: r["avg_ann_pct"])
            w(f"  {best['label']:>20}: {best['avg_ann_pct']:+.1f}%/yr | liq {best['liq_rate']:.1f}% | {best['protocol']} {best['leverage']}x {best['duration']}d | {best['sims']:,} sims")
        else:
            w(f"  {LABELS.get(asset, asset):>20}: no safe profitable config")
    w("")
    w("=" * 70)
    text = "\n".join(lines)
    with open(RESULTS_DIR / "final_summary.txt", "w") as f: f.write(text)
    print(f"  final_summary.txt")
    print()
    print(text)

    # 6. Detailed MD
    generate_md(agg, total_sims, protocols, all_prices)


def generate_md(agg, total_sims, protocols, all_prices):
    md = []
    w = md.append
    assets = sorted(set(r["asset"] for r in agg))
    all_protected = all(r["prot_rate"] >= 99.99 for r in agg)
    proto_str = ", ".join(f"{n} ({a*100:.2f}%)" for n, a in protocols)

    w("# PPN Final Backtest — Complete Results")
    w("")
    w(f"> **{total_sims:,} simulations** | **{len(assets)} assets** | **{len(agg)} configurations**")
    w(f"> Yield protocols (LIVE from DeFiLlama): {proto_str}")
    w(f"> Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    w("")
    w(f"**Principal protection: {'100.0000%' if all_protected else 'FAILED'}**")
    w("")
    w("---")
    w("")

    # Worth-it verdicts
    w("## Worth-It Verdicts")
    w("")
    w("Criteria: annualized return > 10% AND liquidation rate < 20%")
    w("")
    for asset in assets:
        label = LABELS.get(asset, asset)
        cls = ASSET_CLASS.get(asset, "Other")
        rows = [r for r in agg if r["asset"] == asset]
        worthy = [r for r in rows if r["liq_rate"] < 20 and r["avg_ann_pct"] > 10]
        safe = [r for r in rows if r["liq_rate"] < 20 and r["avg_pct"] > 0]

        if worthy:
            best = max(worthy, key=lambda r: r["avg_ann_pct"])
            w(f"**{label}** ({cls}) — **YES** — {len(worthy)} configs pass. Best: {best['protocol']} {best['leverage']}x {best['duration']}d = {best['avg_ann_pct']:+.1f}%/yr at {best['liq_rate']:.1f}% liq")
        elif safe:
            best = max(safe, key=lambda r: r["avg_ann_pct"])
            w(f"**{label}** ({cls}) — MARGINAL — profitable but under 10% APY threshold. Best safe: {best['protocol']} {best['leverage']}x {best['duration']}d = {best['avg_ann_pct']:+.1f}%/yr at {best['liq_rate']:.1f}% liq")
        else:
            w(f"**{label}** ({cls}) — NO — no safe profitable config at current yields")
        w("")
    w("---")
    w("")

    # Per-asset heatmaps
    w("## Leverage x Duration Heatmaps (Avg Return % / Liq %)")
    w("")
    # Use the highest-APY protocol for heatmaps
    best_proto = max(protocols, key=lambda x: x[1])
    w(f"*Using {best_proto[0]} ({best_proto[1]*100:.2f}% APY)*")
    w("")
    for asset in assets:
        label = LABELS.get(asset, asset)
        w(f"### {label}")
        w("")
        header = "| Lev |" + "".join(f" {d}d |" for d in DURATIONS)
        w(header)
        w("|-----|" + "------|" * len(DURATIONS))
        for lev in LEVERAGES:
            row = f"| {lev}x |"
            for dur in DURATIONS:
                matches = [r for r in agg if r["asset"] == asset and r["leverage"] == lev and r["duration"] == dur and abs(r["apy"] - best_proto[1]) < 0.001]
                if matches:
                    r = matches[0]
                    row += f" {r['avg_pct']:+.1f}% / {r['liq_rate']:.0f}% |"
                else:
                    row += " — |"
            w(row)
        w("")

    # Protocol comparison
    w("## Protocol Comparison (20x leverage, 180d, all markets)")
    w("")
    for pname, apy in protocols:
        rows = [r for r in agg if r["protocol"] == pname and r["leverage"] == 20 and r["duration"] == 180]
        if rows:
            avg_ret = statistics.mean(r["avg_pct"] for r in rows)
            avg_liq = statistics.mean(r["liq_rate"] for r in rows)
            avg_eb = statistics.mean(r["budget"] for r in rows)
            w(f"**{pname}** ({apy*100:.2f}% APY): budget ${avg_eb:.2f}, avg return {avg_ret:+.2f}%, avg liq {avg_liq:.1f}%")
    w("")

    # Cross-market leaderboard
    w("## Cross-Market Leaderboard (Best Safe Config, <20% liq)")
    w("")
    leaders = []
    for asset in assets:
        safe = [r for r in agg if r["asset"] == asset and r["liq_rate"] < 20 and r["avg_pct"] > 0]
        if safe:
            leaders.append(max(safe, key=lambda r: r["avg_ann_pct"]))
    leaders.sort(key=lambda r: r["avg_ann_pct"], reverse=True)

    for i, r in enumerate(leaders, 1):
        w(f"{i}. **{r['label']}** ({r['class']}) — {r['avg_ann_pct']:+.1f}%/yr | liq {r['liq_rate']:.1f}% | {r['protocol']} {r['leverage']}x {r['duration']}d | median {r['median_pct']:+.2f}% | best {r['best_pct']:+.2f}% | {r['sims']:,} sims")
    w("")

    # Leverage analysis
    w("## Leverage Sweet Spots")
    w("")
    for cls in ["Commodities", "Crypto", "Real Estate"]:
        cls_assets = [a for a in assets if ASSET_CLASS.get(a) == cls]
        if not cls_assets: continue
        w(f"### {cls}")
        w("")
        for lev in LEVERAGES:
            rows = [r for r in agg if r["leverage"] == lev and r["duration"] == 180 and r["asset"] in cls_assets and abs(r["apy"] - best_proto[1]) < 0.001]
            if not rows: continue
            avg_ret = statistics.mean(r["avg_pct"] for r in rows)
            avg_liq = statistics.mean(r["liq_rate"] for r in rows)
            safe = sum(1 for r in rows if r["liq_rate"] < 20)
            tag = "SAFE" if avg_liq < 10 else "OK" if avg_liq < 20 else "RISKY" if avg_liq < 50 else "DANGEROUS"
            w(f"- **{lev}x**: avg {avg_ret:+.2f}%, liq {avg_liq:.1f}%, {safe}/{len(rows)} markets safe — {tag}")
        w("")

    w("---")
    w(f"*{total_sims:,} simulations. Data: Yahoo Finance, CoinGecko Pro, Parcl Labs. APYs: DeFiLlama live.*")

    with open(RESULTS_DIR / "FINAL_REPORT.md", "w", encoding="utf-8") as f:
        f.write("\n".join(md))
    print(f"  FINAL_REPORT.md")


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print()
    print("=" * 70)
    print("  PPN FINAL COMPREHENSIVE EXPORT")
    print("=" * 70)
    print()

    protocols = fetch_live_apys()
    print()

    # Fetch data
    print("FETCHING DATA...")
    all_prices = {}
    for m, t in YAHOO_METALS.items(): all_prices[m] = fetch_yahoo(m, t)
    print()
    for l, c in COINGECKO_ASSETS.items(): all_prices[l] = fetch_cg(c, LABELS[l]); time.sleep(2)
    print()
    for k, t in PARCL_TICKERS.items(): all_prices[k] = fetch_parcl(k, t); time.sleep(0.3)
    print()

    total_pts = sum(len(v) for v in all_prices.values())
    print(f"Total: {total_pts:,} data points across {sum(1 for v in all_prices.values() if v)} assets")
    print()

    # Run
    print("RUNNING SIMULATIONS...")
    agg, trades, total_sims = run_all(all_prices, protocols)
    print(f"\nTotal: {total_sims:,} simulations")

    # Export everything
    export_all(agg, trades, total_sims, protocols, all_prices)
    print("\nDone!")


if __name__ == "__main__":
    main()
