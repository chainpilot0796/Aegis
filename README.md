# Aegis — Principal-Protected RWA Shield on Mantle

**Hold USDY or mETH. Tell the agent what you're worried about. It sizes a hedge, you deposit, and at maturity you get back *at least* your principal — plus upside if the market moved your way. Every recommendation is committed on-chain and auditable.**

> Submission to the **Mantle Turing Test Hackathon 2026 — Track 3: AI × RWA**
> *"Dynamic yield strategies and automated risk management for assets including USDY and mETH, built on Mantle's RWA infrastructure."*

---

## One sentence

An AI agent recommends and **sizes** a principal-protected hedge over Mantle RWAs (USDY / mETH), runs a compliance check, commits a hash of its full reasoning on-chain, and settles the position in the `AegisVault` contract — so the user's principal is mathematically protected and the agent's decision is independently verifiable.

## What it does, in four lines

1. The user states a concern in natural language ("I hold mETH and fear an ETH drawdown but still want yield"). The **AI advisor** picks the hedge asset **and derives the risk parameters** — hedge ratio and principal-protection clamp — from the asset's volatility. This is risk management, not a chatbot.
2. A **compliance check** classifies the asset's regulatory posture (USDY = regulated yield instrument; mETH = liquid-staking token), validates jurisdiction / accreditation, and blocks sanctioned or ineligible flows.
3. The recommendation, risk parameters, and compliance verdict are packed into a **shield envelope**, hashed (keccak256), and the hash is committed on-chain in the `Shield` record. Anyone can re-hash the published envelope and confirm it matches — the agent cannot rewrite history.
4. The user deposits USDY into **`AegisVault`** on Mantle. At maturity they receive **at minimum** their principal, **plus** an exposure payout if the asset moved in their favor. The protocol takes a **fee on the upside only** (never principal).

## Why this fits AI × RWA

| Rubric line | How Aegis answers it |
|---|---|
| **AI × RWA integration depth** | The AI doesn't just name an asset — it sizes the hedge ratio and principal clamp from volatility, and its output is hashed on-chain and auditable. |
| **Mantle network integration** | `AegisVault` + the RWA tokens are deployed on Mantle; deposit, shield creation, and settlement are all on-chain Mantle transactions. Targets the canonical Mantle RWAs **USDY** and **mETH**. |
| **Compliance awareness** | A dedicated compliance service classifies asset regulatory class, enforces jurisdiction/accreditation rules, and hard-rejects sanctioned jurisdictions — with AI assistance and a deterministic fallback. |
| **Real-world validity (Path B)** | Clear asset class (yield-bearing RWAs), clear users (USDY/mETH holders wanting downside protection), end-to-end UX from concern → on-chain shield. |
| **Business model** | `protocolFeeBps` — a fee skimmed from positive exposure payouts only. No token required; revenue scales with delivered upside. |

## On-chain deployment — Mantle Sepolia (chain id `5003`), verified end-to-end

| Contract | Address |
|---|---|
| **AegisVault** | [`0x2dD69482E709b864EB6791f5948Bdc1e96981638`](https://sepolia.mantlescan.xyz/address/0x2dD69482E709b864EB6791f5948Bdc1e96981638) |
| **USDY** (deposit / settlement asset) | [`0x0Ab24f25f0Be64BF9AD9857a9f12CE1d11157Ff1`](https://sepolia.mantlescan.xyz/address/0x0Ab24f25f0Be64BF9AD9857a9f12CE1d11157Ff1) |
| **mETH** (hedge target) | [`0x9D504DAE235A128b48401EdE055CE729394a937A`](https://sepolia.mantlescan.xyz/address/0x9D504DAE235A128b48401EdE055CE729394a937A) |

Deploy tx: [`0x568b5b60…d82bac5`](https://sepolia.mantlescan.xyz/tx/0x568b5b601266704f562cf4dcc7c0531a41c0e0b2466b25b7895b2fb77d82bac5) · deployer / owner / relayer `0x7176DC1B76a17BB502324Dd825EaB983F675DD7a`

> USDY and mETH only exist as live assets on Mantle mainnet. On testnet they are faucet-backed `MockRWAToken` stand-ins so the full flow runs end-to-end. On mainnet the vault is pointed at the canonical USDY address.

### Verified on-chain smoke test (live)

`contracts/scripts/smoke.js` runs the full lifecycle against the live deployment — **8/8 on-chain checks pass**: faucet → approve → `createShield` (with envelope rootHash) → `getShield` read-back (on-chain hash == envelope hash) → `fundBonusPool` → `settleShield` (principal + bonus − fee) → fee accrual.

```bash
cd contracts && npx hardhat run scripts/smoke.js --network mantleSepolia
```

## Architecture

```
Browser (Wagmi + RainbowKit)  ◀──── Mantle (5003) ──── AegisVault.sol + USDY/mETH (MockRWAToken)
        │                                                  ▲
        │  REST                                            │ wagmi txs (faucet, approve, createShield)
        ▼                                                  │
Aegis API (server/, Express + Mongoose)
        │
        ├──▶ aiAdvisorService     pick asset + size hedge from volatility (NIM → heuristic fallback)
        ├──▶ complianceService    asset class + jurisdiction/accreditation gate
        ├──▶ shieldEnvelopeService keccak256 envelope → on-chain rootHash → /verify, /doc
        └──▶ Mantle relayer       settleShield at maturity
```

The on-chain `storageRootHash` in each `Shield` is the keccak256 of the off-chain envelope `{ recommendation, riskParams, compliance, deposit, … }` (`version: aegis-mantle-1`). `GET /api/yield-shield/doc/:rootHash` serves the envelope and self-verifies the hash.

## Repository layout

```
contracts/                       Hardhat workspace (Mantle)
  contracts/AegisVault.sol       Vault + Shield struct + fee-on-yield
  contracts/MockRWAToken.sol     Faucet-backed USDY / mETH testnet tokens
  scripts/deploy.js              Deploys USDY + mETH + vault, sets fee
  scripts/smoke.js               Live end-to-end on-chain lifecycle test
  test/AegisVault.test.js        25 passing tests (shields, fee, ownership)
  hardhat.config.js              mantleSepolia (5003), mantleMainnet (5000)

server/                          Express API
  config/mantle.js               Mantle provider / relayer / vault
  services/aiAdvisorService.js   Auditable AI hedge + risk sizing
  services/complianceService.js  KYC / jurisdiction / asset-class gate
  services/shieldEnvelopeService.js  Envelope hash + Pinata/hash storage + verify
  engine/yieldShieldEngine.js    prepareShieldMantle / settleShieldOnChainMantle
  routes/yieldShield.js          /prepare-mantle, /sponsor-create, /settle-mantle, /verify, /doc
  server.js                      GET /api/health/mantle

client/                          React 19 + Vite frontend
  src/config/wagmi.js            Mantle Sepolia + Mainnet chains
  src/config/contracts.js        USDY/mETH addresses + AegisVault ABI
  src/pages/YieldShieldPage.jsx  prepare → compliance → approve → createShield → verify
```

## Local development

### Prerequisites
- Node 20+
- MongoDB (Atlas free tier or local `mongod`)
- A wallet funded with Mantle Sepolia MNT ([faucet](https://faucet.sepolia.mantle.xyz))

### Setup
```bash
# Contracts
cd contracts && npm install && npx hardhat compile && npx hardhat test

# Server
cd ../server && npm install && cp .env.example .env   # fill in keys
npm start

# Client
cd ../client && npm install && cp .env.example .env    # fill in addresses
npm run dev
```

### Required env

**`contracts/.env`**
```
DEPLOYER_PRIVATE_KEY=        # 64 hex, funds + deploys on Mantle
MANTLE_SEPOLIA_RPC=https://rpc.sepolia.mantle.xyz
PROTOCOL_FEE_BPS=1000        # 10% fee on upside (optional, default 1000)
```

**`server/.env`**
```
MONGODB_URI=
MANTLE_NETWORK=testnet
MANTLE_SEPOLIA_RPC=https://rpc.sepolia.mantle.xyz
MANTLE_CHAIN_ID=5003
RELAYER_PRIVATE_KEY=         # must match the vault's relayer for settlement
VAULT_CONTRACT_ADDRESS=      # from deploy output
USDY_ADDRESS=                # from deploy output
METH_ADDRESS=                # from deploy output
STORAGE_PROVIDER=hash        # hash | pinata
PINATA_JWT=                  # only if STORAGE_PROVIDER=pinata
NIM_API_KEY=                 # LLM for advisor/compliance (heuristic fallback if absent)
NIM_TIMEOUT_MS=30000
```

**`client/.env`**
```
VITE_NETWORK=testnet
VITE_MANTLE_TESTNET_RPC=https://rpc.sepolia.mantle.xyz
VITE_EXPLORER_BASE=https://sepolia.mantlescan.xyz
VITE_AEGIS_VAULT_ADDRESS=    # from deploy output
VITE_USDY_ADDRESS=           # from deploy output
VITE_METH_ADDRESS=           # from deploy output
VITE_API_BASE_URL=http://localhost:3001
VITE_WALLETCONNECT_PROJECT_ID=
```

### Deploy to Mantle
```bash
cd contracts && npx hardhat run scripts/deploy.js --network mantleSepolia
# paste the printed addresses into server/.env and client/.env
```

## Principal protection — the core guarantee

At settlement the vault pays `principal + exposurePayout`. A negative `exposurePayout` is clamped so it can absorb **at most** the deposit — principal is never reduced below the original amount by market losses. A positive payout is drawn from a pre-funded bonus pool (zero-coupon-bond mechanics in production), and the protocol fee is skimmed from that upside only. See `settleShield` in `contracts/contracts/AegisVault.sol` and the tests in `contracts/test/AegisVault.test.js`.
