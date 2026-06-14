"""
Exact PPN (Principal Protected Note) math using zero-coupon bond pricing.
No approximations. No rounding in intermediate calculations.
"""


def calculate_shield_split(deposit: float, apy_decimal: float, duration_years: float) -> dict:
    """
    Calculate the exact shield split using TradFi zero-coupon bond pricing.

    Present Value = Future Value / (1 + rate) ^ time

    This guarantees that `to_yield_vault` grows to EXACTLY `deposit` at maturity.

    Args:
        deposit:        Amount deposited (e.g., 10000)
        apy_decimal:    Annual yield rate as decimal (e.g., 0.06 for 6%)
        duration_years: Duration in years (e.g., 0.5 for 6 months)

    Returns:
        dict with deposit, to_yield_vault, exposure_budget
    """
    present_value = deposit / ((1 + apy_decimal) ** duration_years)
    exposure_budget = deposit - present_value

    return {
        "deposit": deposit,
        "to_yield_vault": present_value,
        "exposure_budget": exposure_budget,
    }


def settle_shield(
    deposit: float,
    exposure_budget: float,
    leverage: float,
    entry_price: float,
    exit_price: float,
    apy_decimal: float,
    duration_days: int,
    prices_during_period: list | None = None,
) -> dict:
    """
    Calculate the settlement of a shield at maturity.

    Protocol mechanics:
      Day 0: User deposits $D. Protocol splits:
        $PV → Morpho (grows back to $D at maturity via yield)
        $EB → opens leveraged position (margin)

      Maturity:
        Morpho returns: $D (the PV grew back exactly)
        Position returns: max(0, EB + PnL) if not liquidated, else $0

      Total = $D + position_closeout

    Args:
        deposit:               Original deposit
        exposure_budget:       Amount used as margin
        leverage:              Leverage multiplier (1, 5, 20, 50, 100)
        entry_price:           Asset price when shield was opened
        exit_price:            Asset price at settlement
        apy_decimal:           APY used (for comparison calcs)
        duration_days:         Duration in days
        prices_during_period:  List of prices during the holding period (for intra-period liquidation check)

    Returns:
        dict with full settlement details
    """
    duration_years = duration_days / 365.0
    exposure = exposure_budget * leverage
    asset_return = (exit_price - entry_price) / entry_price

    # Liquidation threshold: loss >= margin means wipeout
    liquidation_return = -1.0 / leverage
    liquidation_price = entry_price * (1.0 + liquidation_return)

    # Check for intra-period liquidation (price dipped below liq level at ANY point)
    was_liquidated = False
    if prices_during_period is not None:
        for p in prices_during_period:
            if p <= liquidation_price:
                was_liquidated = True
                break
    else:
        # Fallback: only check exit price
        if asset_return <= liquidation_return:
            was_liquidated = True

    # Position closeout
    if was_liquidated:
        position_closeout = 0.0
    else:
        position_pnl = exposure * asset_return
        position_closeout = max(0.0, exposure_budget + position_pnl)

    # Morpho rebuilt the full deposit via zero-coupon growth
    total_return = deposit + position_closeout
    profit = total_return - deposit
    profit_percent = (profit / deposit) * 100.0
    principal_protected = total_return >= deposit - 0.01  # tiny float tolerance

    # Comparisons
    morpho_only_return = deposit + (deposit * apy_decimal * duration_years)
    direct_hold_return = deposit * (1.0 + asset_return)

    return {
        "deposit": deposit,
        "exposure_budget": exposure_budget,
        "leverage": leverage,
        "entry_price": entry_price,
        "exit_price": exit_price,
        "asset_return_pct": asset_return * 100.0,
        "exposure": exposure,
        "position_closeout": position_closeout,
        "was_liquidated": was_liquidated,
        "total_return": total_return,
        "profit": profit,
        "profit_percent": profit_percent,
        "principal_protected": principal_protected,
        "morpho_only_return": morpho_only_return,
        "direct_hold_return": direct_hold_return,
    }
