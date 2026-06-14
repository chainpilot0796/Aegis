"""
Main simulation engine — runs all parameter combinations across historical data.
"""

from .shield_math import calculate_shield_split, settle_shield

YIELD_SCENARIOS = [
    {"name": "Aave V3 (conservative)", "apy": 0.038},
    {"name": "Morpho Steakhouse (mid)", "apy": 0.052},
    {"name": "Moonwell (high)", "apy": 0.061},
    {"name": "Leveraged vault (very high)", "apy": 0.10},
    {"name": "Peak yield (bull)", "apy": 0.15},
]

LEVERAGES = [1, 5, 10, 20, 50, 100]
DURATIONS = [30, 90, 180, 365]
DEPOSIT = 10_000.0


def run_backtest(
    price_data: dict[str, list[dict]],
    quick: bool = False,
) -> tuple[list[dict], list[dict]]:
    """
    Run the full backtest simulation.

    Args:
        price_data: {asset_label: [{timestamp, price}, ...]}
        quick:      If True, only test Gold+BTC, one yield, one leverage, one duration.

    Returns:
        (aggregated_results, per_trade_results)
    """
    if quick:
        assets_to_test = {k: v for k, v in price_data.items() if k in ("gold", "bitcoin")}
        yields = [0.052]
        leverages = [20]
        durations = [90]
    else:
        assets_to_test = price_data
        yields = [s["apy"] for s in YIELD_SCENARIOS]
        leverages = LEVERAGES
        durations = DURATIONS

    aggregated = []
    per_trade = []
    total_sims = 0
    total_protected = 0
    protection_failures = []

    combos = len(assets_to_test) * len(yields) * len(leverages) * len(durations)
    print(f"Running {combos} parameter combinations...\n")

    for asset_label, prices in assets_to_test.items():
        if not prices:
            print(f"  Skipping {asset_label} — no data")
            continue

        price_list = [p["price"] for p in prices]
        date_list = [p["timestamp"] for p in prices]
        n = len(price_list)

        for apy in yields:
            for leverage in leverages:
                for duration_days in durations:
                    duration_years = duration_days / 365.0

                    split = calculate_shield_split(DEPOSIT, apy, duration_years)
                    exposure_budget = split["exposure_budget"]

                    # Per-combo accumulators
                    sim_count = 0
                    protected_count = 0
                    liquidated_count = 0
                    total_profit = 0.0
                    best_ret = float("-inf")
                    worst_ret = float("inf")
                    beat_morpho = 0
                    beat_hold = 0
                    all_returns = []

                    max_entry = n - duration_days
                    if max_entry <= 0:
                        continue

                    for i in range(max_entry):
                        entry_price = price_list[i]
                        exit_price = price_list[i + duration_days]

                        if not entry_price or not exit_price or entry_price <= 0 or exit_price <= 0:
                            continue

                        # Intra-period prices for liquidation check
                        period_prices = price_list[i + 1 : i + duration_days + 1]

                        result = settle_shield(
                            deposit=DEPOSIT,
                            exposure_budget=exposure_budget,
                            leverage=leverage,
                            entry_price=entry_price,
                            exit_price=exit_price,
                            apy_decimal=apy,
                            duration_days=duration_days,
                            prices_during_period=period_prices,
                        )

                        sim_count += 1
                        total_sims += 1
                        pct = result["profit_percent"]

                        if result["principal_protected"]:
                            protected_count += 1
                            total_protected += 1
                        else:
                            protection_failures.append(
                                {
                                    "asset": asset_label,
                                    "apy": apy,
                                    "leverage": leverage,
                                    "duration": duration_days,
                                    "entry_date": date_list[i],
                                    "exit_date": date_list[i + duration_days],
                                    "entry_price": entry_price,
                                    "exit_price": exit_price,
                                    "total_return": result["total_return"],
                                }
                            )

                        if result["was_liquidated"]:
                            liquidated_count += 1
                        total_profit += result["profit"]
                        best_ret = max(best_ret, pct)
                        worst_ret = min(worst_ret, pct)
                        if result["total_return"] > result["morpho_only_return"]:
                            beat_morpho += 1
                        if result["total_return"] > result["direct_hold_return"]:
                            beat_hold += 1
                        all_returns.append(pct)

                        # Store per-trade data
                        per_trade.append(
                            {
                                "asset": asset_label,
                                "entry_date": date_list[i],
                                "exit_date": date_list[i + duration_days],
                                "entry_price": round(entry_price, 6),
                                "exit_price": round(exit_price, 6),
                                "asset_return_pct": round(result["asset_return_pct"], 4),
                                "apy": apy,
                                "leverage": leverage,
                                "duration_days": duration_days,
                                "exposure_budget": round(exposure_budget, 2),
                                "was_liquidated": result["was_liquidated"],
                                "position_closeout": round(result["position_closeout"], 2),
                                "total_return": round(result["total_return"], 2),
                                "profit": round(result["profit"], 2),
                                "profit_pct": round(pct, 4),
                                "beat_morpho": result["total_return"] > result["morpho_only_return"],
                                "beat_direct_hold": result["total_return"] > result["direct_hold_return"],
                            }
                        )

                    if sim_count == 0:
                        continue

                    all_returns.sort()
                    p25 = all_returns[len(all_returns) // 4] if all_returns else 0
                    median = all_returns[len(all_returns) // 2] if all_returns else 0
                    p75 = all_returns[int(len(all_returns) * 0.75)] if all_returns else 0

                    prot_rate = protected_count / sim_count * 100
                    liq_rate = liquidated_count / sim_count * 100
                    avg_pct = (total_profit / sim_count) / DEPOSIT * 100

                    row = {
                        "asset": asset_label,
                        "apy": apy * 100,
                        "leverage": leverage,
                        "duration_days": duration_days,
                        "deposit": DEPOSIT,
                        "exposure_budget": round(exposure_budget, 2),
                        "total_simulations": sim_count,
                        "principal_protection_rate": round(prot_rate, 4),
                        "liquidation_rate": round(liq_rate, 2),
                        "avg_profit": round(total_profit / sim_count, 2),
                        "avg_profit_pct": round(avg_pct, 4),
                        "best_return": round(best_ret, 2),
                        "worst_return": round(worst_ret, 2),
                        "median_return": round(median, 2),
                        "p25_return": round(p25, 2),
                        "p75_return": round(p75, 2),
                        "beat_morpho_rate": round(beat_morpho / sim_count * 100, 2),
                        "beat_direct_hold_rate": round(beat_hold / sim_count * 100, 2),
                    }
                    aggregated.append(row)

                    # Progress line
                    print(
                        f"  {asset_label:>8} | {apy*100:5.1f}% | {leverage:>3}x | {duration_days:>3}d "
                        f"| {sim_count:>5} sims | {prot_rate:>8.4f}% protected "
                        f"| {liq_rate:5.1f}% liq | avg {avg_pct:+.2f}%"
                    )

                    if total_sims % 50000 == 0 and total_sims > 0:
                        print(f"\n  ... {total_sims:,} simulations completed ...\n")

    print(f"\n{'='*70}")
    if protection_failures:
        print(f"  PRINCIPAL PROTECTION FAILED IN {len(protection_failures)} SIMULATIONS")
        for f in protection_failures[:5]:
            print(f"    {f}")
    else:
        pct_str = f"{total_protected / total_sims * 100:.4f}" if total_sims else "N/A"
        print(f"  PRINCIPAL PROTECTED IN {total_protected:,} / {total_sims:,} SIMULATIONS ({pct_str}%)")
    print(f"{'='*70}\n")

    return aggregated, per_trade
