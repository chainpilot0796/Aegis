# Aegis.0G — Build on the 0G Stack

**Design doc** — drafted 2026-05-16 for the 0G APAC Hackathon.

## 1. Goal

Build the principal-protected-yield-shield product on the 0G Labs stack (Aristotle mainnet, chain id `16661`) under a 4-hour build budget. Submission must satisfy the hackathon's mandatory checklist: a mainnet contract address, a chainscan link, demonstrable 0G integration (Storage + Compute + Chain), a public repo, a README, an OpenClaw skill, a demo video, and an X post.

Brand: **Aegis.0G** — "The Principal-Protected Shield Agent on 0G".

Tracks targeted: **Track 1 (Agentic Infrastructure & OpenClaw Lab)** primary, **Track 2 (Agentic Trading Arena / Verifiable Finance)** secondary. Both signals come from the same deliverable; no extra surface area.

## 2. Verified capability matrix (2026-05-16)

| Capability | Status | Used in this port |
|---|---|---|
| 0G Aristotle mainnet (`16661`, `https://evmrpc.0g.ai`, `https://chainscan.0g.ai`) | Live | Yes — mandatory submission contract |
| 0G Galileo testnet (`16602`, `https://evmrpc-testnet.0g.ai`) | Live | Yes — dev iteration |
| 0G Storage TS SDK (`@0gfoundation/0g-storage-ts-sdk`) | Live | Yes — shield agreement docs |
| 0G Compute TS SDK (`@0gfoundation/0g-compute-ts-sdk`), OpenAI-compatible inference w/ TEE-signed responses | Live | Yes — AI shield recommendation |
| ERC-7857 INFT (Agent ID) | Standard published, no canonical mainnet registry | **Stretch** — deploy our own; cut if Block 6 runs long |
| TEE / Sealed Inference (TeeML, built into 0G Compute) | Live | Yes — signature verified server-side |
| OpenClaw orchestration | Third-party OSS (not 0G-owned) | Yes — existing `openclaw-skill/` manifest, repointed |
| Faucet | 0.1 0G/day on testnet | Sufficient for testnet iteration if combined with Chainlink + GCP faucets |
| Mainnet 0G | Buy / bridge required | User to provide funded deployer wallet |

**Known gaps planned around:** no canonical Agent ID registry (deploy our own); no public 0G Storage HTTP gateway (reads via SDK); OpenClaw integration is BYO; `@0glabs/*` vs `@0gfoundation/*` package split (pin to `@0gfoundation/*`); testnet faucet drip is tiny.

## 3. Architecture

```
Browser (client/, React 19 + Wagmi + RainbowKit)
  Network: 0G Aristotle (16661, fallback Galileo 16602)
                 │
       JSON-RPC + REST
                 │
┌────────────────┼─────────────────────────────────┐
▼                ▼                                 ▼
0G Chain (16661)    Aegis API (server/, Express)         OpenClaw Skill
  AegisVault.sol      yieldShieldEngine.js + new          openclaw-skill/
  AUSDC.sol           adapters; Mongo Atlas M0 free      SKILL.md (rebranded)
  ERC-7857 (stretch)         │
                             ▼
                  ┌──────────────────┐
                  │ 0G Compute       │
                  │ (TeeML inference)│
                  │ silent fallback ─┐
                  └──────────────────┘ │
                  ┌──────────────────┐ │
                  │ 0G Storage       │ │
                  │ (shield docs)    │ │
                  └──────────────────┘ │
                                       ▼
                              ┌──────────────────┐
                              │ NVIDIA NIM       │
                              └──────────────────┘
```

**Module → track mapping:**

- 0G Chain (Aristotle): mandatory mainnet contract.
- 0G Compute: AI recommendation with TEE signature → Track 2 verifiable-finance signal.
- 0G Storage: immutable shield agreement docs → Track 1 long-context memory signal.
- OpenClaw skill: orchestration → Track 1.
- ERC-7857 INFT (stretch): tokenized agent → Track 1 depth.

Explicitly NOT in scope: perp engine, BitGo custody, ENS subnames, Twilio WhatsApp, Parcl/Yahoo live price feeds, vault LP withdrawal queue. Files remain; UI hides them.

## 4. Time-box plan (4h00 + 25-min reserve)

| Block | Time | Output |
|---|---|---|
| 0. Pre-flight | 0:00–0:10 | Wallet funded from faucet (testnet) and bridge (mainnet); hardhat networks added; SDKs installed. |
| 1. Contracts | 0:10–1:00 | `AegisVault.sol` (extended), `AUSDC.sol` (renamed), tests pass, deploy to ogTestnet. |
| 2. 0G Storage | 1:00–1:50 | `zeroGStorageService.js`; `createShield` writes a `rootHash` and the doc is fetchable. |
| 3. 0G Compute + NIM | 1:50–2:40 | `zeroGComputeService.js` + `nimFallbackService.js`; `/recommend-shield` returns TEE-signed response. |
| 4. Frontend rebrand | 2:40–3:25 | wagmi rewired to 0G; YieldShieldPage shows chain/storage/TEE badges; perp routes hidden. |
| 5. OpenClaw + README | 3:25–3:45 | Skill manifest updated; README written to hackathon template. |
| 6. Mainnet deploy + smoke | 3:45–4:00 | Two mainnet contracts + ≥1 mainnet tx on chainscan.0g.ai. |
| Reserve / cut order | 25 min | Cut INFT → cut TEE signature verification → cut smoke-test settle. |

## 5. Per-module changes

### 5.1 Contracts

- `contracts/contracts/AegisVault.sol`. Keep all existing trader/LP/PnL functions; add `Shield` struct, `userShields` mapping, `createShield`, `settleShield`, `getShields`, `ShieldCreated` and `ShieldSettled` events.
  ```solidity
  struct Shield {
      uint128 depositAmount;
      uint64  durationSeconds;
      uint64  settleAt;
      bytes32 assetId;
      uint64  entryPrice;
      uint64  closePrice;
      int128  exposurePayout;
      bytes32 storageRootHash;
      bool    settled;
  }
  ```
- `contracts/contracts/AUSDC.sol`. Token: `Aegis USD` / `A-USDC`; keep faucet + 1T mint.
- `contracts/hardhat.config.js`. Add `ogTestnet` (16602) and `ogMainnet` (16661) network entries. Keep `baseSepolia`.
- `contracts/scripts/deploy.js`. One script, network-agnostic; writes `deployment.json` under `networks.<name>`.
- `contracts/test/AegisVault.test.js` **(NEW)**. Hardhat tests covering `createShield` debits A-USDC + emits event, and `settleShield` flips `settled` flag.
- `contracts/deployment.json`. Restructure into `{ networks: { ogTestnet, ogMainnet, baseSepolia } }`.

### 5.2 0G Storage adapter

- `server/services/zeroGStorageService.js` **(NEW)**. Exposes `init`, `isConfigured`, `getInfo`, `uploadShieldDoc(shieldData) → {rootHash, txHash}`, `fetchShieldDoc(rootHash) → {markdown, json}`. Uses dynamic `import()` from CommonJS (same pattern as `fileverseService.js:8`).
- `server/services/sponsorService.js`. `createShieldDoc` tries `zeroGStorageService` first; Fileverse path kept as feature-flag fallback (`STORAGE_PROVIDER=fileverse`).
- `server/models/Shield.js`. Add `storageRootHash`, `storageTxHash`, `storageProvider`, `teeInferenceSignature`, `teeInferenceProvider` fields. Existing `fileverseDocHash` kept for legacy records.
- `server/engine/yieldShieldEngine.js`. Persist `storageRootHash` + `storageTxHash` on the Shield record at create time. Wrap `uploadShieldDoc` in a 12s timeout with `Promise.race`.
- `server/routes/yieldShield.js`. New `GET /api/yield-shield/doc/:rootHash` route.

### 5.3 0G Compute + NIM fallback

- `server/services/zeroGComputeService.js` **(NEW)**. `init`, `recommendShield(concern) → {asset, reason, signature, provider, raw, providerUsed}`, `getInfo`, `getLastProviderUsed`. Internally: `broker.inference.listService()` → `getServiceMetadata` → POST `/chat/completions` → `broker.inference.processResponse` for TEE signature.
- `server/services/nimFallbackService.js` **(NEW)**. Wraps `NIM_BASE_URL/v1/chat/completions`. Same return shape sans signature.
- `server/services/openaiIntentParser.js`. `parseTradeIntent` routes through 0G Compute first, then NIM, then OpenAI as last resort. Outward signature unchanged.
- `server/routes/ai.js`. Rewrite `POST /recommend-shield`: drop the keyword if/else cascade, call `zeroGComputeService.recommendShield`, validate the returned asset against `MARKETS`, return existing envelope shape.
- `server/server.js`. New `GET /api/sponsors/zerog` health endpoint reporting compute + storage + chain config. Initialize both 0G services in startup.

### 5.4 Frontend rebrand + 0G wiring

- `client/src/config/wagmi.js`. Rewrite: define `ogMainnet` (16661) and `ogTestnet` (16602) custom chain objects; switch default chain via `VITE_NETWORK=mainnet|testnet`.
- `client/src/config/contracts.js`. Export `AUSDC_ADDRESS` and `AEGIS_VAULT_ADDRESS`. Extend `AEGIS_VAULT_ABI` with `createShield`, `getShields`, `userShields`, `ShieldCreated`, `ShieldSettled`. Add `EXPLORER_BASE` export.
- `client/src/pages/YieldShieldPage.jsx`. Post-activation result panel: three badges — Chain (chainscan tx link), Storage (rootHash + `/api/yield-shield/doc/:rootHash` link), TEE Verified (provider address + signature head). Optional fourth INFT badge if stretch lands.
- Visible rebrand across `Sidebar.jsx`, `LandingPage.jsx`, `RootLayout.jsx`, `index.html`, `package.json` `name`.
- Hide perp routes in `Sidebar.jsx` (comment-out, do not delete).

### 5.5 OpenClaw skill + README

- `openclaw-skill/SKILL.md`. Update front-matter (`name: aegis-0g-shield`, env `AEGIS_API_URL`); update endpoint list; new "0G Integration" section.
- `README.md`. Full rewrite to the hackathon submission template (name, one-line desc, summary with problem + 0G components, repo link, mainnet contract address, chainscan link, architecture diagram, modules used, local deploy steps, faucet info, optional bonus).
- `docs/aegis-architecture.md` **(NEW)**. Hosts the ASCII diagram + textual walkthrough.

### 5.6 Mainnet deploy + smoke

- Deploy `AegisVault` + `AUSDC` to `ogMainnet`. Capture addresses + deploy tx into `deployment.json`, `client/.env.production`, README.
- `scripts/smoke-mainnet.js` **(NEW)**: mint A-USDC, approve, `createShield`. The `ShieldCreated` event tx is the mandatory mainnet activity.

### 5.7 Stretch — ERC-7857 INFT (only if Block 6 done by 3:50)

- `contracts/contracts/AegisShieldINFT.sol` **(NEW)**. ERC-721 derivative with `mint(to, sealedMetadataRootHash)` + `authorizeUsage(tokenId, user)`. Mint inside backend at `createShield`.
- YieldShieldPage badge 4 linking to chainscan token page.

## 6. Risks + fallbacks

| # | Risk | Mitigation |
|---|---|---|
| R1 | 0G Compute call fails / no TEE signature | Silent NIM fallback; `/api/sponsors/zerog` reports which provider served. |
| R2 | 0G Storage upload hangs/throws | 12s `Promise.race` timeout → Fileverse-or-hash fallback path. |
| R3 | Mainnet deploy fails (no 0G, RPC flake) | Pre-stage ≥0.5 mainnet 0G in Block 0; configure Ankr/dRPC backup RPC. |
| R4 | Testnet faucet drip too small | Combine 3 faucets (0G + Chainlink + GCP) at Block 0; or deploy straight to mainnet. |
| R5 | ESM-vs-CJS module loading | Dynamic `import()` from CJS, same pattern as `fileverseService.js:8`. |
| R6 | wagmi custom chain not recognized | RainbowKit prompts add-network; tested in Block 4 before claiming done. |
| R7 | Shield schema migration | New fields nullable with defaults — old records read cleanly. |
| R8 | TEE signature verification wrong → all calls fall through to NIM | Block 3 includes unit test on a known-good response; if wrong, drop TEE claim rather than ship a false one. |
| R9 | Tweet / demo video / X post not done | Out of 4-hour build budget — explicit 30–60 min post-build block. |
| R10 | Secrets in committed `.env` | Block 0 audit: `git ls-files | xargs grep -l <SECRET_NAMES>`. |

## 7. Environment variables

`server/.env` (new keys, existing kept):
```
ZG_TESTNET_RPC=https://evmrpc-testnet.0g.ai
ZG_MAINNET_RPC=https://evmrpc.0g.ai
ZG_FALLBACK_RPC_MAINNET=
ZG_INDEXER_URL=https://indexer-storage-testnet-turbo.0g.ai
ZG_STORAGE_FLOW_CONTRACT=0x62D4144dB0F0a6fBBaeb6296c785C71B3D57C526
ZG_COMPUTE_BROKER_URL=
ZG_COMPUTE_PROVIDER_PIN=
NIM_BASE_URL=https://integrate.api.nvidia.com/v1
NIM_API_KEY=
NIM_MODEL=meta/llama-3.1-70b-instruct
STORAGE_PROVIDER=zerog
```

`client/.env.production`:
```
VITE_NETWORK=mainnet
VITE_AUSDC_ADDRESS=
VITE_AEGIS_VAULT_ADDRESS=
VITE_EXPLORER_BASE=https://chainscan.0g.ai
VITE_API_BASE_URL=
VITE_WALLETCONNECT_PROJECT_ID=
```

## 8. Acceptance criteria (demo passes iff)

End-to-end on Aristotle mainnet (16661):

1. Wallet connects to `chainId === 16661` from the frontend (RainbowKit prompts add-network if needed).
2. `GET /api/sponsors/zerog` returns `compute.initialized=true`, `storage.initialized=true`, mainnet `chain.vault` + `chain.ausdc`.
3. `POST /api/ai/recommend-shield` with inflation concern returns `{asset, reason, signature, provider}` with non-empty `signature` and `providerUsed === 'zerog'`. NIM fallback works transparently when 0G Compute is unhealthy.
4. Frontend "Activate Shield" sequence: approve A-USDC → `createShield` on `AegisVault` → backend uploads to 0G Storage → UI renders three live badges (chain tx, storage rootHash, TEE signature) with outgoing links.
5. `GET /api/yield-shield/doc/:rootHash` returns the byte-identical agreement document.
6. `chainscan.0g.ai/tx/<createShield txHash>` shows `ShieldCreated` event with the stored `rootHash`.
7. README links resolve to: repo, both mainnet addresses, the chainscan tx, the architecture doc, the OpenClaw skill manifest.

## 9. Out-of-scope, declared in README

Perp/trading routes present but disabled in demo. Live price feeds stubbed for the demo (entry price from a fixed oracle constant). BitGo custody / Twilio WhatsApp / ENS / Fileverse retained in code but not in the demo path.
