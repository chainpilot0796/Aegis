# PPN Ultimate Backtest Report

> **Complete analysis of Principal-Protected Notes across ALL markets.**
> Every asset × every yield protocol × every leverage × every duration.
> Real historical data — no simulations, no approximations.

| Metric | Value |
|--------|-------|
| Total simulations | **12,523,401** |
| Principal protection | **100.0000%** |
| Markets tested | **25** |
| Asset classes | Commodities, Crypto, Real Estate |
| Yield protocols (live from DeFiLlama) | Aave V3 (2.46%), Morpho Steakhouse (3.62%), Moonwell (3.43%) |
| Leverages | 1x, 2x, 3x, 5x, 10x, 15x, 20x, 30x, 50x, 75x, 100x |
| Durations | 30d, 60d, 90d, 120d, 180d, 270d, 365d |
| Deposit | $10,000 per sim |

### Data Coverage

| Asset | Source | Data Points | Date Range |
|-------|--------|-------------|-----------|
| Bitcoin | CoinGecko | 4,702 | 2013-04-28 to 2026-03-14 |
| Ethereum | CoinGecko | 3,872 | 2015-08-07 to 2026-03-14 |
| Gold (XAU) | Yahoo Finance | 4,072 | 2010-01-04 to 2026-03-13 |
| Atlanta | Parcl Labs | 1,827 | 2021-03-14 to 2026-03-14 |
| Austin | Parcl Labs | 1,827 | 2021-03-14 to 2026-03-14 |
| Boston | Parcl Labs | 1,827 | 2021-03-14 to 2026-03-14 |
| Brooklyn | Parcl Labs | 1,827 | 2021-03-14 to 2026-03-14 |
| Charlotte | Parcl Labs | 1,827 | 2021-03-14 to 2026-03-14 |
| Chicago | Parcl Labs | 1,827 | 2021-03-14 to 2026-03-14 |
| Washington DC | Parcl Labs | 1,827 | 2021-03-14 to 2026-03-14 |
| Denver | Parcl Labs | 1,827 | 2021-03-14 to 2026-03-14 |
| Los Angeles | Parcl Labs | 1,827 | 2021-03-14 to 2026-03-14 |
| Las Vegas | Parcl Labs | 1,827 | 2021-03-14 to 2026-03-14 |
| Miami | Parcl Labs | 1,827 | 2021-03-14 to 2026-03-14 |
| Miami Beach | Parcl Labs | 1,827 | 2021-03-14 to 2026-03-14 |
| Nashville | Parcl Labs | 1,827 | 2021-03-14 to 2026-03-14 |
| New York City | Parcl Labs | 1,827 | 2021-03-14 to 2026-03-14 |
| Pittsburgh | Parcl Labs | 1,827 | 2021-03-14 to 2026-03-14 |
| San Diego | Parcl Labs | 1,827 | 2021-03-14 to 2026-03-14 |
| San Francisco | Parcl Labs | 1,827 | 2021-03-14 to 2026-03-14 |
| Tampa | Parcl Labs | 1,827 | 2021-03-14 to 2026-03-14 |
| US National | Parcl Labs | 1,827 | 2021-03-14 to 2026-03-14 |
| Silver (XAG) | Yahoo Finance | 4,072 | 2010-01-04 to 2026-03-13 |
| Solana | CoinGecko | 2,164 | 2020-04-11 to 2026-03-14 |
| XRP | CoinGecko | 4,601 | 2013-08-04 to 2026-03-14 |

---

## 1. THE VERDICT: Is Each Market Worth It for PPN?

**Criteria:** Average return must beat 10% APY equivalent AND liquidation rate must be < 20%.

### Worth-It Matrix

| Verdict | Market | Class | Best Config | Ann. Return | Liq Rate | Worthy Configs |
|---------|--------|-------|------------|-------------|----------|---------------|
| **YES** | **Solana** | Crypto | Morpho Steakhouse 1x 365d | +44.5% | 0.0% | 8/231 |
| **YES** | **XRP** | Crypto | Morpho Steakhouse 1x 365d | +28.7% | 0.0% | 7/231 |
| **YES** | **Ethereum** | Crypto | Morpho Steakhouse 1x 365d | +23.0% | 0.0% | 7/231 |
| **YES** | **Bitcoin** | Crypto | Morpho Steakhouse 2x 270d | +10.4% | 19.9% | 1/231 |
| MARGINAL | **Las Vegas** | Real Estate | Morpho Steakhouse 20x 365d | +7.2% | 17.0% | 0/231 |
| MARGINAL | **Charlotte** | Real Estate | Morpho Steakhouse 15x 365d | +6.5% | 10.2% | 0/231 |
| MARGINAL | **Tampa** | Real Estate | Morpho Steakhouse 15x 365d | +6.5% | 10.2% | 0/231 |
| MARGINAL | **Miami** | Real Estate | Morpho Steakhouse 10x 365d | +6.3% | 8.6% | 0/231 |
| MARGINAL | **US National** | Real Estate | Morpho Steakhouse 50x 90d | +6.0% | 17.8% | 0/231 |
| MARGINAL | **Nashville** | Real Estate | Morpho Steakhouse 15x 365d | +5.8% | 9.2% | 0/231 |
| MARGINAL | **San Diego** | Real Estate | Morpho Steakhouse 15x 365d | +5.8% | 10.2% | 0/231 |
| MARGINAL | **Gold (XAU)** | Commodities | Morpho Steakhouse 5x 365d | +5.7% | 9.9% | 0/231 |
| MARGINAL | **Miami Beach** | Real Estate | Morpho Steakhouse 10x 365d | +5.3% | 4.7% | 0/231 |
| MARGINAL | **New York City** | Real Estate | Morpho Steakhouse 15x 270d | +5.0% | 18.4% | 0/231 |
| MARGINAL | **Silver (XAG)** | Commodities | Morpho Steakhouse 3x 365d | +4.6% | 13.6% | 0/231 |
| MARGINAL | **Chicago** | Real Estate | Morpho Steakhouse 15x 90d | +4.2% | 19.2% | 0/231 |
| MARGINAL | **Los Angeles** | Real Estate | Morpho Steakhouse 15x 365d | +4.2% | 18.0% | 0/231 |
| MARGINAL | **Brooklyn** | Real Estate | Morpho Steakhouse 10x 270d | +4.1% | 15.5% | 0/231 |
| MARGINAL | **Pittsburgh** | Real Estate | Morpho Steakhouse 5x 270d | +4.1% | 14.8% | 0/231 |
| MARGINAL | **Atlanta** | Real Estate | Morpho Steakhouse 30x 30d | +4.0% | 16.8% | 0/231 |
| MARGINAL | **Boston** | Real Estate | Morpho Steakhouse 5x 365d | +3.9% | 0.0% | 0/231 |
| MARGINAL | **Denver** | Real Estate | Morpho Steakhouse 20x 60d | +3.8% | 14.8% | 0/231 |
| MARGINAL | **San Francisco** | Real Estate | Morpho Steakhouse 1x 30d | +3.5% | 0.0% | 0/231 |
| MARGINAL | **Austin** | Real Estate | Morpho Steakhouse 1x 30d | +3.5% | 0.0% | 0/231 |
| MARGINAL | **Washington DC** | Real Estate | Morpho Steakhouse 1x 30d | +3.5% | 0.0% | 0/231 |

**Summary:** 4 markets WORTH IT, 21 marginal, 0 not worth it

---

## 2. Detailed Breakdown by Asset Class

### Commodities

#### Gold (XAU)

**Price:** $1,117.70 -> $5,061.70 (+352.9%) | High: $5,318.40 | Low: $1,050.80
**Chart:** `    ▁  ▁                  ▁▁▁▁▁▁▁▁▁▁▂▂▃▄`
**Data:** 4072 days (2010-01-04 to 2026-03-13)

**Leverage × Duration Heatmap** (Morpho 5.2% APY — avg return % | liq %)

| Lev | 30d | 60d | 90d | 120d | 180d | 270d | 365d |
|-----|------|------|------|------|------|------|------|
| 1x | — | — | — | — | — | — | — |
| 2x | — | — | — | — | — | — | — |
| 3x | — | — | — | — | — | — | — |
| 5x | — | — | — | — | — | — | — |
| 10x | — | — | — | — | — | — | — |
| 15x | — | — | — | — | — | — | — |
| 20x | — | — | — | — | — | — | — |
| 30x | — | — | — | — | — | — | — |
| 50x | — | — | — | — | — | — | — |
| 75x | — | — | — | — | — | — | — |
| 100x | — | — | — | — | — | — | — |

**Protocol Comparison** (at 5x / 365d — best safe config)

| Protocol | APY | Budget | Avg Return | Ann. Return | Liq % | Beat Yield | P25 | Median | P75 |
|----------|-----|--------|-----------|-------------|-------|-----------|-----|--------|-----|
| Aave V3 | 2.5% | $240 | +3.94% | +3.9% | 9.9% | 65.6% | +2.04% | +3.24% | +5.70% |
| Morpho Steakhouse | 3.6% | $349 | +5.74% | +5.7% | 9.9% | 64.8% | +2.97% | +4.71% | +8.30% |
| Moonwell | 3.4% | $332 | +5.45% | +5.5% | 9.9% | 65.0% | +2.82% | +4.47% | +7.87% |

**No configs pass the worth-it test** (ann. return > 10% AND liq < 20%)
*Best safe configs (liq < 20%, positive return):*

| Protocol | Lev | Dur | Avg Ret | Ann. Ret | Liq % | Median |
|----------|-----|-----|---------|----------|-------|--------|
| Morpho Steakhouse | 5x | 365d | +5.74% | +5.7% | 9.9% | +4.71% |
| Moonwell | 5x | 365d | +5.45% | +5.5% | 9.9% | +4.47% |
| Morpho Steakhouse | 5x | 270d | +3.89% | +5.3% | 5.8% | +3.27% |
| Morpho Steakhouse | 10x | 120d | +1.70% | +5.2% | 19.7% | +1.65% |
| Moonwell | 5x | 270d | +3.69% | +5.0% | 5.8% | +3.10% |
| Moonwell | 10x | 120d | +1.61% | +4.9% | 19.7% | +1.57% |
| Morpho Steakhouse | 3x | 365d | +4.83% | +4.8% | 0.0% | +4.23% |
| Morpho Steakhouse | 10x | 90d | +1.18% | +4.8% | 14.5% | +1.17% |
| Morpho Steakhouse | 5x | 180d | +2.35% | +4.8% | 3.9% | +2.14% |
| Moonwell | 3x | 365d | +4.58% | +4.6% | 0.0% | +4.01% |

**VERDICT: MARGINAL** — Profitable with <20% liq but doesn't beat 10% APY threshold. Best safe: Morpho Steakhouse 5x 365d -> +5.7%/yr

---

#### Silver (XAG)

**Price:** $17.44 -> $81.34 (+366.4%) | High: $115.08 | Low: $11.73
**Chart:** `   ▁▂▁▁▁▁                           ▁▁▁▂`
**Data:** 4072 days (2010-01-04 to 2026-03-13)

**Leverage × Duration Heatmap** (Morpho 5.2% APY — avg return % | liq %)

| Lev | 30d | 60d | 90d | 120d | 180d | 270d | 365d |
|-----|------|------|------|------|------|------|------|
| 1x | — | — | — | — | — | — | — |
| 2x | — | — | — | — | — | — | — |
| 3x | — | — | — | — | — | — | — |
| 5x | — | — | — | — | — | — | — |
| 10x | — | — | — | — | — | — | — |
| 15x | — | — | — | — | — | — | — |
| 20x | — | — | — | — | — | — | — |
| 30x | — | — | — | — | — | — | — |
| 50x | — | — | — | — | — | — | — |
| 75x | — | — | — | — | — | — | — |
| 100x | — | — | — | — | — | — | — |

**Protocol Comparison** (at 3x / 365d — best safe config)

| Protocol | APY | Budget | Avg Return | Ann. Return | Liq % | Beat Yield | P25 | Median | P75 |
|----------|-----|--------|-----------|-------------|-------|-----------|-----|--------|-----|
| Aave V3 | 2.5% | $240 | +3.15% | +3.1% | 13.6% | 49.9% | +1.01% | +2.45% | +4.36% |
| Morpho Steakhouse | 3.6% | $349 | +4.59% | +4.6% | 13.6% | 49.6% | +1.47% | +3.56% | +6.35% |
| Moonwell | 3.4% | $332 | +4.36% | +4.4% | 13.6% | 49.7% | +1.40% | +3.38% | +6.02% |

**No configs pass the worth-it test** (ann. return > 10% AND liq < 20%)
*Best safe configs (liq < 20%, positive return):*

| Protocol | Lev | Dur | Avg Ret | Ann. Ret | Liq % | Median |
|----------|-----|-----|---------|----------|-------|--------|
| Morpho Steakhouse | 3x | 365d | +4.59% | +4.6% | 13.6% | +3.56% |
| Morpho Steakhouse | 3x | 270d | +3.37% | +4.5% | 7.9% | +2.48% |
| Morpho Steakhouse | 5x | 120d | +1.49% | +4.5% | 15.6% | +1.21% |
| Morpho Steakhouse | 3x | 180d | +2.16% | +4.4% | 6.1% | +1.68% |
| Morpho Steakhouse | 5x | 90d | +1.08% | +4.4% | 11.7% | +0.90% |
| Moonwell | 3x | 365d | +4.36% | +4.4% | 13.6% | +3.38% |
| Morpho Steakhouse | 2x | 365d | +4.34% | +4.3% | 0.0% | +3.67% |
| Moonwell | 3x | 270d | +3.20% | +4.3% | 7.9% | +2.36% |
| Morpho Steakhouse | 2x | 270d | +3.19% | +4.3% | 0.0% | +2.59% |
| Moonwell | 5x | 120d | +1.41% | +4.3% | 15.6% | +1.15% |

**VERDICT: MARGINAL** — Profitable with <20% liq but doesn't beat 10% APY threshold. Best safe: Morpho Steakhouse 3x 365d -> +4.6%/yr

---

### Crypto

#### Bitcoin

**Price:** $135.30 -> $70,965.28 (+52350.3%) | High: $124,773.51 | Low: $67.81
**Chart:** `                        ▂▃▃▃▂▁▁▁▂▂▄▄▅▆▇█`
**Data:** 4702 days (2013-04-28 to 2026-03-14)

**Leverage × Duration Heatmap** (Morpho 5.2% APY — avg return % | liq %)

| Lev | 30d | 60d | 90d | 120d | 180d | 270d | 365d |
|-----|------|------|------|------|------|------|------|
| 1x | — | — | — | — | — | — | — |
| 2x | — | — | — | — | — | — | — |
| 3x | — | — | — | — | — | — | — |
| 5x | — | — | — | — | — | — | — |
| 10x | — | — | — | — | — | — | — |
| 15x | — | — | — | — | — | — | — |
| 20x | — | — | — | — | — | — | — |
| 30x | — | — | — | — | — | — | — |
| 50x | — | — | — | — | — | — | — |
| 75x | — | — | — | — | — | — | — |
| 100x | — | — | — | — | — | — | — |

**Protocol Comparison** (at 2x / 270d — best safe config)

| Protocol | APY | Budget | Avg Return | Ann. Return | Liq % | Beat Yield | P25 | Median | P75 |
|----------|-----|--------|-----------|-------------|-------|-----------|-----|--------|-----|
| Aave V3 | 2.5% | $178 | +5.27% | +7.1% | 19.9% | 69.7% | +0.78% | +3.51% | +6.08% |
| Morpho Steakhouse | 3.6% | $260 | +7.69% | +10.4% | 19.9% | 69.6% | +1.14% | +5.11% | +8.87% |
| Moonwell | 3.4% | $246 | +7.29% | +9.9% | 19.9% | 69.6% | +1.08% | +4.85% | +8.41% |

**Configs that PASS the worth-it test** (ann. return > 10% AND liq < 20%):

| Protocol | Lev | Dur | Budget | Avg Ret | Ann. Ret | Liq % | Median | Best | Worst | Beat Morpho |
|----------|-----|-----|--------|---------|----------|-------|--------|------|-------|------------|
| Morpho Steakhouse | 2x | 270d | $260 | +7.69% | +10.4% | 19.9% | +5.11% | +97.82% | +0.00% | 69.6% |

**VERDICT: YES** — 1 configs deliver >10% annualized with <20% liquidation. Best: Morpho Steakhouse 2x 270d -> +10.4%/yr

---

#### Ethereum

**Price:** $2.83 -> $2,093.01 (+73815.5%) | High: $4,829.23 | Low: $0.43
**Chart:** `         ▁▁          ▃▄▆█▅▃▃▂▃▃▃▄▆▆▅▆▃▆▆`
**Data:** 3872 days (2015-08-07 to 2026-03-14)

**Leverage × Duration Heatmap** (Morpho 5.2% APY — avg return % | liq %)

| Lev | 30d | 60d | 90d | 120d | 180d | 270d | 365d |
|-----|------|------|------|------|------|------|------|
| 1x | — | — | — | — | — | — | — |
| 2x | — | — | — | — | — | — | — |
| 3x | — | — | — | — | — | — | — |
| 5x | — | — | — | — | — | — | — |
| 10x | — | — | — | — | — | — | — |
| 15x | — | — | — | — | — | — | — |
| 20x | — | — | — | — | — | — | — |
| 30x | — | — | — | — | — | — | — |
| 50x | — | — | — | — | — | — | — |
| 75x | — | — | — | — | — | — | — |
| 100x | — | — | — | — | — | — | — |

**Protocol Comparison** (at 1x / 365d — best safe config)

| Protocol | APY | Budget | Avg Return | Ann. Return | Liq % | Beat Yield | P25 | Median | P75 |
|----------|-----|--------|-----------|-------------|-------|-----------|-----|--------|-----|
| Aave V3 | 2.5% | $240 | +15.81% | +15.8% | 0.0% | 63.9% | +1.86% | +3.77% | +16.39% |
| Morpho Steakhouse | 3.6% | $349 | +23.02% | +23.0% | 0.0% | 63.5% | +2.71% | +5.48% | +23.87% |
| Moonwell | 3.4% | $332 | +21.85% | +21.9% | 0.0% | 63.6% | +2.57% | +5.21% | +22.65% |

**Configs that PASS the worth-it test** (ann. return > 10% AND liq < 20%):

| Protocol | Lev | Dur | Budget | Avg Ret | Ann. Ret | Liq % | Median | Best | Worst | Beat Morpho |
|----------|-----|-----|--------|---------|----------|-------|--------|------|-------|------------|
| Morpho Steakhouse | 1x | 365d | $349 | +23.02% | +23.0% | 0.0% | +5.48% | +524.39% | +0.28% | 63.5% |
| Moonwell | 1x | 365d | $332 | +21.85% | +21.9% | 0.0% | +5.21% | +497.72% | +0.27% | 63.6% |
| Aave V3 | 1x | 365d | $240 | +15.81% | +15.8% | 0.0% | +3.77% | +360.12% | +0.20% | 63.9% |
| Morpho Steakhouse | 1x | 270d | $260 | +10.64% | +14.4% | 0.0% | +3.50% | +147.21% | +0.33% | 70.2% |
| Moonwell | 1x | 270d | $246 | +10.10% | +13.7% | 0.0% | +3.32% | +139.69% | +0.31% | 70.3% |
| Morpho Steakhouse | 2x | 120d | $116 | +3.40% | +10.3% | 15.6% | +1.48% | +80.43% | +0.00% | 57.2% |
| Morpho Steakhouse | 1x | 180d | $174 | +4.95% | +10.0% | 0.0% | +2.22% | +87.26% | +0.27% | 62.9% |

**VERDICT: YES** — 7 configs deliver >10% annualized with <20% liquidation. Best: Morpho Steakhouse 1x 365d -> +23.0%/yr

---

#### Solana

**Price:** $0.96 -> $88.12 (+9101.8%) | High: $262.56 | Low: $0.51
**Chart:** `       ▁▁▁▆▇▅▂▃▁▁▁      ▁▃▄▆▆▆▄▇▇▅▅▅▆█▄▅`
**Data:** 2164 days (2020-04-11 to 2026-03-14)

**Leverage × Duration Heatmap** (Morpho 5.2% APY — avg return % | liq %)

| Lev | 30d | 60d | 90d | 120d | 180d | 270d | 365d |
|-----|------|------|------|------|------|------|------|
| 1x | — | — | — | — | — | — | — |
| 2x | — | — | — | — | — | — | — |
| 3x | — | — | — | — | — | — | — |
| 5x | — | — | — | — | — | — | — |
| 10x | — | — | — | — | — | — | — |
| 15x | — | — | — | — | — | — | — |
| 20x | — | — | — | — | — | — | — |
| 30x | — | — | — | — | — | — | — |
| 50x | — | — | — | — | — | — | — |
| 75x | — | — | — | — | — | — | — |
| 100x | — | — | — | — | — | — | — |

**Protocol Comparison** (at 1x / 365d — best safe config)

| Protocol | APY | Budget | Avg Return | Ann. Return | Liq % | Beat Yield | P25 | Median | P75 |
|----------|-----|--------|-----------|-------------|-------|-----------|-----|--------|-----|
| Aave V3 | 2.5% | $240 | +30.55% | +30.6% | 0.0% | 62.1% | +1.45% | +3.79% | +17.47% |
| Morpho Steakhouse | 3.6% | $349 | +44.49% | +44.5% | 0.0% | 61.8% | +2.10% | +5.53% | +25.44% |
| Moonwell | 3.4% | $332 | +42.23% | +42.2% | 0.0% | 61.9% | +2.00% | +5.24% | +24.15% |

**Configs that PASS the worth-it test** (ann. return > 10% AND liq < 20%):

| Protocol | Lev | Dur | Budget | Avg Ret | Ann. Ret | Liq % | Median | Best | Worst | Beat Morpho |
|----------|-----|-----|--------|---------|----------|-------|--------|------|-------|------------|
| Morpho Steakhouse | 1x | 365d | $349 | +44.49% | +44.5% | 0.0% | +5.53% | +624.68% | +0.18% | 61.8% |
| Moonwell | 1x | 365d | $332 | +42.23% | +42.2% | 0.0% | +5.24% | +592.91% | +0.17% | 61.9% |
| Aave V3 | 1x | 365d | $240 | +30.55% | +30.6% | 0.0% | +3.79% | +428.99% | +0.12% | 62.1% |
| Morpho Steakhouse | 1x | 270d | $260 | +17.51% | +23.7% | 0.0% | +3.77% | +330.10% | +0.18% | 61.5% |
| Moonwell | 1x | 270d | $246 | +16.62% | +22.5% | 0.0% | +3.58% | +313.24% | +0.17% | 61.7% |
| Aave V3 | 1x | 270d | $178 | +12.01% | +16.2% | 0.0% | +2.59% | +226.36% | +0.13% | 62.2% |
| Morpho Steakhouse | 1x | 180d | $174 | +5.25% | +10.7% | 0.0% | +2.28% | +58.54% | +0.28% | 57.8% |
| Moonwell | 1x | 180d | $165 | +4.98% | +10.1% | 0.0% | +2.16% | +55.54% | +0.26% | 57.8% |

**VERDICT: YES** — 8 configs deliver >10% annualized with <20% liquidation. Best: Morpho Steakhouse 1x 365d -> +44.5%/yr

---

#### XRP

**Price:** $0.01 -> $1.40 (+23708.8%) | High: $3.56 | Low: $0.00
**Chart:** `              ▇▂        ▁▁▂▂▁▁ ▁▁▁▁▁▆▅█▅`
**Data:** 4601 days (2013-08-04 to 2026-03-14)

**Leverage × Duration Heatmap** (Morpho 5.2% APY — avg return % | liq %)

| Lev | 30d | 60d | 90d | 120d | 180d | 270d | 365d |
|-----|------|------|------|------|------|------|------|
| 1x | — | — | — | — | — | — | — |
| 2x | — | — | — | — | — | — | — |
| 3x | — | — | — | — | — | — | — |
| 5x | — | — | — | — | — | — | — |
| 10x | — | — | — | — | — | — | — |
| 15x | — | — | — | — | — | — | — |
| 20x | — | — | — | — | — | — | — |
| 30x | — | — | — | — | — | — | — |
| 50x | — | — | — | — | — | — | — |
| 75x | — | — | — | — | — | — | — |
| 100x | — | — | — | — | — | — | — |

**Protocol Comparison** (at 1x / 365d — best safe config)

| Protocol | APY | Budget | Avg Return | Ann. Return | Liq % | Beat Yield | P25 | Median | P75 |
|----------|-----|--------|-----------|-------------|-------|-----------|-----|--------|-----|
| Aave V3 | 2.5% | $240 | +19.74% | +19.7% | 0.0% | 54.3% | +1.67% | +2.74% | +6.66% |
| Morpho Steakhouse | 3.6% | $349 | +28.74% | +28.7% | 0.0% | 53.9% | +2.43% | +3.99% | +9.70% |
| Moonwell | 3.4% | $332 | +27.28% | +27.3% | 0.0% | 53.9% | +2.31% | +3.78% | +9.21% |

**Configs that PASS the worth-it test** (ann. return > 10% AND liq < 20%):

| Protocol | Lev | Dur | Budget | Avg Ret | Ann. Ret | Liq % | Median | Best | Worst | Beat Morpho |
|----------|-----|-----|--------|---------|----------|-------|--------|------|-------|------------|
| Morpho Steakhouse | 1x | 365d | $349 | +28.74% | +28.7% | 0.0% | +3.99% | +1867.03% | +0.37% | 53.9% |
| Moonwell | 1x | 365d | $332 | +27.28% | +27.3% | 0.0% | +3.78% | +1772.08% | +0.35% | 53.9% |
| Aave V3 | 1x | 365d | $240 | +19.74% | +19.7% | 0.0% | +2.74% | +1282.16% | +0.26% | 54.3% |
| Morpho Steakhouse | 1x | 270d | $260 | +10.15% | +13.7% | 0.0% | +2.85% | +324.26% | +0.23% | 53.0% |
| Moonwell | 1x | 270d | $246 | +9.63% | +13.0% | 0.0% | +2.70% | +307.69% | +0.21% | 53.1% |
| Morpho Steakhouse | 2x | 120d | $116 | +3.69% | +11.2% | 14.7% | +1.19% | +138.20% | +0.00% | 50.2% |
| Moonwell | 2x | 120d | $110 | +3.50% | +10.6% | 14.7% | +1.13% | +131.09% | +0.00% | 50.2% |

**VERDICT: YES** — 7 configs deliver >10% annualized with <20% liquidation. Best: Morpho Steakhouse 1x 365d -> +28.7%/yr

---

### Real Estate

#### Atlanta

**Price:** $234.17 -> $273.41 (+16.8%) | High: $302.11 | Low: $234.17
**Chart:** ` ▁▃▄▃▂▃▄▃▅▇▇▅▆▅▄▂▅▅▅▇▆▆▆▄▆▇█▇▆▆▅▃▆▇▆▆▅▄▅`
**Data:** 1827 days (2021-03-14 to 2026-03-14)

**Leverage × Duration Heatmap** (Morpho 5.2% APY — avg return % | liq %)

| Lev | 30d | 60d | 90d | 120d | 180d | 270d | 365d |
|-----|------|------|------|------|------|------|------|
| 1x | — | — | — | — | — | — | — |
| 2x | — | — | — | — | — | — | — |
| 3x | — | — | — | — | — | — | — |
| 5x | — | — | — | — | — | — | — |
| 10x | — | — | — | — | — | — | — |
| 15x | — | — | — | — | — | — | — |
| 20x | — | — | — | — | — | — | — |
| 30x | — | — | — | — | — | — | — |
| 50x | — | — | — | — | — | — | — |
| 75x | — | — | — | — | — | — | — |
| 100x | — | — | — | — | — | — | — |

**Protocol Comparison** (at 30x / 30d — best safe config)

| Protocol | APY | Budget | Avg Return | Ann. Return | Liq % | Beat Yield | P25 | Median | P75 |
|----------|-----|--------|-----------|-------------|-------|-----------|-----|--------|-----|
| Aave V3 | 2.5% | $20 | +0.22% | +2.7% | 16.8% | 51.9% | +0.06% | +0.21% | +0.35% |
| Morpho Steakhouse | 3.6% | $29 | +0.32% | +4.0% | 16.8% | 51.6% | +0.10% | +0.31% | +0.51% |
| Moonwell | 3.4% | $28 | +0.31% | +3.7% | 16.8% | 51.6% | +0.09% | +0.29% | +0.48% |

**No configs pass the worth-it test** (ann. return > 10% AND liq < 20%)
*Best safe configs (liq < 20%, positive return):*

| Protocol | Lev | Dur | Avg Ret | Ann. Ret | Liq % | Median |
|----------|-----|-----|---------|----------|-------|--------|
| Morpho Steakhouse | 30x | 30d | +0.32% | +4.0% | 16.8% | +0.31% |
| Morpho Steakhouse | 5x | 365d | +3.89% | +3.9% | 0.0% | +3.63% |
| Morpho Steakhouse | 5x | 270d | +2.81% | +3.8% | 0.0% | +2.81% |
| Morpho Steakhouse | 10x | 120d | +1.24% | +3.8% | 2.6% | +1.12% |
| Morpho Steakhouse | 10x | 90d | +0.93% | +3.8% | 0.1% | +0.81% |
| Morpho Steakhouse | 15x | 60d | +0.62% | +3.8% | 6.8% | +0.60% |
| Morpho Steakhouse | 20x | 30d | +0.31% | +3.7% | 4.4% | +0.30% |
| Moonwell | 30x | 30d | +0.31% | +3.7% | 16.8% | +0.29% |
| Morpho Steakhouse | 3x | 365d | +3.73% | +3.7% | 0.0% | +3.58% |
| Morpho Steakhouse | 10x | 60d | +0.61% | +3.7% | 0.0% | +0.59% |

**VERDICT: MARGINAL** — Profitable with <20% liq but doesn't beat 10% APY threshold. Best safe: Morpho Steakhouse 30x 30d -> +4.0%/yr

---

#### Austin

**Price:** $297.96 -> $219.17 (-26.4%) | High: $387.91 | Low: $219.13
**Chart:** `▃▄▄▄▄▄▅▅▅▇█▇▆▅▄▄▄▅▄▄▄▄▃▄▃▅▄▄▃▂▂▂▃▁▂▃▃▃▁▁`
**Data:** 1827 days (2021-03-14 to 2026-03-14)

**Leverage × Duration Heatmap** (Morpho 5.2% APY — avg return % | liq %)

| Lev | 30d | 60d | 90d | 120d | 180d | 270d | 365d |
|-----|------|------|------|------|------|------|------|
| 1x | — | — | — | — | — | — | — |
| 2x | — | — | — | — | — | — | — |
| 3x | — | — | — | — | — | — | — |
| 5x | — | — | — | — | — | — | — |
| 10x | — | — | — | — | — | — | — |
| 15x | — | — | — | — | — | — | — |
| 20x | — | — | — | — | — | — | — |
| 30x | — | — | — | — | — | — | — |
| 50x | — | — | — | — | — | — | — |
| 75x | — | — | — | — | — | — | — |
| 100x | — | — | — | — | — | — | — |

**Protocol Comparison** (at 1x / 30d — best safe config)

| Protocol | APY | Budget | Avg Return | Ann. Return | Liq % | Beat Yield | P25 | Median | P75 |
|----------|-----|--------|-----------|-------------|-------|-----------|-----|--------|-----|
| Aave V3 | 2.5% | $20 | +0.20% | +2.4% | 0.0% | 33.3% | +0.19% | +0.20% | +0.20% |
| Morpho Steakhouse | 3.6% | $29 | +0.29% | +3.5% | 0.0% | 27.2% | +0.28% | +0.29% | +0.30% |
| Moonwell | 3.4% | $28 | +0.28% | +3.4% | 0.0% | 28.0% | +0.27% | +0.28% | +0.28% |

**No configs pass the worth-it test** (ann. return > 10% AND liq < 20%)
*Best safe configs (liq < 20%, positive return):*

| Protocol | Lev | Dur | Avg Ret | Ann. Ret | Liq % | Median |
|----------|-----|-----|---------|----------|-------|--------|
| Morpho Steakhouse | 1x | 30d | +0.29% | +3.5% | 0.0% | +0.29% |
| Morpho Steakhouse | 2x | 30d | +0.29% | +3.5% | 0.0% | +0.29% |
| Morpho Steakhouse | 1x | 60d | +0.58% | +3.5% | 0.0% | +0.58% |
| Morpho Steakhouse | 3x | 30d | +0.29% | +3.5% | 0.0% | +0.29% |
| Morpho Steakhouse | 1x | 90d | +0.86% | +3.5% | 0.0% | +0.86% |
| Morpho Steakhouse | 1x | 120d | +1.15% | +3.5% | 0.0% | +1.15% |
| Morpho Steakhouse | 2x | 60d | +0.57% | +3.5% | 0.0% | +0.57% |
| Morpho Steakhouse | 5x | 30d | +0.29% | +3.5% | 0.5% | +0.29% |
| Morpho Steakhouse | 1x | 180d | +1.71% | +3.5% | 0.0% | +1.70% |
| Morpho Steakhouse | 2x | 90d | +0.85% | +3.5% | 0.0% | +0.85% |

**VERDICT: MARGINAL** — Profitable with <20% liq but doesn't beat 10% APY threshold. Best safe: Morpho Steakhouse 1x 30d -> +3.5%/yr

---

#### Boston

**Price:** $543.04 -> $615.61 (+13.4%) | High: $696.70 | Low: $543.04
**Chart:** ` ▂▄▄▃▄▂▂▂▄▇▆▂▁▁ ▃▃▇▆▆▃▂▂▁▃▅▇▆▆▃▂▄▅█▇▆▅▅▅`
**Data:** 1827 days (2021-03-14 to 2026-03-14)

**Leverage × Duration Heatmap** (Morpho 5.2% APY — avg return % | liq %)

| Lev | 30d | 60d | 90d | 120d | 180d | 270d | 365d |
|-----|------|------|------|------|------|------|------|
| 1x | — | — | — | — | — | — | — |
| 2x | — | — | — | — | — | — | — |
| 3x | — | — | — | — | — | — | — |
| 5x | — | — | — | — | — | — | — |
| 10x | — | — | — | — | — | — | — |
| 15x | — | — | — | — | — | — | — |
| 20x | — | — | — | — | — | — | — |
| 30x | — | — | — | — | — | — | — |
| 50x | — | — | — | — | — | — | — |
| 75x | — | — | — | — | — | — | — |
| 100x | — | — | — | — | — | — | — |

**Protocol Comparison** (at 5x / 365d — best safe config)

| Protocol | APY | Budget | Avg Return | Ann. Return | Liq % | Beat Yield | P25 | Median | P75 |
|----------|-----|--------|-----------|-------------|-------|-----------|-----|--------|-----|
| Aave V3 | 2.5% | $240 | +2.65% | +2.6% | 0.0% | 64.4% | +2.17% | +2.68% | +3.11% |
| Morpho Steakhouse | 3.6% | $349 | +3.86% | +3.9% | 0.0% | 62.8% | +3.16% | +3.90% | +4.52% |
| Moonwell | 3.4% | $332 | +3.66% | +3.7% | 0.0% | 63.1% | +3.00% | +3.70% | +4.29% |

**No configs pass the worth-it test** (ann. return > 10% AND liq < 20%)
*Best safe configs (liq < 20%, positive return):*

| Protocol | Lev | Dur | Avg Ret | Ann. Ret | Liq % | Median |
|----------|-----|-----|---------|----------|-------|--------|
| Morpho Steakhouse | 5x | 365d | +3.86% | +3.9% | 0.0% | +3.90% |
| Morpho Steakhouse | 20x | 30d | +0.32% | +3.9% | 10.6% | +0.29% |
| Morpho Steakhouse | 15x | 60d | +0.62% | +3.8% | 16.5% | +0.51% |
| Morpho Steakhouse | 10x | 90d | +0.93% | +3.8% | 11.6% | +0.89% |
| Morpho Steakhouse | 5x | 270d | +2.78% | +3.8% | 0.0% | +2.70% |
| Morpho Steakhouse | 15x | 30d | +0.31% | +3.7% | 6.1% | +0.29% |
| Morpho Steakhouse | 3x | 365d | +3.71% | +3.7% | 0.0% | +3.74% |
| Morpho Steakhouse | 5x | 180d | +1.83% | +3.7% | 0.0% | +1.67% |
| Morpho Steakhouse | 10x | 60d | +0.61% | +3.7% | 2.8% | +0.54% |
| Morpho Steakhouse | 5x | 120d | +1.21% | +3.7% | 0.0% | +1.17% |

**VERDICT: MARGINAL** — Profitable with <20% liq but doesn't beat 10% APY threshold. Best safe: Morpho Steakhouse 5x 365d -> +3.9%/yr

---

#### Brooklyn

**Price:** $601.73 -> $623.60 (+3.6%) | High: $723.76 | Low: $542.44
**Chart:** `▂▂▂▃▄▄▂▃▃▃▄▆▅▂    ▁▂▃▂▁ ▂▁▂▃▄▃▁▂▄▂▄▄█▆▅▃`
**Data:** 1827 days (2021-03-14 to 2026-03-14)

**Leverage × Duration Heatmap** (Morpho 5.2% APY — avg return % | liq %)

| Lev | 30d | 60d | 90d | 120d | 180d | 270d | 365d |
|-----|------|------|------|------|------|------|------|
| 1x | — | — | — | — | — | — | — |
| 2x | — | — | — | — | — | — | — |
| 3x | — | — | — | — | — | — | — |
| 5x | — | — | — | — | — | — | — |
| 10x | — | — | — | — | — | — | — |
| 15x | — | — | — | — | — | — | — |
| 20x | — | — | — | — | — | — | — |
| 30x | — | — | — | — | — | — | — |
| 50x | — | — | — | — | — | — | — |
| 75x | — | — | — | — | — | — | — |
| 100x | — | — | — | — | — | — | — |

**Protocol Comparison** (at 10x / 270d — best safe config)

| Protocol | APY | Budget | Avg Return | Ann. Return | Liq % | Beat Yield | P25 | Median | P75 |
|----------|-----|--------|-----------|-------------|-------|-----------|-----|--------|-----|
| Aave V3 | 2.5% | $178 | +2.10% | +2.8% | 15.5% | 61.4% | +1.51% | +2.10% | +2.78% |
| Morpho Steakhouse | 3.6% | $260 | +3.06% | +4.1% | 15.5% | 61.0% | +2.21% | +3.07% | +4.05% |
| Moonwell | 3.4% | $246 | +2.90% | +3.9% | 15.5% | 61.1% | +2.10% | +2.91% | +3.84% |

**No configs pass the worth-it test** (ann. return > 10% AND liq < 20%)
*Best safe configs (liq < 20%, positive return):*

| Protocol | Lev | Dur | Avg Ret | Ann. Ret | Liq % | Median |
|----------|-----|-----|---------|----------|-------|--------|
| Morpho Steakhouse | 10x | 270d | +3.06% | +4.1% | 15.5% | +3.07% |
| Morpho Steakhouse | 20x | 60d | +0.67% | +4.1% | 17.3% | +0.72% |
| Morpho Steakhouse | 15x | 90d | +0.99% | +4.0% | 17.8% | +1.06% |
| Morpho Steakhouse | 10x | 180d | +1.98% | +4.0% | 13.2% | +1.94% |
| Morpho Steakhouse | 30x | 30d | +0.32% | +3.9% | 16.0% | +0.32% |
| Moonwell | 10x | 270d | +2.90% | +3.9% | 15.5% | +2.91% |
| Morpho Steakhouse | 10x | 120d | +1.27% | +3.9% | 10.8% | +1.38% |
| Moonwell | 20x | 60d | +0.63% | +3.9% | 17.3% | +0.68% |
| Moonwell | 15x | 90d | +0.94% | +3.8% | 17.8% | +1.01% |
| Morpho Steakhouse | 15x | 60d | +0.63% | +3.8% | 12.1% | +0.68% |

**VERDICT: MARGINAL** — Profitable with <20% liq but doesn't beat 10% APY threshold. Best safe: Morpho Steakhouse 10x 270d -> +4.1%/yr

---

#### Charlotte

**Price:** $171.80 -> $234.63 (+36.6%) | High: $252.96 | Low: $171.80
**Chart:** `  ▁▁▁▁▂▂▃▄▅▆▅▅▅▅▄▄▅▆▆▆▆▅▅▆█▇▇▇▆▆▆▇▇▇▇▇▇▆`
**Data:** 1827 days (2021-03-14 to 2026-03-14)

**Leverage × Duration Heatmap** (Morpho 5.2% APY — avg return % | liq %)

| Lev | 30d | 60d | 90d | 120d | 180d | 270d | 365d |
|-----|------|------|------|------|------|------|------|
| 1x | — | — | — | — | — | — | — |
| 2x | — | — | — | — | — | — | — |
| 3x | — | — | — | — | — | — | — |
| 5x | — | — | — | — | — | — | — |
| 10x | — | — | — | — | — | — | — |
| 15x | — | — | — | — | — | — | — |
| 20x | — | — | — | — | — | — | — |
| 30x | — | — | — | — | — | — | — |
| 50x | — | — | — | — | — | — | — |
| 75x | — | — | — | — | — | — | — |
| 100x | — | — | — | — | — | — | — |

**Protocol Comparison** (at 15x / 365d — best safe config)

| Protocol | APY | Budget | Avg Return | Ann. Return | Liq % | Beat Yield | P25 | Median | P75 |
|----------|-----|--------|-----------|-------------|-------|-----------|-----|--------|-----|
| Aave V3 | 2.5% | $240 | +4.49% | +4.5% | 10.2% | 84.1% | +2.86% | +3.57% | +5.81% |
| Morpho Steakhouse | 3.6% | $349 | +6.54% | +6.5% | 10.2% | 83.8% | +4.16% | +5.19% | +8.46% |
| Moonwell | 3.4% | $332 | +6.20% | +6.2% | 10.2% | 83.9% | +3.95% | +4.93% | +8.03% |

**No configs pass the worth-it test** (ann. return > 10% AND liq < 20%)
*Best safe configs (liq < 20%, positive return):*

| Protocol | Lev | Dur | Avg Ret | Ann. Ret | Liq % | Median |
|----------|-----|-----|---------|----------|-------|--------|
| Morpho Steakhouse | 15x | 365d | +6.54% | +6.5% | 10.2% | +5.19% |
| Moonwell | 15x | 365d | +6.20% | +6.2% | 10.2% | +4.93% |
| Morpho Steakhouse | 15x | 270d | +4.40% | +6.0% | 9.1% | +4.15% |
| Morpho Steakhouse | 10x | 365d | +5.78% | +5.8% | 0.0% | +4.63% |
| Moonwell | 15x | 270d | +4.18% | +5.7% | 9.1% | +3.94% |
| Moonwell | 10x | 365d | +5.49% | +5.5% | 0.0% | +4.39% |
| Morpho Steakhouse | 10x | 270d | +3.86% | +5.2% | 0.0% | +3.63% |
| Morpho Steakhouse | 30x | 90d | +1.28% | +5.2% | 16.7% | +1.03% |
| Morpho Steakhouse | 15x | 180d | +2.53% | +5.1% | 3.3% | +2.67% |
| Moonwell | 10x | 270d | +3.66% | +5.0% | 0.0% | +3.45% |

**VERDICT: MARGINAL** — Profitable with <20% liq but doesn't beat 10% APY threshold. Best safe: Morpho Steakhouse 15x 365d -> +6.5%/yr

---

#### Chicago

**Price:** $203.36 -> $256.82 (+26.3%) | High: $279.16 | Low: $203.36
**Chart:** ` ▂▄▄▃▂▁▁▁▄▅▆▄▂▂  ▃▄▅▄▃▂▂▂▄▆▇▆▅▄▃▃▆▇█▇▇▆▅`
**Data:** 1827 days (2021-03-14 to 2026-03-14)

**Leverage × Duration Heatmap** (Morpho 5.2% APY — avg return % | liq %)

| Lev | 30d | 60d | 90d | 120d | 180d | 270d | 365d |
|-----|------|------|------|------|------|------|------|
| 1x | — | — | — | — | — | — | — |
| 2x | — | — | — | — | — | — | — |
| 3x | — | — | — | — | — | — | — |
| 5x | — | — | — | — | — | — | — |
| 10x | — | — | — | — | — | — | — |
| 15x | — | — | — | — | — | — | — |
| 20x | — | — | — | — | — | — | — |
| 30x | — | — | — | — | — | — | — |
| 50x | — | — | — | — | — | — | — |
| 75x | — | — | — | — | — | — | — |
| 100x | — | — | — | — | — | — | — |

**Protocol Comparison** (at 15x / 90d — best safe config)

| Protocol | APY | Budget | Avg Return | Ann. Return | Liq % | Beat Yield | P25 | Median | P75 |
|----------|-----|--------|-----------|-------------|-------|-----------|-----|--------|-----|
| Aave V3 | 2.5% | $60 | +0.70% | +2.9% | 19.2% | 42.0% | +0.09% | +0.40% | +1.29% |
| Morpho Steakhouse | 3.6% | $87 | +1.03% | +4.2% | 19.2% | 41.8% | +0.13% | +0.58% | +1.89% |
| Moonwell | 3.4% | $83 | +0.98% | +4.0% | 19.2% | 41.8% | +0.12% | +0.55% | +1.80% |

**No configs pass the worth-it test** (ann. return > 10% AND liq < 20%)
*Best safe configs (liq < 20%, positive return):*

| Protocol | Lev | Dur | Avg Ret | Ann. Ret | Liq % | Median |
|----------|-----|-----|---------|----------|-------|--------|
| Morpho Steakhouse | 15x | 90d | +1.03% | +4.2% | 19.2% | +0.58% |
| Morpho Steakhouse | 20x | 60d | +0.68% | +4.1% | 14.2% | +0.36% |
| Morpho Steakhouse | 5x | 365d | +4.09% | +4.1% | 3.5% | +4.40% |
| Morpho Steakhouse | 10x | 120d | +1.32% | +4.0% | 8.9% | +0.89% |
| Morpho Steakhouse | 30x | 30d | +0.33% | +4.0% | 8.5% | +0.22% |
| Moonwell | 15x | 90d | +0.98% | +4.0% | 19.2% | +0.55% |
| Morpho Steakhouse | 5x | 270d | +2.93% | +4.0% | 3.3% | +3.34% |
| Moonwell | 20x | 60d | +0.65% | +3.9% | 14.2% | +0.34% |
| Morpho Steakhouse | 15x | 60d | +0.64% | +3.9% | 5.3% | +0.41% |
| Morpho Steakhouse | 3x | 365d | +3.91% | +3.9% | 0.0% | +4.04% |

**VERDICT: MARGINAL** — Profitable with <20% liq but doesn't beat 10% APY threshold. Best safe: Morpho Steakhouse 15x 90d -> +4.2%/yr

---

#### Denver

**Price:** $370.36 -> $379.85 (+2.6%) | High: $461.53 | Low: $359.73
**Chart:** ` ▂▂▃▂▂▂▂▃█▇▆▄▄▃▁▂▃▅▅▄▆▄▁▂▃▄▄▂▂▂▁ ▂▃▃▂▁▁▁`
**Data:** 1827 days (2021-03-14 to 2026-03-14)

**Leverage × Duration Heatmap** (Morpho 5.2% APY — avg return % | liq %)

| Lev | 30d | 60d | 90d | 120d | 180d | 270d | 365d |
|-----|------|------|------|------|------|------|------|
| 1x | — | — | — | — | — | — | — |
| 2x | — | — | — | — | — | — | — |
| 3x | — | — | — | — | — | — | — |
| 5x | — | — | — | — | — | — | — |
| 10x | — | — | — | — | — | — | — |
| 15x | — | — | — | — | — | — | — |
| 20x | — | — | — | — | — | — | — |
| 30x | — | — | — | — | — | — | — |
| 50x | — | — | — | — | — | — | — |
| 75x | — | — | — | — | — | — | — |
| 100x | — | — | — | — | — | — | — |

**Protocol Comparison** (at 20x / 60d — best safe config)

| Protocol | APY | Budget | Avg Return | Ann. Return | Liq % | Beat Yield | P25 | Median | P75 |
|----------|-----|--------|-----------|-------------|-------|-----------|-----|--------|-----|
| Aave V3 | 2.5% | $40 | +0.42% | +2.6% | 14.8% | 47.1% | +0.17% | +0.38% | +0.60% |
| Morpho Steakhouse | 3.6% | $58 | +0.62% | +3.8% | 14.8% | 46.8% | +0.25% | +0.56% | +0.88% |
| Moonwell | 3.4% | $55 | +0.59% | +3.6% | 14.8% | 46.8% | +0.24% | +0.53% | +0.83% |

**No configs pass the worth-it test** (ann. return > 10% AND liq < 20%)
*Best safe configs (liq < 20%, positive return):*

| Protocol | Lev | Dur | Avg Ret | Ann. Ret | Liq % | Median |
|----------|-----|-----|---------|----------|-------|--------|
| Morpho Steakhouse | 20x | 60d | +0.62% | +3.8% | 14.8% | +0.56% |
| Morpho Steakhouse | 30x | 30d | +0.31% | +3.8% | 11.0% | +0.29% |
| Morpho Steakhouse | 15x | 60d | +0.60% | +3.6% | 7.6% | +0.56% |
| Morpho Steakhouse | 15x | 90d | +0.90% | +3.6% | 15.2% | +0.79% |
| Morpho Steakhouse | 20x | 30d | +0.30% | +3.6% | 3.9% | +0.29% |
| Moonwell | 20x | 60d | +0.59% | +3.6% | 14.8% | +0.53% |
| Morpho Steakhouse | 15x | 30d | +0.29% | +3.6% | 1.8% | +0.29% |
| Morpho Steakhouse | 10x | 60d | +0.59% | +3.6% | 2.4% | +0.57% |
| Morpho Steakhouse | 10x | 90d | +0.88% | +3.6% | 4.7% | +0.83% |
| Morpho Steakhouse | 1x | 30d | +0.29% | +3.5% | 0.0% | +0.29% |

**VERDICT: MARGINAL** — Profitable with <20% liq but doesn't beat 10% APY threshold. Best safe: Morpho Steakhouse 20x 60d -> +3.8%/yr

---

#### Las Vegas

**Price:** $182.60 -> $247.62 (+35.6%) | High: $266.48 | Low: $182.60
**Chart:** `  ▁▂▃▃▄▄▅▆▇▇▆▆▅▄▄▄▅▅▅▆▆▆▅▆▆▇▇▇▇▇▇▇█▇▇▇▇▆`
**Data:** 1827 days (2021-03-14 to 2026-03-14)

**Leverage × Duration Heatmap** (Morpho 5.2% APY — avg return % | liq %)

| Lev | 30d | 60d | 90d | 120d | 180d | 270d | 365d |
|-----|------|------|------|------|------|------|------|
| 1x | — | — | — | — | — | — | — |
| 2x | — | — | — | — | — | — | — |
| 3x | — | — | — | — | — | — | — |
| 5x | — | — | — | — | — | — | — |
| 10x | — | — | — | — | — | — | — |
| 15x | — | — | — | — | — | — | — |
| 20x | — | — | — | — | — | — | — |
| 30x | — | — | — | — | — | — | — |
| 50x | — | — | — | — | — | — | — |
| 75x | — | — | — | — | — | — | — |
| 100x | — | — | — | — | — | — | — |

**Protocol Comparison** (at 20x / 365d — best safe config)

| Protocol | APY | Budget | Avg Return | Ann. Return | Liq % | Beat Yield | P25 | Median | P75 |
|----------|-----|--------|-----------|-------------|-------|-----------|-----|--------|-----|
| Aave V3 | 2.5% | $240 | +4.94% | +4.9% | 17.0% | 68.7% | +1.34% | +4.66% | +5.81% |
| Morpho Steakhouse | 3.6% | $349 | +7.20% | +7.2% | 17.0% | 68.5% | +1.95% | +6.79% | +8.46% |
| Moonwell | 3.4% | $332 | +6.83% | +6.8% | 17.0% | 68.7% | +1.85% | +6.45% | +8.03% |

**No configs pass the worth-it test** (ann. return > 10% AND liq < 20%)
*Best safe configs (liq < 20%, positive return):*

| Protocol | Lev | Dur | Avg Ret | Ann. Ret | Liq % | Median |
|----------|-----|-----|---------|----------|-------|--------|
| Morpho Steakhouse | 20x | 365d | +7.20% | +7.2% | 17.0% | +6.79% |
| Moonwell | 20x | 365d | +6.83% | +6.8% | 17.0% | +6.45% |
| Morpho Steakhouse | 20x | 270d | +4.94% | +6.7% | 17.7% | +4.51% |
| Moonwell | 20x | 270d | +4.68% | +6.3% | 17.7% | +4.28% |
| Morpho Steakhouse | 15x | 365d | +6.19% | +6.2% | 14.2% | +5.97% |
| Morpho Steakhouse | 30x | 120d | +1.98% | +6.0% | 15.1% | +1.73% |
| Moonwell | 15x | 365d | +5.87% | +5.9% | 14.2% | +5.66% |
| Morpho Steakhouse | 20x | 180d | +2.86% | +5.8% | 13.6% | +2.59% |
| Morpho Steakhouse | 15x | 270d | +4.27% | +5.8% | 15.0% | +4.03% |
| Moonwell | 30x | 120d | +1.88% | +5.7% | 15.1% | +1.65% |

**VERDICT: MARGINAL** — Profitable with <20% liq but doesn't beat 10% APY threshold. Best safe: Morpho Steakhouse 20x 365d -> +7.2%/yr

---

#### Los Angeles

**Price:** $540.69 -> $617.46 (+14.2%) | High: $654.98 | Low: $540.69
**Chart:** ` ▁▂▃▃▃▃▃▄▇▇▇▅▄▄▁▂▅▃▄▅▄▇▃▄▆▇▇▆▅▆▅▅█▆▆▆▅▆▄`
**Data:** 1827 days (2021-03-14 to 2026-03-14)

**Leverage × Duration Heatmap** (Morpho 5.2% APY — avg return % | liq %)

| Lev | 30d | 60d | 90d | 120d | 180d | 270d | 365d |
|-----|------|------|------|------|------|------|------|
| 1x | — | — | — | — | — | — | — |
| 2x | — | — | — | — | — | — | — |
| 3x | — | — | — | — | — | — | — |
| 5x | — | — | — | — | — | — | — |
| 10x | — | — | — | — | — | — | — |
| 15x | — | — | — | — | — | — | — |
| 20x | — | — | — | — | — | — | — |
| 30x | — | — | — | — | — | — | — |
| 50x | — | — | — | — | — | — | — |
| 75x | — | — | — | — | — | — | — |
| 100x | — | — | — | — | — | — | — |

**Protocol Comparison** (at 15x / 365d — best safe config)

| Protocol | APY | Budget | Avg Return | Ann. Return | Liq % | Beat Yield | P25 | Median | P75 |
|----------|-----|--------|-----------|-------------|-------|-----------|-----|--------|-----|
| Aave V3 | 2.5% | $240 | +2.87% | +2.9% | 18.0% | 59.2% | +1.56% | +2.82% | +4.02% |
| Morpho Steakhouse | 3.6% | $349 | +4.18% | +4.2% | 18.0% | 58.3% | +2.27% | +4.11% | +5.86% |
| Moonwell | 3.4% | $332 | +3.97% | +4.0% | 18.0% | 58.3% | +2.16% | +3.90% | +5.56% |

**No configs pass the worth-it test** (ann. return > 10% AND liq < 20%)
*Best safe configs (liq < 20%, positive return):*

| Protocol | Lev | Dur | Avg Ret | Ann. Ret | Liq % | Median |
|----------|-----|-----|---------|----------|-------|--------|
| Morpho Steakhouse | 15x | 365d | +4.18% | +4.2% | 18.0% | +4.11% |
| Morpho Steakhouse | 15x | 270d | +3.04% | +4.1% | 19.9% | +3.28% |
| Morpho Steakhouse | 10x | 365d | +4.02% | +4.0% | 8.9% | +3.98% |
| Moonwell | 15x | 365d | +3.97% | +4.0% | 18.0% | +3.90% |
| Morpho Steakhouse | 10x | 270d | +2.91% | +3.9% | 8.0% | +3.06% |
| Morpho Steakhouse | 15x | 180d | +1.94% | +3.9% | 15.5% | +1.97% |
| Moonwell | 15x | 270d | +2.89% | +3.9% | 19.9% | +3.11% |
| Morpho Steakhouse | 20x | 120d | +1.26% | +3.8% | 19.6% | +1.17% |
| Morpho Steakhouse | 30x | 30d | +0.32% | +3.8% | 8.8% | +0.32% |
| Morpho Steakhouse | 10x | 180d | +1.89% | +3.8% | 3.0% | +1.93% |

**VERDICT: MARGINAL** — Profitable with <20% liq but doesn't beat 10% APY threshold. Best safe: Morpho Steakhouse 15x 365d -> +4.2%/yr

---

#### Miami

**Price:** $351.29 -> $548.26 (+56.1%) | High: $591.09 | Low: $351.00
**Chart:** `   ▁▁▁▂▃▄▅▆▆▅▆▆▆▄▆▆▆▆▆▆▆▆▇▇▇▇▆▆▆▆▇▇█▆▆▆▅`
**Data:** 1827 days (2021-03-14 to 2026-03-14)

**Leverage × Duration Heatmap** (Morpho 5.2% APY — avg return % | liq %)

| Lev | 30d | 60d | 90d | 120d | 180d | 270d | 365d |
|-----|------|------|------|------|------|------|------|
| 1x | — | — | — | — | — | — | — |
| 2x | — | — | — | — | — | — | — |
| 3x | — | — | — | — | — | — | — |
| 5x | — | — | — | — | — | — | — |
| 10x | — | — | — | — | — | — | — |
| 15x | — | — | — | — | — | — | — |
| 20x | — | — | — | — | — | — | — |
| 30x | — | — | — | — | — | — | — |
| 50x | — | — | — | — | — | — | — |
| 75x | — | — | — | — | — | — | — |
| 100x | — | — | — | — | — | — | — |

**Protocol Comparison** (at 10x / 365d — best safe config)

| Protocol | APY | Budget | Avg Return | Ann. Return | Liq % | Beat Yield | P25 | Median | P75 |
|----------|-----|--------|-----------|-------------|-------|-----------|-----|--------|-----|
| Aave V3 | 2.5% | $240 | +4.34% | +4.3% | 8.6% | 70.6% | +2.28% | +3.08% | +4.76% |
| Morpho Steakhouse | 3.6% | $349 | +6.32% | +6.3% | 8.6% | 69.8% | +3.32% | +4.48% | +6.93% |
| Moonwell | 3.4% | $332 | +6.00% | +6.0% | 8.6% | 70.0% | +3.15% | +4.25% | +6.58% |

**No configs pass the worth-it test** (ann. return > 10% AND liq < 20%)
*Best safe configs (liq < 20%, positive return):*

| Protocol | Lev | Dur | Avg Ret | Ann. Ret | Liq % | Median |
|----------|-----|-----|---------|----------|-------|--------|
| Morpho Steakhouse | 10x | 365d | +6.32% | +6.3% | 8.6% | +4.48% |
| Moonwell | 10x | 365d | +6.00% | +6.0% | 8.6% | +4.25% |
| Morpho Steakhouse | 10x | 270d | +4.17% | +5.6% | 10.2% | +3.44% |
| Moonwell | 10x | 270d | +3.96% | +5.3% | 10.2% | +3.26% |
| Morpho Steakhouse | 50x | 30d | +0.44% | +5.3% | 18.1% | +0.39% |
| Morpho Steakhouse | 20x | 90d | +1.26% | +5.1% | 17.0% | +1.21% |
| Morpho Steakhouse | 5x | 365d | +5.06% | +5.1% | 0.0% | +3.99% |
| Moonwell | 50x | 30d | +0.42% | +5.0% | 18.1% | +0.37% |
| Morpho Steakhouse | 15x | 120d | +1.63% | +5.0% | 14.1% | +1.51% |
| Morpho Steakhouse | 10x | 180d | +2.40% | +4.9% | 7.1% | +2.08% |

**VERDICT: MARGINAL** — Profitable with <20% liq but doesn't beat 10% APY threshold. Best safe: Morpho Steakhouse 10x 365d -> +6.3%/yr

---

#### Miami Beach

**Price:** $491.88 -> $653.72 (+32.9%) | High: $679.03 | Low: $483.02
**Chart:** ` ▁▁▁   ▁▁▂▃▃▂▂▃▁▂▃▃▃▂▃▃▃▃▃▅▆▃▄▄▅▆▇▅▅▅▇█▄`
**Data:** 1827 days (2021-03-14 to 2026-03-14)

**Leverage × Duration Heatmap** (Morpho 5.2% APY — avg return % | liq %)

| Lev | 30d | 60d | 90d | 120d | 180d | 270d | 365d |
|-----|------|------|------|------|------|------|------|
| 1x | — | — | — | — | — | — | — |
| 2x | — | — | — | — | — | — | — |
| 3x | — | — | — | — | — | — | — |
| 5x | — | — | — | — | — | — | — |
| 10x | — | — | — | — | — | — | — |
| 15x | — | — | — | — | — | — | — |
| 20x | — | — | — | — | — | — | — |
| 30x | — | — | — | — | — | — | — |
| 50x | — | — | — | — | — | — | — |
| 75x | — | — | — | — | — | — | — |
| 100x | — | — | — | — | — | — | — |

**Protocol Comparison** (at 10x / 365d — best safe config)

| Protocol | APY | Budget | Avg Return | Ann. Return | Liq % | Beat Yield | P25 | Median | P75 |
|----------|-----|--------|-----------|-------------|-------|-----------|-----|--------|-----|
| Aave V3 | 2.5% | $240 | +3.64% | +3.6% | 4.7% | 85.4% | +2.86% | +3.69% | +4.55% |
| Morpho Steakhouse | 3.6% | $349 | +5.30% | +5.3% | 4.7% | 84.8% | +4.17% | +5.37% | +6.63% |
| Moonwell | 3.4% | $332 | +5.03% | +5.0% | 4.7% | 84.9% | +3.96% | +5.09% | +6.29% |

**No configs pass the worth-it test** (ann. return > 10% AND liq < 20%)
*Best safe configs (liq < 20%, positive return):*

| Protocol | Lev | Dur | Avg Ret | Ann. Ret | Liq % | Median |
|----------|-----|-----|---------|----------|-------|--------|
| Morpho Steakhouse | 10x | 365d | +5.30% | +5.3% | 4.7% | +5.37% |
| Moonwell | 10x | 365d | +5.03% | +5.0% | 4.7% | +5.09% |
| Morpho Steakhouse | 10x | 270d | +3.46% | +4.7% | 6.6% | +3.45% |
| Morpho Steakhouse | 20x | 60d | +0.74% | +4.5% | 17.8% | +0.78% |
| Morpho Steakhouse | 5x | 365d | +4.46% | +4.5% | 0.0% | +4.43% |
| Moonwell | 10x | 270d | +3.28% | +4.4% | 6.6% | +3.28% |
| Morpho Steakhouse | 30x | 30d | +0.36% | +4.4% | 11.8% | +0.36% |
| Morpho Steakhouse | 10x | 180d | +2.11% | +4.3% | 5.5% | +1.99% |
| Moonwell | 20x | 60d | +0.70% | +4.3% | 17.8% | +0.74% |
| Moonwell | 5x | 365d | +4.23% | +4.2% | 0.0% | +4.21% |

**VERDICT: MARGINAL** — Profitable with <20% liq but doesn't beat 10% APY threshold. Best safe: Morpho Steakhouse 10x 365d -> +5.3%/yr

---

#### Nashville

**Price:** $203.88 -> $274.11 (+34.4%) | High: $285.21 | Low: $203.88
**Chart:** `  ▂▂▂▂▃▄▄▆▇▇▇▆▅▆▆▇▇▇▇▇▇▆▆▆▇█▇▆▆▆▆▆▇▇▇▆▇▆`
**Data:** 1827 days (2021-03-14 to 2026-03-14)

**Leverage × Duration Heatmap** (Morpho 5.2% APY — avg return % | liq %)

| Lev | 30d | 60d | 90d | 120d | 180d | 270d | 365d |
|-----|------|------|------|------|------|------|------|
| 1x | — | — | — | — | — | — | — |
| 2x | — | — | — | — | — | — | — |
| 3x | — | — | — | — | — | — | — |
| 5x | — | — | — | — | — | — | — |
| 10x | — | — | — | — | — | — | — |
| 15x | — | — | — | — | — | — | — |
| 20x | — | — | — | — | — | — | — |
| 30x | — | — | — | — | — | — | — |
| 50x | — | — | — | — | — | — | — |
| 75x | — | — | — | — | — | — | — |
| 100x | — | — | — | — | — | — | — |

**Protocol Comparison** (at 15x / 365d — best safe config)

| Protocol | APY | Budget | Avg Return | Ann. Return | Liq % | Beat Yield | P25 | Median | P75 |
|----------|-----|--------|-----------|-------------|-------|-----------|-----|--------|-----|
| Aave V3 | 2.5% | $240 | +3.96% | +4.0% | 9.2% | 60.1% | +2.09% | +2.81% | +5.03% |
| Morpho Steakhouse | 3.6% | $349 | +5.76% | +5.8% | 9.2% | 59.4% | +3.04% | +4.09% | +7.33% |
| Moonwell | 3.4% | $332 | +5.47% | +5.5% | 9.2% | 59.6% | +2.88% | +3.89% | +6.96% |

**No configs pass the worth-it test** (ann. return > 10% AND liq < 20%)
*Best safe configs (liq < 20%, positive return):*

| Protocol | Lev | Dur | Avg Ret | Ann. Ret | Liq % | Median |
|----------|-----|-----|---------|----------|-------|--------|
| Morpho Steakhouse | 15x | 365d | +5.76% | +5.8% | 9.2% | +4.09% |
| Morpho Steakhouse | 20x | 270d | +4.23% | +5.7% | 18.5% | +3.34% |
| Moonwell | 15x | 365d | +5.47% | +5.5% | 9.2% | +3.89% |
| Moonwell | 20x | 270d | +4.01% | +5.4% | 18.5% | +3.17% |
| Morpho Steakhouse | 15x | 270d | +3.85% | +5.2% | 8.7% | +3.17% |
| Morpho Steakhouse | 10x | 365d | +5.16% | +5.2% | 0.0% | +3.89% |
| Morpho Steakhouse | 20x | 180d | +2.53% | +5.1% | 13.6% | +2.30% |
| Morpho Steakhouse | 30x | 90d | +1.25% | +5.1% | 15.9% | +0.92% |
| Moonwell | 15x | 270d | +3.65% | +4.9% | 8.7% | +3.01% |
| Moonwell | 10x | 365d | +4.89% | +4.9% | 0.0% | +3.70% |

**VERDICT: MARGINAL** — Profitable with <20% liq but doesn't beat 10% APY threshold. Best safe: Morpho Steakhouse 15x 365d -> +5.8%/yr

---

#### New York City

**Price:** $486.25 -> $590.48 (+21.4%) | High: $625.49 | Low: $485.68
**Chart:** `   ▃▄▄▃▄▄▅▆█▆▄▂▁▁▂▄▂▃▃▃▂▃▃▃▅▆▅▄▄▅▅▆▆▇▇▅▅`
**Data:** 1827 days (2021-03-14 to 2026-03-14)

**Leverage × Duration Heatmap** (Morpho 5.2% APY — avg return % | liq %)

| Lev | 30d | 60d | 90d | 120d | 180d | 270d | 365d |
|-----|------|------|------|------|------|------|------|
| 1x | — | — | — | — | — | — | — |
| 2x | — | — | — | — | — | — | — |
| 3x | — | — | — | — | — | — | — |
| 5x | — | — | — | — | — | — | — |
| 10x | — | — | — | — | — | — | — |
| 15x | — | — | — | — | — | — | — |
| 20x | — | — | — | — | — | — | — |
| 30x | — | — | — | — | — | — | — |
| 50x | — | — | — | — | — | — | — |
| 75x | — | — | — | — | — | — | — |
| 100x | — | — | — | — | — | — | — |

**Protocol Comparison** (at 15x / 270d — best safe config)

| Protocol | APY | Budget | Avg Return | Ann. Return | Liq % | Beat Yield | P25 | Median | P75 |
|----------|-----|--------|-----------|-------------|-------|-----------|-----|--------|-----|
| Aave V3 | 2.5% | $178 | +2.51% | +3.4% | 18.4% | 67.7% | +1.36% | +2.64% | +3.79% |
| Morpho Steakhouse | 3.6% | $260 | +3.66% | +5.0% | 18.4% | 67.6% | +1.98% | +3.85% | +5.52% |
| Moonwell | 3.4% | $246 | +3.48% | +4.7% | 18.4% | 67.6% | +1.88% | +3.65% | +5.24% |

**No configs pass the worth-it test** (ann. return > 10% AND liq < 20%)
*Best safe configs (liq < 20%, positive return):*

| Protocol | Lev | Dur | Avg Ret | Ann. Ret | Liq % | Median |
|----------|-----|-----|---------|----------|-------|--------|
| Morpho Steakhouse | 15x | 270d | +3.66% | +5.0% | 18.4% | +3.85% |
| Moonwell | 15x | 270d | +3.48% | +4.7% | 18.4% | +3.65% |
| Morpho Steakhouse | 15x | 180d | +2.31% | +4.7% | 16.1% | +2.17% |
| Morpho Steakhouse | 10x | 365d | +4.52% | +4.5% | 14.2% | +4.96% |
| Morpho Steakhouse | 10x | 270d | +3.29% | +4.4% | 11.1% | +3.44% |
| Moonwell | 15x | 180d | +2.19% | +4.4% | 16.1% | +2.06% |
| Morpho Steakhouse | 15x | 120d | +1.45% | +4.4% | 13.9% | +1.45% |
| Moonwell | 10x | 365d | +4.29% | +4.3% | 14.2% | +4.71% |
| Morpho Steakhouse | 10x | 180d | +2.11% | +4.3% | 7.0% | +2.03% |
| Moonwell | 10x | 270d | +3.12% | +4.2% | 11.1% | +3.26% |

**VERDICT: MARGINAL** — Profitable with <20% liq but doesn't beat 10% APY threshold. Best safe: Morpho Steakhouse 15x 270d -> +5.0%/yr

---

#### Pittsburgh

**Price:** $127.35 -> $161.67 (+26.9%) | High: $195.11 | Low: $116.91
**Chart:** ` ▃▂▃▂▂▁▁▁▃▄▆▃▂    ▄▅▃▃▅▂ ▃▅▅▅▃▄▄▄▃▇█▇▇▆▆`
**Data:** 1827 days (2021-03-14 to 2026-03-14)

**Leverage × Duration Heatmap** (Morpho 5.2% APY — avg return % | liq %)

| Lev | 30d | 60d | 90d | 120d | 180d | 270d | 365d |
|-----|------|------|------|------|------|------|------|
| 1x | — | — | — | — | — | — | — |
| 2x | — | — | — | — | — | — | — |
| 3x | — | — | — | — | — | — | — |
| 5x | — | — | — | — | — | — | — |
| 10x | — | — | — | — | — | — | — |
| 15x | — | — | — | — | — | — | — |
| 20x | — | — | — | — | — | — | — |
| 30x | — | — | — | — | — | — | — |
| 50x | — | — | — | — | — | — | — |
| 75x | — | — | — | — | — | — | — |
| 100x | — | — | — | — | — | — | — |

**Protocol Comparison** (at 5x / 270d — best safe config)

| Protocol | APY | Budget | Avg Return | Ann. Return | Liq % | Beat Yield | P25 | Median | P75 |
|----------|-----|--------|-----------|-------------|-------|-----------|-----|--------|-----|
| Aave V3 | 2.5% | $178 | +2.08% | +2.8% | 14.8% | 61.7% | +1.00% | +2.28% | +3.05% |
| Morpho Steakhouse | 3.6% | $260 | +3.04% | +4.1% | 14.8% | 60.9% | +1.45% | +3.32% | +4.45% |
| Moonwell | 3.4% | $246 | +2.88% | +3.9% | 14.8% | 61.0% | +1.38% | +3.15% | +4.22% |

**No configs pass the worth-it test** (ann. return > 10% AND liq < 20%)
*Best safe configs (liq < 20%, positive return):*

| Protocol | Lev | Dur | Avg Ret | Ann. Ret | Liq % | Median |
|----------|-----|-----|---------|----------|-------|--------|
| Morpho Steakhouse | 5x | 270d | +3.04% | +4.1% | 14.8% | +3.32% |
| Morpho Steakhouse | 5x | 180d | +2.01% | +4.1% | 8.9% | +1.73% |
| Morpho Steakhouse | 3x | 365d | +4.03% | +4.0% | 2.0% | +4.21% |
| Morpho Steakhouse | 15x | 30d | +0.33% | +4.0% | 15.6% | +0.31% |
| Morpho Steakhouse | 3x | 270d | +2.95% | +4.0% | 1.9% | +3.12% |
| Morpho Steakhouse | 5x | 120d | +1.30% | +4.0% | 3.8% | +1.03% |
| Morpho Steakhouse | 5x | 365d | +3.92% | +3.9% | 18.5% | +4.68% |
| Morpho Steakhouse | 10x | 60d | +0.64% | +3.9% | 19.6% | +0.52% |
| Moonwell | 5x | 270d | +2.88% | +3.9% | 14.8% | +3.15% |
| Morpho Steakhouse | 2x | 365d | +3.89% | +3.9% | 0.0% | +3.97% |

**VERDICT: MARGINAL** — Profitable with <20% liq but doesn't beat 10% APY threshold. Best safe: Morpho Steakhouse 5x 270d -> +4.1%/yr

---

#### San Diego

**Price:** $513.26 -> $678.63 (+32.2%) | High: $716.81 | Low: $513.26
**Chart:** `  ▁▂▂▂▃▃▅▆▇▆▄▄▄▃▃▄▅▆▆▆▅▅▆▇▇█▇▇▇▆▆▇▇▇▆▆▆▅`
**Data:** 1827 days (2021-03-14 to 2026-03-14)

**Leverage × Duration Heatmap** (Morpho 5.2% APY — avg return % | liq %)

| Lev | 30d | 60d | 90d | 120d | 180d | 270d | 365d |
|-----|------|------|------|------|------|------|------|
| 1x | — | — | — | — | — | — | — |
| 2x | — | — | — | — | — | — | — |
| 3x | — | — | — | — | — | — | — |
| 5x | — | — | — | — | — | — | — |
| 10x | — | — | — | — | — | — | — |
| 15x | — | — | — | — | — | — | — |
| 20x | — | — | — | — | — | — | — |
| 30x | — | — | — | — | — | — | — |
| 50x | — | — | — | — | — | — | — |
| 75x | — | — | — | — | — | — | — |
| 100x | — | — | — | — | — | — | — |

**Protocol Comparison** (at 15x / 365d — best safe config)

| Protocol | APY | Budget | Avg Return | Ann. Return | Liq % | Beat Yield | P25 | Median | P75 |
|----------|-----|--------|-----------|-------------|-------|-----------|-----|--------|-----|
| Aave V3 | 2.5% | $240 | +3.96% | +4.0% | 10.2% | 61.4% | +1.45% | +3.78% | +5.51% |
| Morpho Steakhouse | 3.6% | $349 | +5.76% | +5.8% | 10.2% | 61.1% | +2.12% | +5.50% | +8.02% |
| Moonwell | 3.4% | $332 | +5.47% | +5.5% | 10.2% | 61.1% | +2.01% | +5.22% | +7.61% |

**No configs pass the worth-it test** (ann. return > 10% AND liq < 20%)
*Best safe configs (liq < 20%, positive return):*

| Protocol | Lev | Dur | Avg Ret | Ann. Ret | Liq % | Median |
|----------|-----|-----|---------|----------|-------|--------|
| Morpho Steakhouse | 15x | 365d | +5.76% | +5.8% | 10.2% | +5.50% |
| Moonwell | 15x | 365d | +5.47% | +5.5% | 10.2% | +5.22% |
| Morpho Steakhouse | 15x | 270d | +4.00% | +5.4% | 13.0% | +3.95% |
| Morpho Steakhouse | 20x | 180d | +2.64% | +5.4% | 18.0% | +2.08% |
| Moonwell | 15x | 270d | +3.80% | +5.1% | 13.0% | +3.75% |
| Moonwell | 20x | 180d | +2.51% | +5.1% | 18.0% | +1.97% |
| Morpho Steakhouse | 30x | 90d | +1.24% | +5.0% | 16.3% | +1.08% |
| Morpho Steakhouse | 10x | 365d | +4.97% | +5.0% | 6.8% | +4.84% |
| Morpho Steakhouse | 15x | 180d | +2.39% | +4.8% | 7.4% | +1.99% |
| Morpho Steakhouse | 20x | 120d | +1.57% | +4.8% | 7.9% | +1.48% |

**VERDICT: MARGINAL** — Profitable with <20% liq but doesn't beat 10% APY threshold. Best safe: Morpho Steakhouse 15x 365d -> +5.8%/yr

---

#### San Francisco

**Price:** $1,006.48 -> $959.90 (-4.6%) | High: $1,091.85 | Low: $825.25
**Chart:** `▅▆▇▇▇█▇▅▇▇▇▇▅▄▄▁▂▃▂▃▂▂▂ ▂▃▃▃▃▂▃▁▁▃▅▄▂▂▄▂`
**Data:** 1827 days (2021-03-14 to 2026-03-14)

**Leverage × Duration Heatmap** (Morpho 5.2% APY — avg return % | liq %)

| Lev | 30d | 60d | 90d | 120d | 180d | 270d | 365d |
|-----|------|------|------|------|------|------|------|
| 1x | — | — | — | — | — | — | — |
| 2x | — | — | — | — | — | — | — |
| 3x | — | — | — | — | — | — | — |
| 5x | — | — | — | — | — | — | — |
| 10x | — | — | — | — | — | — | — |
| 15x | — | — | — | — | — | — | — |
| 20x | — | — | — | — | — | — | — |
| 30x | — | — | — | — | — | — | — |
| 50x | — | — | — | — | — | — | — |
| 75x | — | — | — | — | — | — | — |
| 100x | — | — | — | — | — | — | — |

**Protocol Comparison** (at 1x / 30d — best safe config)

| Protocol | APY | Budget | Avg Return | Ann. Return | Liq % | Beat Yield | P25 | Median | P75 |
|----------|-----|--------|-----------|-------------|-------|-----------|-----|--------|-----|
| Aave V3 | 2.5% | $20 | +0.20% | +2.4% | 0.0% | 26.8% | +0.19% | +0.20% | +0.20% |
| Morpho Steakhouse | 3.6% | $29 | +0.29% | +3.5% | 0.0% | 22.0% | +0.28% | +0.29% | +0.30% |
| Moonwell | 3.4% | $28 | +0.28% | +3.4% | 0.0% | 23.0% | +0.27% | +0.28% | +0.28% |

**No configs pass the worth-it test** (ann. return > 10% AND liq < 20%)
*Best safe configs (liq < 20%, positive return):*

| Protocol | Lev | Dur | Avg Ret | Ann. Ret | Liq % | Median |
|----------|-----|-----|---------|----------|-------|--------|
| Morpho Steakhouse | 1x | 30d | +0.29% | +3.5% | 0.0% | +0.29% |
| Morpho Steakhouse | 2x | 30d | +0.29% | +3.5% | 0.0% | +0.29% |
| Morpho Steakhouse | 1x | 60d | +0.58% | +3.5% | 0.0% | +0.58% |
| Morpho Steakhouse | 3x | 30d | +0.29% | +3.5% | 0.0% | +0.29% |
| Morpho Steakhouse | 1x | 90d | +0.87% | +3.5% | 0.0% | +0.87% |
| Morpho Steakhouse | 2x | 60d | +0.58% | +3.5% | 0.0% | +0.58% |
| Morpho Steakhouse | 5x | 30d | +0.29% | +3.5% | 0.0% | +0.29% |
| Morpho Steakhouse | 1x | 120d | +1.15% | +3.5% | 0.0% | +1.15% |
| Morpho Steakhouse | 2x | 90d | +0.86% | +3.5% | 0.0% | +0.86% |
| Morpho Steakhouse | 3x | 60d | +0.58% | +3.5% | 0.0% | +0.58% |

**VERDICT: MARGINAL** — Profitable with <20% liq but doesn't beat 10% APY threshold. Best safe: Morpho Steakhouse 1x 30d -> +3.5%/yr

---

#### Tampa

**Price:** $202.29 -> $296.80 (+46.7%) | High: $309.89 | Low: $202.29
**Chart:** `  ▁▁▁▁▃▃▃▄▅▆▅▅▅▄▄▅▆▆▇▆▆▆▅▇▇█▆▆▇▇▆▇▇▆▆▆▆▆`
**Data:** 1827 days (2021-03-14 to 2026-03-14)

**Leverage × Duration Heatmap** (Morpho 5.2% APY — avg return % | liq %)

| Lev | 30d | 60d | 90d | 120d | 180d | 270d | 365d |
|-----|------|------|------|------|------|------|------|
| 1x | — | — | — | — | — | — | — |
| 2x | — | — | — | — | — | — | — |
| 3x | — | — | — | — | — | — | — |
| 5x | — | — | — | — | — | — | — |
| 10x | — | — | — | — | — | — | — |
| 15x | — | — | — | — | — | — | — |
| 20x | — | — | — | — | — | — | — |
| 30x | — | — | — | — | — | — | — |
| 50x | — | — | — | — | — | — | — |
| 75x | — | — | — | — | — | — | — |
| 100x | — | — | — | — | — | — | — |

**Protocol Comparison** (at 15x / 365d — best safe config)

| Protocol | APY | Budget | Avg Return | Ann. Return | Liq % | Beat Yield | P25 | Median | P75 |
|----------|-----|--------|-----------|-------------|-------|-----------|-----|--------|-----|
| Aave V3 | 2.5% | $240 | +4.45% | +4.5% | 10.2% | 72.2% | +2.37% | +3.93% | +5.41% |
| Morpho Steakhouse | 3.6% | $349 | +6.47% | +6.5% | 10.2% | 71.7% | +3.45% | +5.72% | +7.88% |
| Moonwell | 3.4% | $332 | +6.15% | +6.2% | 10.2% | 71.8% | +3.27% | +5.43% | +7.48% |

**No configs pass the worth-it test** (ann. return > 10% AND liq < 20%)
*Best safe configs (liq < 20%, positive return):*

| Protocol | Lev | Dur | Avg Ret | Ann. Ret | Liq % | Median |
|----------|-----|-----|---------|----------|-------|--------|
| Morpho Steakhouse | 15x | 365d | +6.47% | +6.5% | 10.2% | +5.72% |
| Moonwell | 15x | 365d | +6.15% | +6.2% | 10.2% | +5.43% |
| Morpho Steakhouse | 15x | 270d | +4.37% | +5.9% | 9.1% | +3.72% |
| Morpho Steakhouse | 10x | 365d | +5.75% | +5.8% | 0.0% | +5.17% |
| Morpho Steakhouse | 20x | 180d | +2.81% | +5.7% | 17.0% | +2.48% |
| Moonwell | 15x | 270d | +4.14% | +5.6% | 9.1% | +3.53% |
| Moonwell | 10x | 365d | +5.46% | +5.5% | 0.0% | +4.91% |
| Moonwell | 20x | 180d | +2.66% | +5.4% | 17.0% | +2.36% |
| Morpho Steakhouse | 15x | 180d | +2.61% | +5.3% | 4.1% | +2.32% |
| Morpho Steakhouse | 10x | 270d | +3.89% | +5.2% | 0.0% | +3.38% |

**VERDICT: MARGINAL** — Profitable with <20% liq but doesn't beat 10% APY threshold. Best safe: Morpho Steakhouse 15x 365d -> +6.5%/yr

---

#### US National

**Price:** $167.76 -> $212.05 (+26.4%) | High: $217.06 | Low: $167.76
**Chart:** ` ▁▂▃▃▄▄▄▅▆▇▆▅▄▃▃▃▄▅▅▅▆▆▅▅▇▇█▇▇▇▆▆▇▇▇▇▇▇▇`
**Data:** 1827 days (2021-03-14 to 2026-03-14)

**Leverage × Duration Heatmap** (Morpho 5.2% APY — avg return % | liq %)

| Lev | 30d | 60d | 90d | 120d | 180d | 270d | 365d |
|-----|------|------|------|------|------|------|------|
| 1x | — | — | — | — | — | — | — |
| 2x | — | — | — | — | — | — | — |
| 3x | — | — | — | — | — | — | — |
| 5x | — | — | — | — | — | — | — |
| 10x | — | — | — | — | — | — | — |
| 15x | — | — | — | — | — | — | — |
| 20x | — | — | — | — | — | — | — |
| 30x | — | — | — | — | — | — | — |
| 50x | — | — | — | — | — | — | — |
| 75x | — | — | — | — | — | — | — |
| 100x | — | — | — | — | — | — | — |

**Protocol Comparison** (at 50x / 90d — best safe config)

| Protocol | APY | Budget | Avg Return | Ann. Return | Liq % | Beat Yield | P25 | Median | P75 |
|----------|-----|--------|-----------|-------------|-------|-----------|-----|--------|-----|
| Aave V3 | 2.5% | $60 | +1.01% | +4.1% | 17.8% | 58.3% | +0.18% | +0.83% | +1.59% |
| Morpho Steakhouse | 3.6% | $87 | +1.48% | +6.0% | 17.8% | 58.1% | +0.26% | +1.21% | +2.32% |
| Moonwell | 3.4% | $83 | +1.41% | +5.7% | 17.8% | 58.2% | +0.25% | +1.15% | +2.20% |

**No configs pass the worth-it test** (ann. return > 10% AND liq < 20%)
*Best safe configs (liq < 20%, positive return):*

| Protocol | Lev | Dur | Avg Ret | Ann. Ret | Liq % | Median |
|----------|-----|-----|---------|----------|-------|--------|
| Morpho Steakhouse | 50x | 90d | +1.48% | +6.0% | 17.8% | +1.21% |
| Morpho Steakhouse | 30x | 180d | +2.95% | +6.0% | 15.8% | +2.91% |
| Morpho Steakhouse | 20x | 365d | +5.72% | +5.7% | 16.8% | +5.16% |
| Moonwell | 50x | 90d | +1.41% | +5.7% | 17.8% | +1.15% |
| Moonwell | 30x | 180d | +2.80% | +5.7% | 15.8% | +2.76% |
| Morpho Steakhouse | 20x | 270d | +4.06% | +5.5% | 14.6% | +3.75% |
| Moonwell | 20x | 365d | +5.43% | +5.4% | 16.8% | +4.90% |
| Morpho Steakhouse | 30x | 120d | +1.75% | +5.3% | 12.2% | +1.61% |
| Morpho Steakhouse | 100x | 30d | +0.43% | +5.3% | 14.2% | +0.34% |
| Moonwell | 20x | 270d | +3.85% | +5.2% | 14.6% | +3.56% |

**VERDICT: MARGINAL** — Profitable with <20% liq but doesn't beat 10% APY threshold. Best safe: Morpho Steakhouse 50x 90d -> +6.0%/yr

---

#### Washington DC

**Price:** $549.47 -> $461.99 (-15.9%) | High: $602.38 | Low: $460.72
**Chart:** `▅▆▇▇▅▅▆▅▅▆▇█▆▄▄▃▂▃▅▅▅▄▅▂▂▃▄▅▅▄▄▃ ▃▅▄▄▂▂▃`
**Data:** 1827 days (2021-03-14 to 2026-03-14)

**Leverage × Duration Heatmap** (Morpho 5.2% APY — avg return % | liq %)

| Lev | 30d | 60d | 90d | 120d | 180d | 270d | 365d |
|-----|------|------|------|------|------|------|------|
| 1x | — | — | — | — | — | — | — |
| 2x | — | — | — | — | — | — | — |
| 3x | — | — | — | — | — | — | — |
| 5x | — | — | — | — | — | — | — |
| 10x | — | — | — | — | — | — | — |
| 15x | — | — | — | — | — | — | — |
| 20x | — | — | — | — | — | — | — |
| 30x | — | — | — | — | — | — | — |
| 50x | — | — | — | — | — | — | — |
| 75x | — | — | — | — | — | — | — |
| 100x | — | — | — | — | — | — | — |

**Protocol Comparison** (at 1x / 30d — best safe config)

| Protocol | APY | Budget | Avg Return | Ann. Return | Liq % | Beat Yield | P25 | Median | P75 |
|----------|-----|--------|-----------|-------------|-------|-----------|-----|--------|-----|
| Aave V3 | 2.5% | $20 | +0.20% | +2.4% | 0.0% | 28.8% | +0.20% | +0.20% | +0.20% |
| Morpho Steakhouse | 3.6% | $29 | +0.29% | +3.5% | 0.0% | 21.5% | +0.29% | +0.29% | +0.30% |
| Moonwell | 3.4% | $28 | +0.28% | +3.4% | 0.0% | 22.6% | +0.27% | +0.28% | +0.28% |

**No configs pass the worth-it test** (ann. return > 10% AND liq < 20%)
*Best safe configs (liq < 20%, positive return):*

| Protocol | Lev | Dur | Avg Ret | Ann. Ret | Liq % | Median |
|----------|-----|-----|---------|----------|-------|--------|
| Morpho Steakhouse | 1x | 30d | +0.29% | +3.5% | 0.0% | +0.29% |
| Morpho Steakhouse | 1x | 60d | +0.58% | +3.5% | 0.0% | +0.58% |
| Morpho Steakhouse | 2x | 30d | +0.29% | +3.5% | 0.0% | +0.29% |
| Morpho Steakhouse | 1x | 90d | +0.87% | +3.5% | 0.0% | +0.86% |
| Morpho Steakhouse | 3x | 30d | +0.29% | +3.5% | 0.0% | +0.29% |
| Morpho Steakhouse | 2x | 60d | +0.58% | +3.5% | 0.0% | +0.57% |
| Morpho Steakhouse | 1x | 120d | +1.15% | +3.5% | 0.0% | +1.14% |
| Morpho Steakhouse | 5x | 30d | +0.29% | +3.5% | 0.0% | +0.29% |
| Morpho Steakhouse | 2x | 90d | +0.86% | +3.5% | 0.0% | +0.85% |
| Morpho Steakhouse | 3x | 60d | +0.57% | +3.5% | 0.0% | +0.57% |

**VERDICT: MARGINAL** — Profitable with <20% liq but doesn't beat 10% APY threshold. Best safe: Morpho Steakhouse 1x 30d -> +3.5%/yr

---

## 3. Cross-Market Leaderboard

### Best Safe Config Per Market (liq < 20%)

| Rank | Market | Class | Protocol | Lev | Dur | Ann. Return | Liq % | Beat Morpho | Sims |
|------|--------|-------|----------|-----|-----|-------------|-------|-------------|------|
| 1 | **Solana** | Crypto | Morpho Steakhouse | 1x | 365d | +44.5% | 0.0% | 61.8% | 1,799 |
| 2 | **XRP** | Crypto | Morpho Steakhouse | 1x | 365d | +28.7% | 0.0% | 53.9% | 4,236 |
| 3 | **Ethereum** | Crypto | Morpho Steakhouse | 1x | 365d | +23.0% | 0.0% | 63.5% | 3,507 |
| 4 | **Bitcoin** | Crypto | Morpho Steakhouse | 2x | 270d | +10.4% | 19.9% | 69.6% | 4,432 |
| 5 | **Las Vegas** | Real Estate | Morpho Steakhouse | 20x | 365d | +7.2% | 17.0% | 68.5% | 1,462 |
| 6 | **Charlotte** | Real Estate | Morpho Steakhouse | 15x | 365d | +6.5% | 10.2% | 83.8% | 1,462 |
| 7 | **Tampa** | Real Estate | Morpho Steakhouse | 15x | 365d | +6.5% | 10.2% | 71.7% | 1,462 |
| 8 | **Miami** | Real Estate | Morpho Steakhouse | 10x | 365d | +6.3% | 8.6% | 69.8% | 1,462 |
| 9 | **US National** | Real Estate | Morpho Steakhouse | 50x | 90d | +6.0% | 17.8% | 58.1% | 1,737 |
| 10 | **Nashville** | Real Estate | Morpho Steakhouse | 15x | 365d | +5.8% | 9.2% | 59.4% | 1,462 |
| 11 | **San Diego** | Real Estate | Morpho Steakhouse | 15x | 365d | +5.8% | 10.2% | 61.1% | 1,462 |
| 12 | **Gold (XAU)** | Commodities | Morpho Steakhouse | 5x | 365d | +5.7% | 9.9% | 64.8% | 3,707 |
| 13 | **Miami Beach** | Real Estate | Morpho Steakhouse | 10x | 365d | +5.3% | 4.7% | 84.8% | 1,462 |
| 14 | **New York City** | Real Estate | Morpho Steakhouse | 15x | 270d | +5.0% | 18.4% | 67.6% | 1,557 |
| 15 | **Silver (XAG)** | Commodities | Morpho Steakhouse | 3x | 365d | +4.6% | 13.6% | 49.6% | 3,707 |
| 16 | **Chicago** | Real Estate | Morpho Steakhouse | 15x | 90d | +4.2% | 19.2% | 41.8% | 1,737 |
| 17 | **Los Angeles** | Real Estate | Morpho Steakhouse | 15x | 365d | +4.2% | 18.0% | 58.3% | 1,462 |
| 18 | **Brooklyn** | Real Estate | Morpho Steakhouse | 10x | 270d | +4.1% | 15.5% | 61.0% | 1,557 |
| 19 | **Pittsburgh** | Real Estate | Morpho Steakhouse | 5x | 270d | +4.1% | 14.8% | 60.9% | 1,557 |
| 20 | **Atlanta** | Real Estate | Morpho Steakhouse | 30x | 30d | +4.0% | 16.8% | 51.6% | 1,797 |
| 21 | **Boston** | Real Estate | Morpho Steakhouse | 5x | 365d | +3.9% | 0.0% | 62.8% | 1,462 |
| 22 | **Denver** | Real Estate | Morpho Steakhouse | 20x | 60d | +3.8% | 14.8% | 46.8% | 1,767 |
| 23 | **San Francisco** | Real Estate | Morpho Steakhouse | 1x | 30d | +3.5% | 0.0% | 22.0% | 1,797 |
| 24 | **Austin** | Real Estate | Morpho Steakhouse | 1x | 30d | +3.5% | 0.0% | 27.2% | 1,797 |
| 25 | **Washington DC** | Real Estate | Morpho Steakhouse | 1x | 30d | +3.5% | 0.0% | 21.5% | 1,797 |

### Annualized Return Comparison (best safe config)

```
                Solana | ████████████████████████████████████████ +44.5%
                   XRP | █████████████████████████░░░░░░░░░░░░░░░ +28.7%
              Ethereum | ████████████████████░░░░░░░░░░░░░░░░░░░░ +23.0%
               Bitcoin | █████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ +10.4%
             Las Vegas | ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ +7.2%
             Charlotte | █████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ +6.5%
                 Tampa | █████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ +6.5%
                 Miami | █████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ +6.3%
           US National | █████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ +6.0%
             Nashville | █████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ +5.8%
             San Diego | █████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ +5.8%
            Gold (XAU) | █████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ +5.7%
           Miami Beach | ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ +5.3%
         New York City | ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ +5.0%
          Silver (XAG) | ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ +4.6%
               Chicago | ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ +4.2%
           Los Angeles | ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ +4.2%
              Brooklyn | ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ +4.1%
            Pittsburgh | ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ +4.1%
               Atlanta | ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ +4.0%
                Boston | ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ +3.9%
                Denver | ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ +3.8%
         San Francisco | ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ +3.5%
                Austin | ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ +3.5%
         Washington DC | ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ +3.5%
```

## 4. Leverage Sweet Spot Analysis

*For each leverage level, what's the average liquidation rate and return across all markets?*
*Using Morpho 5.2%, 180d duration.*

### Commodities

| Leverage | Avg Return | Avg Liq % | Avg Ann. | Markets w/ <20% Liq | Verdict |
|---------|-----------|-----------|----------|--------------------|---------| 

### Crypto

| Leverage | Avg Return | Avg Liq % | Avg Ann. | Markets w/ <20% Liq | Verdict |
|---------|-----------|-----------|----------|--------------------|---------| 

### Real Estate

| Leverage | Avg Return | Avg Liq % | Avg Ann. | Markets w/ <20% Liq | Verdict |
|---------|-----------|-----------|----------|--------------------|---------| 

## 5. How Much Does Yield Protocol Matter?

*Same leverage (20x), same duration (180d), different yield source:*

| Protocol | APY | Budget ($10k) | Avg Return (all mkts) | Budget Multiplier vs Aave |
|----------|-----|--------------|----------------------|--------------------------|
| Aave V3 | 2.5% | $119.08 | +3.47% | 0.65x |
| Morpho Steakhouse | 3.6% | $173.89 | +5.07% | 0.95x |
| Moonwell | 3.4% | $164.97 | +4.81% | 0.91x |

**Takeaway:** Moving from Aave (3.8%) to Moonwell (6.1%) gives **1.58x more exposure budget** —
same principal protection, same liquidation risk, but proportionally larger upside.

## 6. Duration Impact

*Morpho 5.2%, 20x leverage, across all markets:*

| Duration | Avg Budget | Avg Return | Avg Liq % | Avg Ann. Return |
|---------|-----------|-----------|-----------|----------------|

## 7. Return Distribution (P10/P25/Median/P75/P90)

*Best safe config for each market:*

| Market | Avg | P10 | P25 | Median | P75 | P90 | Best | Worst |
|--------|-----|-----|-----|--------|-----|-----|------|-------|
| **Solana** | +44.49% | +0.80% | +2.10% | +5.53% | +25.44% | +168.58% | +624.68% | +0.18% |
| **XRP** | +28.74% | +1.61% | +2.43% | +3.99% | +9.70% | +20.98% | +1867.03% | +0.37% |
| **Ethereum** | +23.02% | +1.64% | +2.71% | +5.48% | +23.87% | +52.55% | +524.39% | +0.28% |
| **Bitcoin** | +7.69% | +0.00% | +1.14% | +5.11% | +8.87% | +20.04% | +97.82% | +0.00% |
| **Las Vegas** | +7.20% | +0.00% | +1.95% | +6.79% | +8.46% | +17.70% | +25.10% | +0.00% |
| **Charlotte** | +6.54% | +0.00% | +4.16% | +5.19% | +8.46% | +14.51% | +16.15% | +0.00% |
| **Tampa** | +6.47% | +0.00% | +3.45% | +5.72% | +7.88% | +15.55% | +17.53% | +0.00% |
| **Miami** | +6.32% | +1.85% | +3.32% | +4.48% | +6.93% | +14.81% | +20.18% | +0.00% |
| **US National** | +1.48% | +0.00% | +0.26% | +1.21% | +2.32% | +3.55% | +4.82% | +0.00% |
| **Nashville** | +5.76% | +2.24% | +3.04% | +4.09% | +7.33% | +14.24% | +17.81% | +0.00% |
| **San Diego** | +5.76% | +0.00% | +2.12% | +5.50% | +8.02% | +10.77% | +18.73% | +0.00% |
| **Gold (XAU)** | +5.74% | +0.21% | +2.97% | +4.71% | +8.30% | +11.89% | +23.78% | +0.00% |
| **Miami Beach** | +5.30% | +2.68% | +4.17% | +5.37% | +6.63% | +8.11% | +10.04% | +0.00% |
| **New York City** | +3.66% | +0.00% | +1.98% | +3.85% | +5.52% | +6.80% | +8.53% | +0.00% |
| **Silver (XAG)** | +4.59% | +0.00% | +1.47% | +3.56% | +6.35% | +10.28% | +36.58% | +0.00% |
| **Chicago** | +1.03% | +0.00% | +0.13% | +0.58% | +1.89% | +2.79% | +3.59% | +0.00% |
| **Los Angeles** | +4.18% | +0.00% | +2.27% | +4.11% | +5.86% | +7.83% | +11.99% | +0.00% |
| **Brooklyn** | +3.06% | +0.00% | +2.21% | +3.07% | +4.05% | +5.32% | +8.77% | +0.00% |
| **Pittsburgh** | +3.04% | +0.00% | +1.45% | +3.32% | +4.45% | +5.24% | +8.15% | +0.00% |
| **Atlanta** | +0.32% | +0.00% | +0.10% | +0.31% | +0.51% | +0.69% | +1.00% | +0.00% |
| **Boston** | +3.86% | +2.71% | +3.16% | +3.90% | +4.52% | +4.92% | +5.79% | +1.87% |
| **Denver** | +0.62% | +0.00% | +0.25% | +0.56% | +0.88% | +1.27% | +2.36% | +0.00% |
| **San Francisco** | +0.29% | +0.28% | +0.28% | +0.29% | +0.30% | +0.31% | +0.34% | +0.27% |
| **Austin** | +0.29% | +0.28% | +0.28% | +0.29% | +0.30% | +0.31% | +0.36% | +0.22% |
| **Washington DC** | +0.29% | +0.28% | +0.29% | +0.29% | +0.30% | +0.30% | +0.31% | +0.27% |

## 8. Final Conclusions

### Markets WORTH offering as PPN underlyings

These markets deliver >10% annualized return with <20% liquidation rate:

- **Solana** (Crypto): +44.5%/yr at 0.0% liq — Morpho Steakhouse 1x 365d — 8 valid configs
- **XRP** (Crypto): +28.7%/yr at 0.0% liq — Morpho Steakhouse 1x 365d — 7 valid configs
- **Ethereum** (Crypto): +23.0%/yr at 0.0% liq — Morpho Steakhouse 1x 365d — 7 valid configs
- **Bitcoin** (Crypto): +10.4%/yr at 19.9% liq — Morpho Steakhouse 2x 270d — 1 valid configs

### Marginal markets (profitable but don't beat 10% APY)

- **Las Vegas** (Real Estate): +7.2%/yr at 17.0% liq — best safe: Morpho Steakhouse 20x 365d
- **Charlotte** (Real Estate): +6.5%/yr at 10.2% liq — best safe: Morpho Steakhouse 15x 365d
- **Tampa** (Real Estate): +6.5%/yr at 10.2% liq — best safe: Morpho Steakhouse 15x 365d
- **Miami** (Real Estate): +6.3%/yr at 8.6% liq — best safe: Morpho Steakhouse 10x 365d
- **US National** (Real Estate): +6.0%/yr at 17.8% liq — best safe: Morpho Steakhouse 50x 90d
- **Nashville** (Real Estate): +5.8%/yr at 9.2% liq — best safe: Morpho Steakhouse 15x 365d
- **San Diego** (Real Estate): +5.8%/yr at 10.2% liq — best safe: Morpho Steakhouse 15x 365d
- **Gold (XAU)** (Commodities): +5.7%/yr at 9.9% liq — best safe: Morpho Steakhouse 5x 365d
- **Miami Beach** (Real Estate): +5.3%/yr at 4.7% liq — best safe: Morpho Steakhouse 10x 365d
- **New York City** (Real Estate): +5.0%/yr at 18.4% liq — best safe: Morpho Steakhouse 15x 270d
- **Silver (XAG)** (Commodities): +4.6%/yr at 13.6% liq — best safe: Morpho Steakhouse 3x 365d
- **Chicago** (Real Estate): +4.2%/yr at 19.2% liq — best safe: Morpho Steakhouse 15x 90d
- **Los Angeles** (Real Estate): +4.2%/yr at 18.0% liq — best safe: Morpho Steakhouse 15x 365d
- **Brooklyn** (Real Estate): +4.1%/yr at 15.5% liq — best safe: Morpho Steakhouse 10x 270d
- **Pittsburgh** (Real Estate): +4.1%/yr at 14.8% liq — best safe: Morpho Steakhouse 5x 270d
- **Atlanta** (Real Estate): +4.0%/yr at 16.8% liq — best safe: Morpho Steakhouse 30x 30d
- **Boston** (Real Estate): +3.9%/yr at 0.0% liq — best safe: Morpho Steakhouse 5x 365d
- **Denver** (Real Estate): +3.8%/yr at 14.8% liq — best safe: Morpho Steakhouse 20x 60d
- **San Francisco** (Real Estate): +3.5%/yr at 0.0% liq — best safe: Morpho Steakhouse 1x 30d
- **Austin** (Real Estate): +3.5%/yr at 0.0% liq — best safe: Morpho Steakhouse 1x 30d
- **Washington DC** (Real Estate): +3.5%/yr at 0.0% liq — best safe: Morpho Steakhouse 1x 30d

### Markets NOT worth it

None — all markets have at least some safe profitable config.

### Strategic Recommendations

1. **Launch with:** Solana, XRP, Ethereum, Bitcoin
2. **Recommended default config:** Morpho Steakhouse (5.2%), 10-20x leverage, 180d duration
3. **For conservative users:** Moonwell (6.1%), 5x leverage, 365d — virtually zero liquidation risk
4. **For aggressive users:** Moonwell (6.1%), 20-50x, 365d — largest budget of the three protocols, accept higher liq risk
5. **Real estate advantage:** 2-7% annual volatility vs 50-80% for crypto — dramatically safer for leveraged positions
6. **Gold is unique:** Strong uptrend + moderate volatility = best risk-adjusted PPN asset overall
7. **Avoid:** Markets with negative 5-year trends (Austin, SF, DC) unless offering short durations only

### The Math That Makes It Work

```
$10,000 deposit at Morpho 5.2% APY, 180 days:

  To yield vault: $9,753.11  (grows back to $10,000 at maturity)
  Exposure budget: $246.89  (used as margin)

  At 20x leverage:
    Notional exposure: $4,937.89
    Liquidation threshold: -5.0% asset drop
    If asset +10%: profit = $493.79 (4.9% on deposit)
    If asset -10%: liquidated, user gets $10,000 back (principal protected)

  At Moonwell 6.1% APY, 365 days:
    Exposure budget: $574.93 (vs $246.89 at Morpho 180d)
    At 20x: notional = $11,498.59
    If asset +10%: profit = $1,149.86 (11.5% on deposit)
```

---

*Generated by PPN Ultimate Backtest. 12,523,401 simulations across 25 assets.*
*Data: Yahoo Finance (metals), CoinGecko Pro (crypto), Parcl Labs (real estate).*
*Report date: 2026-03-15 04:52*