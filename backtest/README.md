# PPN.fi — Principal-Protected Notes on DeFi

**The first RWA Perps & Vaults platform that guarantees you never lose your deposit.**

[ppnfi.xyz](https://ppnfi.xyz) | Built on Base

---

## The Problem

**$4.8 trillion** sits in savings accounts earning 3-4% APY. Meanwhile:

- Crypto markets returned 50-150%+ in bull years — but people are terrified of losing their principal
- Real estate has appreciated 20-55% across US cities in 5 years — but there's no easy way to get leveraged exposure
- Gold hit all-time highs at $5,318/oz — but retail investors can't access leveraged commodities without margin call risk
- DeFi yields (5-15%) are 2-4x higher than TradFi savings — but nobody's using that yield advantage strategically

**The core tension:** People want upside exposure to assets, but they can't stomach the risk of losing their money.

## The Solution: Principal-Protected Notes (PPNs)

PPN.fi uses a **zero-coupon bond + leveraged exposure** structure borrowed from TradFi — but powered by DeFi yields.

```
User deposits $10,000 USDC
  |
  +-- $9,753 --> Morpho/Aave/Moonwell yield vault
  |     (grows back to exactly $10,000 at maturity via zero-coupon math)
  |
  +-- $247 = exposure budget
        (used as margin for leveraged position on chosen asset)

At maturity:
  Vault returns:    $10,000 (guaranteed by yield growth)
  Position returns: margin + PnL (if not liquidated) or $0 (if liquidated)
  TOTAL:           >= $10,000 ALWAYS
```

**The formula:** `Present Value = Future Value / (1 + rate)^time`

This guarantees the vault portion grows to EXACTLY the deposit. The exposure budget is yield the user hasn't earned yet — it's "free money" to play with. If the leveraged position gets liquidated, the user loses nothing from their deposit. **Worst case = full deposit back.**

## Backed by Data: 20.8 Million Simulations

We didn't just theorize — we ran **20,872,335 backtests** against real historical data from 3 independent sources:

| Source | Assets | Data Range | Data Points |
|--------|--------|-----------|-------------|
| **Yahoo Finance** | Gold (GC=F), Silver (SI=F) COMEX futures | 2010-01-04 to 2026-03-13 | 8,144 |
| **CoinGecko Pro** | Bitcoin, Ethereum, Solana, XRP | 2013-04-28 to 2026-03-14 | 15,339 |
| **Parcl Labs** | 19 US real estate city indexes ($/sqft) | 2021-03-14 to 2026-03-14 | 34,713 |

**Total: 58,196 daily price data points across 25 assets.**

### The Result

| Metric | Value |
|--------|-------|
| **Principal protection rate** | **100.0000%** |
| **Total simulations** | **20,872,335** |
| **Assets tested** | 25 (commodities, crypto, real estate) |
| **Yield protocols** | Aave V3 (3.8%), Morpho (5.2%), Moonwell (6.1%), 10%, 15% |
| **Leverage levels** | 1x, 2x, 3x, 5x, 10x, 15x, 20x, 30x, 50x, 75x, 100x |
| **Durations** | 30d, 60d, 90d, 120d, 180d, 270d, 365d |
| **Protection failures** | **ZERO** |

> Not a single dollar of deposit was ever lost, across every asset, every leverage level, every duration, and every entry date tested.

### Market Leaderboard (Best Safe Config - <20% Liquidation)

```
                Solana | ########################################          +166.1%/yr
                   XRP | #########################                         +107.3%/yr
              Ethereum | ####################                               +85.9%/yr
               Bitcoin | #########                                          +39.3%/yr
             Las Vegas | ######                                             +26.9%/yr
             Charlotte | #####                                              +24.4%/yr
                 Tampa | #####                                              +24.2%/yr
                 Miami | #####                                              +23.6%/yr
           US National | #####                                              +23.3%/yr
             Nashville | #####                                              +21.6%/yr
             San Diego | #####                                              +21.5%/yr
            Gold (XAU) | #####                                              +21.4%/yr
           Miami Beach | ####                                               +19.8%/yr
         New York City | ####                                               +18.7%/yr
          Silver (XAG) | ####                                               +17.5%/yr
```

**All 25 markets passed the worth-it test** (>10% annualized return with <20% liquidation rate).

### Key Conclusions from Backtesting

1. **Real estate is the killer use case for PPNs.** Annual volatility of 2-7% vs 50-80% for crypto means dramatically lower liquidation rates. At 15x leverage with Peak DeFi yield, Tampa delivers +24.2%/yr with only 10.2% liquidation.

2. **DeFi yield advantage is real and quantifiable.** Moving from Aave (3.8%) to a 15% yield source gives 3.65x more exposure budget. Same principal protection, same liquidation risk, proportionally larger upside.

3. **Gold is the best risk-adjusted PPN asset.** 16 years of daily data (2010-2026), +352% total return, and at Peak DeFi 5x leverage it delivers +21.4%/yr with only 9.9% liquidation.

4. **The sweet spot exists.** For real estate: 10-20x leverage, 180-365d duration. For crypto: 1-5x leverage (the asset does the heavy lifting). For metals: 3-10x leverage.

5. **Protocol choice doesn't change liquidation risk — only upside.** At 20x leverage / 180d, liquidation rate is 36.9% regardless of whether you use Aave or Peak DeFi. But Peak DeFi gives $666 exposure budget vs $182 for Aave — 3.65x more upside for the same risk.

---

## Platform Architecture

### How PPN.fi Works

PPN.fi is a **RWA Perps & Vaults** platform on Base that combines three DeFi primitives:

#### 1. Principal-Protected Notes (PPNs)

The user-facing product. Users deposit USDC, pick an asset (gold, Bitcoin, Miami real estate, etc.), choose a duration, and the protocol handles the split:

- **Yield portion** -> routed to Morpho Steakhouse, Aave V3, or Moonwell vaults
- **Exposure portion** -> opens a leveraged perpetual position on the chosen asset

At maturity, the yield portion has grown back to the full deposit amount. The position either made money (user profits) or got liquidated (user gets deposit back, no loss).

#### 2. RWA Perpetual Markets

The platform operates perpetual swap markets for real-world assets:

- **19 US real estate city indexes** via Parcl Labs price feeds (NYC, Miami, LA, SF, San Diego, Las Vegas, Tampa, Nashville, Charlotte, Atlanta, Chicago, Boston, DC, Denver, Brooklyn, Pittsburgh, Miami Beach, Austin, US National)
- **Commodities** — Gold (XAU), Silver (XAG), WTI Crude Oil, Natural Gas
- **Crypto** — Bitcoin, Ethereum, Solana, XRP
- **Forex** — USD/INR, EUR/USD, GBP/USD

These are fully on-chain perpetual markets where PPN exposure positions trade. Advanced users can also trade these markets directly.

#### 3. Liquidity Vaults

LPs deposit USDC into vaults that serve as the counterparty to all PPN positions and perp trades.

**How vaults make money:**
- **Trading fees** — collected on every position open/close
- **Liquidation proceeds** — when leveraged positions are liquidated, the vault captures the remaining margin
- **Funding rate** — perpetual markets charge periodic funding rates that flow to LPs
- **Spread** — bid/ask spread on position execution

**How APY is determined:**
- Vault APY = (Total fees collected + Liquidation proceeds + Funding income) / Total vault TVL
- Higher trading volume = higher APY for LPs
- Real estate PPNs are particularly valuable for vault liquidity because the low volatility means fewer sudden liquidations and more predictable fee income

**Why real estate indexes are a game-changer for vaults:**
- RE indexes move 2-7% annualized vs 50-80% for crypto
- This means the vault's risk is dramatically lower as a counterparty
- More users willing to take leveraged RE positions = more fee volume
- Lower liquidation rates = more positions stay open longer = more funding fees
- **The vault effectively becomes a yield-generating machine powered by steady RE appreciation**

### Economics of the Platform

```
Revenue Sources:
  +-- Trading fees (0.05-0.1% per trade)
  +-- PPN creation fees (flat fee per shield)
  +-- Spread on position execution
  +-- Funding rate income (long/short imbalance)
  +-- Liquidation fee (% of liquidated margin)

Revenue Distribution:
  +-- 70% --> LP Vault (drives APY for liquidity providers)
  +-- 20% --> Protocol treasury
  +-- 10% --> Insurance fund (covers edge cases)

User Economics:
  PPN User:
    Pays: creation fee + trading fee
    Gets: principal protection + leveraged upside
    Worst case: $10,000 in --> $10,000 out (minus fees)
    Best case: $10,000 in --> $10,000 + leveraged gains

  LP (Vault depositor):
    Pays: opportunity cost of capital
    Gets: share of all trading fees + liquidation proceeds
    Risk: temporary drawdown if many positions profit simultaneously
    Edge: house advantage -- most leveraged positions get liquidated
```

### Integration Partners & Sponsors

PPN.fi integrates with best-in-class infrastructure:

- **Morpho** — Primary yield source. Morpho Steakhouse vault provides 5.2% APY on USDC, powering the zero-coupon bond math. The largest exposure budget after internal vaults.

- **Aave V3** — Battle-tested lending protocol. 3.8% APY baseline yield. Provides redundancy — if one yield source has issues, positions can route to Aave.

- **Moonwell** — Base-native lending market. 6.1% APY on USDC. Higher yield = larger exposure budgets for users.

- **Parcl Labs** — Real estate price oracle. Provides daily $/sqft index prices for 19+ US cities. This is the data backbone for RE perpetual markets. Parcl's on-chain price feeds enable the first leveraged real estate exposure product.

- **Elsa AI Agents** — AI-powered trading agents that can manage PPN positions, optimize entry timing, and automate the shield creation process. Enables hands-off yield optimization.

- **BitGo** — Institutional-grade custody and settlement. Ensures large deposits and vault TVL are secured with multi-sig and cold storage infrastructure.

- **ENS (Ethereum Name Service)** — Human-readable wallet identity. Users see their .eth names throughout the platform instead of hex addresses.

- **Base** — Coinbase's L2. Low gas costs (~$0.01 per transaction), fast confirmation times, and access to Coinbase's 100M+ user distribution channel. PPN.fi is a **Base DeFi RWA Primitive** — a foundational building block for the RWA ecosystem on Base.

### Why Base? Why These Integrations?

**Base** was chosen because:
- Cheapest L2 for frequent DeFi transactions (PPNs require multiple contract calls)
- Coinbase distribution — potential access to retail users who want principal protection
- Growing RWA ecosystem — Parcl, Morpho, Moonwell all have strong Base presence
- Sequencer uptime and reliability for financial products

**Morpho/Aave/Moonwell** provide the yield layer because:
- Battle-tested smart contracts (billions in TVL)
- Predictable, sustainable yields (not ponzi APY)
- The backtest proves that even at "conservative" 5.2%, the PPN math works across 20.8M simulations

**Parcl Labs** enables the RE use case because:
- Only reliable on-chain source for US real estate price indexes
- Daily granularity (1,827 data points per city over 5 years)
- 19 cities = 19 markets = massive product surface area
- RE + PPNs is the killer combo: low volatility + leveraged exposure + principal protection

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite, Tailwind CSS, shadcn/ui, Framer Motion |
| **Web3** | Wagmi 2, RainbowKit 2, ethers.js 6, viem 2 |
| **Backend** | Express 5, Socket.io (real-time prices) |
| **Smart Contracts** | Solidity 0.8.28, Hardhat 2.27 |
| **Chain** | Base (Coinbase L2) |
| **Yield Sources** | Morpho Steakhouse, Aave V3, Moonwell |
| **Price Feeds** | Parcl Labs (RE), Yahoo Finance (metals), CoinGecko (crypto) |
| **Backtesting** | Python 3, yfinance, 20.8M simulations |

## Backtest Methodology

The backtest engine runs the exact same zero-coupon bond + leveraged exposure math that the smart contracts execute, against real historical prices. No approximations, no monte carlo — every single possible entry date for every asset is tested.

### Data Sources

```
Gold & Silver:    Yahoo Finance COMEX Futures (GC=F, SI=F)
                  4,072 daily closing prices, 2010-01-04 to 2026-03-13

Bitcoin:          CoinGecko Pro API
                  4,702 daily prices, 2013-04-28 to 2026-03-14

Ethereum:         CoinGecko Pro API
                  3,872 daily prices, 2015-08-07 to 2026-03-14

Solana:           CoinGecko Pro API
                  2,164 daily prices, 2020-04-11 to 2026-03-14

XRP:              CoinGecko Pro API
                  4,601 daily prices, 2013-08-04 to 2026-03-14

Real Estate:      Parcl Labs Price Feed API
  19 US cities    https://express-prod.parcl-api.com/v1/market/{ticker}/price-feed?window=5y
                  1,827 daily prices each, 2021-03-14 to 2026-03-14

  Tickers: NY-NYC, NY-BRK, CA-LA, CA-SF, CA-SD, FL-MIA, FL-MB,
           TX-AUS, CO-DEN, GA-ATL, IL-CHI, MA-BOS, DC-WAS,
           PA-PIT, NC-CHA, FL-TPA, NV-LV, TN-NASH, NA-US
```

### Simulation Parameters

- **Deposit:** $10,000 per simulation
- **Yield protocols:** 5 (3.8% to 15% APY)
- **Leverages:** 11 levels (1x to 100x)
- **Durations:** 7 (30d to 365d)
- **Entry dates:** Every possible date in each asset's history
- **Liquidation:** Intra-period check (if price touches liquidation level at ANY point during holding period, position is liquidated)
- **Total combinations:** 25 assets x 5 yields x 11 leverages x 7 durations = 9,625 configs
- **Total simulations:** 20,872,335

### Running the Backtest

```bash
cd backtest
pip install -r requirements.txt

# Full run -- all assets, all configs
python run_full_analysis.py

# Quick test -- fewer configs
python main.py --quick

# Real estate deep analysis
python analyze_re_ppn.py

# Real estate market analytics (no PPN, just price analysis)
python analyze_real_estate.py
```

### Output Files

| File | Description |
|------|-------------|
| `results/ULTIMATE_PPN_REPORT.md` | Complete report -- worth-it verdicts, heatmaps, charts, conclusions |
| `results/RE_PPN_DETAILED_REPORT.md` | Per-market real estate PPN analysis with protocol comparisons |
| `results/REAL_ESTATE_REPORT.md` | Real estate market analytics (CAGR, volatility, Sharpe, PPN scores) |
| `results/ultimate_results.json` | Raw simulation data (9,625 aggregated configs) |
| `results/ultimate_charts_data.json` | Chart-ready data grouped by asset class |
| `results/full_results.json` | Full backtest aggregated results |
| `results/summary.txt` | Quick-read text summary |
| `results/by_asset/*.csv` | Per-asset trade-level CSV data |
| `results/parcl_data/*.json` | Raw Parcl Labs price data per city |

---

## The Big Picture

PPN.fi sits at the intersection of three massive trends:

1. **RWA tokenization** ($16T+ addressable market) — we make real estate, gold, and commodities tradeable on-chain
2. **DeFi yield** ($100B+ TVL) — we use DeFi's yield advantage to fund principal protection that TradFi can't match
3. **Retail demand for safe exposure** — 95% of people won't touch leveraged products, but PPNs make it safe

The backtest proves the math works. 20.8 million simulations, 25 assets, 16 years of data, zero principal losses. Every market — from Miami real estate to Bitcoin to Gold — has safe configs that beat 10% APY with under 20% liquidation risk.

**This isn't a yield farm. This isn't a ponzi. It's TradFi structured product math, powered by DeFi yields, made accessible to everyone.**

---

*Built with data. Backed by math. Protected by design.*

*PPN.fi — [ppnfi.xyz](https://ppnfi.xyz)*
