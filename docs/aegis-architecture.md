# Aegis.0G — Architecture

## System diagram

```
                        ┌───────────────────────────────────────────┐
                        │  Browser (client/, React 19 + Vite)       │
                        │  Wagmi + RainbowKit                       │
                        │  Network: 0G Aristotle Mainnet (16661)    │
                        └────────────┬──────────────────────────────┘
                                     │  JSON-RPC + REST
              ┌──────────────────────┼──────────────────────────────┐
              │                      │                              │
              ▼                      ▼                              ▼
   ┌────────────────────┐  ┌──────────────────────┐    ┌─────────────────────┐
   │ 0G Chain (16661)   │  │ Aegis API (server/)  │    │ OpenClaw Skill      │
   │ AegisVault.sol     │  │ Express + Mongoose   │    │ openclaw-skill/     │
   │ AUSDC.sol          │  │ yieldShieldEngine    │    │ SKILL.md (Aegis.0G) │
   │                    │  │ + new adapters       │    │                     │
   └────────────────────┘  └─────┬──────────┬─────┘    └──────────┬──────────┘
                                 │          │                     │
                                 ▼          ▼                     ▼
                  ┌──────────────────┐  ┌──────────────────┐  same REST API
                  │ 0G Compute       │  │ 0G Storage       │
                  │ (TeeML inference)│  │ (shield docs)    │
                  │ broker.inference │  │ MemData + Indexer│
                  │ + silent failover│  │ rootHash + txHash│
                  └────────┬─────────┘  └──────────────────┘
                           │ on failure
                           ▼
                  ┌──────────────────┐
                  │ NVIDIA NIM       │
                  │ /chat/completions│
                  └──────────────────┘
```

## End-to-end user flow

1. **Connect wallet** — RainbowKit on `chainId 16661`.
2. **Get AI recommendation** — user types a natural-language concern. Frontend calls `POST /api/ai/recommend-shield`. The server:
   - Lists 0G Compute services, picks a TeeML-verifiable provider.
   - Requests single-use headers via `broker.inference.getRequestHeaders(providerAddress, query)`.
   - POSTs `/chat/completions` to the provider's endpoint with the system prompt and the user's concern.
   - Verifies the response signature via `broker.inference.processResponse(providerAddress, completion.id, content)`.
   - Returns `{ asset, reason, teeVerified, teeProviderAddress, teeModel, teeChatId, providerUsed }`.
   - On any failure: falls back to NVIDIA NIM (no signature), then OpenAI, then a deterministic keyword rule. `providerUsed` reflects which path served the call.
3. **Configure shield** — user picks deposit (A-USDC), duration, and asset (defaulted to the recommendation but overridable).
4. **Review projections** — `POST /api/yield-shield/simulate` returns the scenario table.
5. **Activate**:
   - Frontend `POST /api/yield-shield/prepare` — server builds the agreement doc (markdown + JSON envelope) and uploads to 0G Storage via `MemData → indexer.upload`. Returns `{rootHash, storageTxHash, assetIdBytes32, entryPriceScaled, durationSeconds, depositBaseUnits}`.
   - Frontend wagmi flow:
     - `AUSDC.faucet(address, amount)` (test-token top-up if balance < deposit).
     - `AUSDC.approve(vault, amount)`.
     - `AegisVault.createShield(amount, durationSeconds, assetIdBytes32, entryPriceScaled, rootHash)` — emits `ShieldCreated(user, idx, assetId, deposit, durationSeconds, entryPrice, rootHash)`.
   - Frontend parses the `ShieldCreated` event log for the on-chain `idx`.
   - Frontend `POST /api/yield-shield/activate` with `{ ..., prepare, onChainTxHash, onChainIdx, teeInference* }`. The server persists a `Shield` mongoose record carrying:
     - the 0G Storage `rootHash` + `txHash`,
     - the on-chain `txHash` + `idx`,
     - the TEE inference provider, model, chat id, and verification flag.
6. **Success screen** shows three verifiable artifacts:
   - **0G Chain** badge → links to `https://chainscan.0g.ai/tx/<onChainTxHash>`.
   - **0G Storage** badge → links to `GET /api/yield-shield/doc/<rootHash>` (server proxies `indexer.downloadToBlob(rootHash)` and returns the original markdown + JSON).
   - **0G Compute** badge → shows the TEE provider address and model; "TEE Verified ✓" when the SDK signature check passed.

## Settlement (out of demo scope but on-chain ready)

`AegisVault.settleShield(user, idx, closePrice, exposurePayout)` (relayer-only) pays back the principal in full and adds positive `exposurePayout` from a pre-funded bonus pool. Negative payouts absorb only up to the deposit — principal is mathematically protected by clamp inside the contract.

## Modules at a glance

| Module | Files |
|---|---|
| Contracts | `contracts/contracts/AegisVault.sol`, `contracts/contracts/AUSDC.sol`, `contracts/test/AegisVault.test.js`, `contracts/scripts/deploy.js` |
| 0G Storage | `server/services/zeroGStorageService.js`, `server/services/sponsorService.js` |
| 0G Compute + NIM fallback | `server/services/zeroGComputeService.js`, `server/services/nimFallbackService.js`, `server/routes/ai.js` |
| Shield engine | `server/engine/yieldShieldEngine.js`, `server/models/Shield.js`, `server/routes/yieldShield.js` |
| Health & demo wiring | `server/server.js` (`/api/sponsors/zerog`), `client/src/config/wagmi.js`, `client/src/config/contracts.js`, `client/src/pages/YieldShieldPage.jsx` |
| OpenClaw skill | `openclaw-skill/SKILL.md` |

## Fallback hierarchy (Resilience)

| Subsystem | Primary | Fallback 1 | Fallback 2 | Fallback 3 |
|---|---|---|---|---|
| Inference | 0G Compute (TEE) | NVIDIA NIM | OpenAI | Keyword rule |
| Storage   | 0G Storage       | Fileverse (IPFS) | Content hash | — |
| Chain     | 0G Aristotle RPC | Configured fallback RPC (`ZG_FALLBACK_RPC_MAINNET`) | — | — |

The `/api/sponsors/zerog` endpoint reports exactly which paths are live and which fell back; judges can verify the primary integration ran.
