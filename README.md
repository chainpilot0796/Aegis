# Aegis — Principal-Protected RWA Shield on Mantle

**Hold USDY or mETH. Tell the agent what you're worried about. It picks a hedge, *sizes the risk*, runs a compliance check, and commits a hash of its full reasoning on-chain — then deposits into a vault where, at maturity, you get back *at least* your principal, plus upside if the market moved your way.**

> ### 🏆 Mantle Turing Test Hackathon 2026 — **Track 3: AI × RWA**
> *"Dynamic yield strategies and automated risk management for assets including USDY and mETH, built on Mantle's RWA infrastructure."*

| | |
|---|---|
| **Live app** | https://aegis-three-navy.vercel.app |
| **Network** | Mantle Sepolia (chain id `5003`) |
| **Vault** | [`0x2dD69482E709b864EB6791f5948Bdc1e96981638`](https://sepolia.mantlescan.xyz/address/0x2dD69482E709b864EB6791f5948Bdc1e96981638) |
| **Health check** | https://aegis-three-navy.vercel.app/api/health/mantle |

---

## 1. The one-paragraph pitch

RWA holders want yield **without** risking the asset they came for. Aegis is an **AI agent that runs an automated risk strategy over Mantle RWAs**: the user states a concern in plain English, the agent selects a hedge asset *and derives the risk-sizing parameters from volatility*, screens the position for compliance, hashes its entire decision (recommendation + risk params + compliance verdict) into a **shield envelope** whose `keccak256` is committed on-chain, and then settles the position in the **`AegisVault`** contract. Principal is mathematically protected; the agent's decision is independently verifiable by anyone who re-hashes the published envelope. The protocol earns a **fee on upside only** — never on principal.

This is **risk management, not a chatbot**: the AI's output is structured, auditable, and on-chain.

---

## 2. Why this is Track 3 (AI × RWA)

| Track-3 rubric line | How Aegis answers it |
|---|---|
| **AI × RWA integration depth** | The AI doesn't just name an asset — it **sizes** the hedge ratio and principal clamp from the asset's volatility, screens compliance, and its full reasoning is hashed on-chain and re-verifiable. |
| **Mantle network integration** | `AegisVault` + the RWA tokens are deployed on Mantle. Faucet, approve, **shield creation, and settlement are all real on-chain Mantle transactions.** Targets the canonical Mantle RWAs **USDY** and **mETH**. |
| **Compliance awareness** | A dedicated compliance service classifies the asset's regulatory class, enforces jurisdiction / accreditation rules, and **hard-rejects sanctioned jurisdictions** — AI-assisted, with a deterministic fallback so it never fails open. |
| **Real-world validity (Path B)** | Clear asset class (yield-bearing RWAs), clear users (USDY / mETH holders wanting downside protection), end-to-end UX from "what I'm worried about" → on-chain protected position. |
| **Business model** | `protocolFeeBps` — a fee skimmed from **positive exposure payouts only**. No token required; revenue scales with delivered upside. |

---

## 3. Two ways to use Aegis

Aegis is built so **both humans and autonomous agents** can drive it.

### A. Humans — the web app
A guided flow: connect wallet → describe a concern → review the AI's hedge + risk panel → pass compliance → deposit → get an on-chain, verifiable shield.

### B. Agents — session keys + a skill manifest
The **My Agents** page issues **scoped, revocable session keys** (`aegis_sk_…`) so an external agent (e.g. an AI coding/automation agent) can call Aegis on the user's behalf.

- Keys are **wallet-derived** (the user signs a nonce to mint one), **scoped** (`recommend`, `shield`, `read`), and **rotatable / revocable** at any time.
- Agents authenticate with `Authorization: Bearer aegis_sk_…`.
- A machine-readable **skill manifest** is served at **`/api/skills/aegis.skill.md`** — an agent fetches it and self-bootstraps: it learns the endpoints, the on-chain contracts, the headers, and the strategy sub-skills.
- **Non-custodial:** agents bring their own signing key for on-chain transactions. Aegis never holds user funds or private keys.

---

## 4. The core user flow (reproducible by a judge)

> Prereq: a wallet on **Mantle Sepolia** with a little **MNT** for gas ([faucet](https://faucet.sepolia.mantle.xyz)).

1. **Connect** your wallet at the live app and open **Shield**.
2. **Get test USDY** — click *"Add USDY to wallet"*. This calls the on-chain faucet and mints **10,000 test USDY** to your address (one MNT-gas transaction), then registers the token in your wallet.
3. **Describe a concern** — e.g. *"I hold mETH and fear an ETH drawdown but still want yield."* The **AI risk engine** returns:
   - the **hedge asset** it picked, and **why**,
   - a **risk panel**: hedge ratio (bps), principal-protection clamp, estimated volatility, and the sizing rationale.
4. **Compliance** — enter jurisdiction + accreditation attestation. The agent classifies the asset's regulatory posture and **blocks** the deposit on a `reject` verdict (sanctioned / ineligible).
5. **Activate** — Aegis approves and calls **`createShield`** on `AegisVault`. The `keccak256` of the full decision envelope is committed on-chain as the shield's `storageRootHash`.
6. **Verify** — anyone can fetch the published envelope at `/api/yield-shield/doc/:rootHash`, re-hash it, and confirm it matches the on-chain commitment. The agent **cannot rewrite history**.
7. **Settle** — at maturity the vault pays **principal + exposure payout**; a negative move is clamped so it can never reduce principal, and the protocol fee is taken from the **upside only**.

---

## 5. Architecture

```
                          ┌──────────────────────────────────────────────┐
   Humans (browser)       │  Mantle Sepolia (chain id 5003)               │
   Wagmi + RainbowKit ───▶│   AegisVault.sol    USDY / mETH (RWA tokens)  │
        │                 │   • createShield    • faucet / approve        │
        │                 │   • settleShield    • fee-on-yield            │
        │  REST           └──────────────────────────────────────────────┘
        │                                  ▲
        ▼                                  │ on-chain txs (faucet, approve, createShield, settle)
   Aegis API (Express + Mongoose)          │
        │                                  │
        ├─▶ AI risk engine     pick hedge asset + size risk from volatility
        │                      (hot-swappable model, selected at runtime)
        ├─▶ compliance         asset class + jurisdiction / accreditation gate
        ├─▶ shield envelope    keccak256 commitment → on-chain rootHash
        │                      + /verify and /doc re-hash endpoints
        ├─▶ Mantle relayer     settleShield at maturity ─────────────────────┘
        └─▶ agent layer        scoped session keys + skill manifest
                               (external agents call Aegis non-custodially)
```

**AI is provider-agnostic.** The risk engine and compliance classifier run behind a single **gateway** with a **hot-swappable model**: the active model is selected **at runtime** from an admin panel and persisted — no vendor lock-in, and no redeploy to change it. If the model is unreachable, both services fall back to a **deterministic heuristic**, so the on-chain flow never breaks.

---

## 6. On-chain deployment — Mantle Sepolia (verified end-to-end)

| Contract | Address | Role |
|---|---|---|
| **AegisVault** | [`0x2dD69482E709b864EB6791f5948Bdc1e96981638`](https://sepolia.mantlescan.xyz/address/0x2dD69482E709b864EB6791f5948Bdc1e96981638) | Vault: shields, settlement, fee-on-yield |
| **USDY** | [`0x0Ab24f25f0Be64BF9AD9857a9f12CE1d11157Ff1`](https://sepolia.mantlescan.xyz/address/0x0Ab24f25f0Be64BF9AD9857a9f12CE1d11157Ff1) | Deposit / settlement asset (6 dp) |
| **mETH** | [`0x9D504DAE235A128b48401EdE055CE729394a937A`](https://sepolia.mantlescan.xyz/address/0x9D504DAE235A128b48401EdE055CE729394a937A) | Hedge-target asset (18 dp) |

Deployer / owner / relayer: `0x7176DC1B76a17BB502324Dd825EaB983F675DD7a` · protocol fee: `1000` bps (10% of upside).

> USDY and mETH exist as live assets only on Mantle **mainnet**. On testnet they are faucet-backed `MockRWAToken` stand-ins so the full lifecycle runs end-to-end; on mainnet the vault points at the canonical USDY address.

### Verified on-chain smoke test (live)
`contracts/scripts/smoke.js` runs the full lifecycle against the live deployment — **8/8 on-chain checks pass**: faucet → approve → `createShield` (with envelope rootHash) → `getShield` read-back (on-chain hash == envelope hash) → `fundBonusPool` → `settleShield` (principal + bonus − fee) → fee accrual.

```bash
cd contracts && npx hardhat run scripts/smoke.js --network mantleSepolia
```

---

## 7. Core mechanics

### Principal protection — the guarantee
At settlement the vault pays `principal + exposurePayout`. A **negative** `exposurePayout` is clamped so it can absorb **at most** the yield budget — principal is **never** reduced below the original deposit by market losses. A **positive** payout is drawn from a pre-funded bonus pool (zero-coupon-bond mechanics in production). See `settleShield` in `contracts/contracts/AegisVault.sol`.

### On-chain auditable AI
The agent's full decision — `{ recommendation, riskParams, compliance, deposit, … }`, `version: aegis-mantle-1` — is **canonicalized** (recursive key-sort) and hashed with `keccak256`. That hash is the shield's on-chain `storageRootHash`. `GET /api/yield-shield/doc/:rootHash` serves the envelope and self-verifies; `POST /api/yield-shield/verify` re-hashes any envelope against any hash. **Verifiability without trusting the operator.**

### Automated risk sizing
The AI sizes the hedge ratio **inversely to volatility** — higher-volatility assets get a smaller slice of the yield budget so principal protection is never over-exposed. The principal clamp is always 100%.

### Compliance gate
`pass` → proceed · `flag` → proceed with warnings (e.g. accreditation recommended) · `reject` → **block**. Empty or sanctioned jurisdictions are hard-rejected before any AI call.

### Fee-on-yield (business model)
`protocolFeeBps` (default 10%) is skimmed from **positive exposure payouts only**, accrued in `accruedFees`, withdrawable by the fee recipient. Principal is never touched.

---

## 8. Repository layout

```
contracts/                         Hardhat workspace (Mantle)
  contracts/AegisVault.sol         Vault + Shield struct + fee-on-yield
  contracts/MockRWAToken.sol       Faucet-backed USDY / mETH testnet tokens
  scripts/deploy.js                Deploys USDY + mETH + vault, sets fee
  scripts/smoke.js                 Live end-to-end on-chain lifecycle test
  test/AegisVault.test.js          Passing unit tests (shields, fee, ownership)
  hardhat.config.js                mantleSepolia (5003), mantleMainnet (5000)

server/                            Express API
  config/mantle.js                 Mantle provider / relayer / vault
  services/llmGateway.js           Provider-agnostic AI gateway (runtime-switchable)
  services/aiAdvisorService.js     Auditable AI hedge + risk sizing
  services/complianceService.js    KYC / jurisdiction / asset-class gate
  services/shieldEnvelopeService.js  Envelope hash + storage + verify
  services/agentKeyService.js      Scoped, wallet-derived session keys
  engine/yieldShieldEngine.js      prepareShieldMantle / settleShieldOnChainMantle
  routes/yieldShield.js            /prepare-mantle, /sponsor-create, /settle-mantle, /verify, /doc
  routes/agents.js                 /nonce, /keys (create/list/rotate/revoke), /actions
  routes/skills.js                 /aegis.skill.md skill manifest for agents
  routes/admin.js                  Runtime AI model management
  server.js                        GET /api/health/mantle

client/                            React + Vite frontend
  src/config/wagmi.js              Mantle Sepolia + Mainnet chains
  src/config/contracts.js          USDY/mETH addresses + AegisVault ABI
  src/pages/YieldShieldPage.jsx    prepare → compliance → approve → createShield → verify
  src/pages/AgentsPage.jsx         Session keys for external agents
  src/components/AddTokenButton.jsx  One-click test-USDY faucet
  src/pages/AdminPage.jsx          Runtime AI model switch (unlinked /admin)
```

---

## 9. Local development

### Prerequisites
- Node 20+ · MongoDB (Atlas or local) · a wallet funded with Mantle Sepolia MNT

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
PROTOCOL_FEE_BPS=1000        # 10% fee on upside (optional)
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
# The AI engine is hot-swappable at runtime via the /admin panel; the active
# model is persisted, so no key/model needs to be hardcoded here.
```

**`client/.env`**
```
VITE_NETWORK=testnet
VITE_MANTLE_TESTNET_RPC=https://rpc.sepolia.mantle.xyz
VITE_EXPLORER_BASE=https://sepolia.mantlescan.xyz
VITE_AEGIS_VAULT_ADDRESS=
VITE_USDY_ADDRESS=
VITE_METH_ADDRESS=
VITE_API_BASE_URL=           # backend URL (or proxied via vercel.json)
VITE_WALLETCONNECT_PROJECT_ID=
```

### Deploy to Mantle
```bash
cd contracts && npx hardhat run scripts/deploy.js --network mantleSepolia
# paste the printed addresses into server/.env and client/.env
```

---

## 10. Security notes

- **Non-custodial:** Aegis never holds user funds or private keys. On-chain actions are signed by the user (UI) or the agent's own key (session-key flow).
- **Principal can never be reduced** by market losses — enforced in `settleShield`, covered by unit tests.
- **AI never fails open:** if the model is unreachable, the deterministic heuristic and the hard compliance rules still run.
- **Session keys** are scoped and revocable; the AI model and any operator keys are managed behind a gated admin surface and are never returned in plaintext.

---

*Built for the Mantle Turing Test Hackathon 2026 — Track 3: AI × RWA.*
