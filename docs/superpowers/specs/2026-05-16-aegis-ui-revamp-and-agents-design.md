# Aegis.0G — UI revamp + agent-key + per-asset Trade page

**Design doc** — drafted 2026-05-16 (post-MVP, ~2-hour follow-on).

## Goal

Three intertwined deliverables on top of the existing Aegis.0G port:

1. **Full UI revamp** — dark-first violet/cyan palette, zero footprint of the old white + blue theme.
2. **Agent identity layer** — wallet-derived session keys that external agents (Claude / Cursor / custom) use to call Aegis APIs on a user's behalf. Multiple keys per user; create, list, revoke, rotate.
3. **Per-asset Trade page** — chart on top, "Your agents on {ASSET}" feed below, with model/slug/invested/value/PnL columns.

Plus a published OpenClaw skill library (one general entrypoint + 5 strategy skills) that external agents load to know how to use the API.

## Constraints

- ~2-hour build budget.
- Agents run wherever the user's LLM lives — we never custody or auto-execute. Agents bring their own private keys for on-chain signing.
- Agent self-attestation of `slug` / `model` / `name` is unverified; surfaced as "self-reported".
- Bearer auth (no OAuth). Wallet-derived: creating a key requires a signature from the user's wallet.
- The visual revamp propagates through existing `--t-*` CSS variables. Components keep their structure.

## 1. Visual identity

**Direction:** Dark-first "verifiable finance" — Linear precision with TEE-cyber accents.

| Token | Value | Purpose |
|---|---|---|
| `--t-bg` | `#07070C` | App background (near-black) |
| `--t-bg-secondary` | `#0F0F18` | Sidebar / sticky bars |
| `--t-panel` | `#14141F` | Cards, primary surface |
| `--t-panel-elev` | `#1C1C29` | Hover / elevated surface |
| `--t-border` | `#262640` | Borders, dividers |
| `--t-border-strong` | `#3A3A55` | Active / focused borders |
| `--t-text` | `#E8E8F0` | Primary text |
| `--t-text-muted` | `#8B8BA8` | Secondary text |
| `--t-text-dim` | `#5C5C80` | Tertiary / labels |
| `--t-blue` (legacy name → accent) | `#A78BFA` | Violet — agents / TEE / primary CTA |
| `--t-violet-strong` | `#7B3FF0` | Gradient stop / hover |
| `--t-cyan` | `#00E5D4` | Positive / verifiable / PnL+ |
| `--t-amber` | `#F59E0B` | Pending / warning |
| `--t-red` | `#F25555` | Danger / PnL- |
| `--t-green` (legacy name) | `#A78BFA` | Aliased to violet so existing `var(--t-green)` callers stay coherent |

Geist + Geist Mono kept. The mockup-style terminal-bracket label decorations are kept but recolor to muted violet.

Strategy: rewrite `client/src/index.css` token block + body, and replace 8–12 specific hardcoded `#F0F7FF` / `#E0EFFF` / `#FFFFFF` references that bypass the vars.

## 2. Agent identity layer

### Data model

```js
AgentSessionKey {
  _id, walletAddress (lowercase, indexed),
  hashedKey,             // sha256 of plaintext; raw key returned once at create
  keyPrefix,             // first 8 chars of plaintext for display (e.g. "aegis_sk_a1b2c3…")
  label,
  scopes: [String],      // ['recommend','shield','read'] - default all 3
  revokedAt, createdAt, lastUsedAt
}

AgentAction {
  _id, sessionKeyId, walletAddress,
  agentSlug, agentModel, agentName,   // from X-Agent-* headers (self-reported)
  action,                              // 'recommend' | 'prepare' | 'activate' | 'simulate' | 'doc-fetch'
  asset,                               // optional asset id
  params,                              // truncated JSON
  result,                              // truncated JSON (status + ids)
  value: { invested, currentValue, realizedPnl },  // populated post-settle
  onChainTxHash,
  createdAt
}
```

### Routes (all wallet-signed via header `X-Wallet-Signature` over `nonce` body)

| Method | Path | Returns |
|---|---|---|
| `POST /api/agents/keys` | `{ walletAddress, signature, nonce, label, scopes? }` | `{ id, key (raw, ONCE), keyPrefix, label, scopes, createdAt }` |
| `GET /api/agents/keys` | header-signed | `[{ id, keyPrefix, label, scopes, createdAt, lastUsedAt, revokedAt }]` |
| `POST /api/agents/keys/:id/revoke` | header-signed | `{ id, revokedAt }` |
| `POST /api/agents/keys/:id/rotate` | header-signed | `{ id, key (raw, ONCE), keyPrefix }` |
| `GET /api/agents/actions?asset=&sessionKeyId=` | header-signed | `[AgentAction]` |

### Auth middleware (`agentBearerAuth`)

When an endpoint accepts agents:

1. Look at `Authorization: Bearer aegis_sk_…`. If absent, treat as wallet-only path (existing UI flow).
2. Hash the bearer, look up in `AgentSessionKey`. If `revokedAt` set or missing → 401.
3. Update `lastUsedAt`.
4. Stamp `req.agent = { sessionKeyId, walletAddress, slug, model, name }` reading the `X-Agent-Slug/Model/Name` request headers.
5. On response, write `AgentAction` row (fire-and-forget).

Applied to: `POST /api/ai/recommend-shield`, `POST /api/yield-shield/prepare`, `POST /api/yield-shield/activate`, `POST /api/yield-shield/simulate`, `GET /api/yield-shield/active/:address`.

### Wallet-signed message format

```
Aegis.0G Agent Keys Management
Action: <create|revoke|rotate|list>
Wallet: <address>
Nonce: <random 16-byte hex>
Issued: <ISO timestamp>
Expires: <ISO timestamp 5 min later>
```

Server verifies via `ethers.verifyMessage`. Nonce tracked in-memory with 5-minute expiry for replay protection.

## 3. Per-asset Trade page

Route: `/app/trade/:assetId` (replaces existing `MarketDetailPage`).

Layout (top → bottom):
1. **Ticker header** — symbol, price, 24h delta, range tabs (1D / 1W / 1M / 1Y / All), "Shield Asset" CTA.
2. **Chart panel** — Recharts area chart, violet stroke + gradient fill. Reuses existing `useSocket` price stream + `priceHistory` backend.
3. **Your Agents on {ASSET}** panel — fed by `GET /api/agents/actions?asset=…` then grouped by `(sessionKeyId × agentSlug)`. Columns:
   - Agent (slug + version pill)
   - Model
   - Invested ($)
   - Current value ($)
   - Realized PnL (+ last action time)
   - Status pill (`live` cyan / `paused` violet / `revoked` red / `no-activity` dim)
4. Row click → modal with JSON detail (last 50 actions).

## 4. My Agents UI

Lives at `/app/agents` (top-nav `My Agents`).

Sections:
- **Create new key** — label input, scopes (checkboxes default-all), `Create` button → wallet sign → reveal-once modal showing the raw `aegis_sk_…` and a copy button + "I've saved it" confirm.
- **Your keys** table — keyPrefix, label, scopes, createdAt, lastUsedAt, status pill, Revoke + Rotate buttons.
- **How to use it** — collapsible block showing the OpenClaw skill ID + a `curl` example.

## 5. OpenClaw skill library

Files (all in `openclaw-skill/`):
- `aegis.skill.md` (rewrite as general entrypoint, replaces the previous shield contents).
- `strategies/conservative-saver.skill.md`
- `strategies/inflation-hedger.skill.md`
- `strategies/momentum-shield.skill.md`
- `strategies/balanced.skill.md`
- `strategies/aggressive.skill.md`

Each strategy skill documents: when to recommend, allowed asset universe, duration range, and the API calls to make.

## 6. Risk register

| # | Risk | Mitigation |
|---|---|---|
| R1 | Wallet-signature verification edge cases (case sensitivity, EIP-712 vs personal_sign) | Use `ethers.verifyMessage` (handles `personal_sign`). Lowercase compare. Reject if mismatch. |
| R2 | Plaintext key handling | Generate via `crypto.randomBytes(24).toString('hex')`, prefix `aegis_sk_`, store sha256 only. Returned once. |
| R3 | Replay attacks on key management calls | 5-min nonce. In-memory map keyed by signature; reject on second use. |
| R4 | Theme breakage from hardcoded colors | Audit + replace named occurrences (`#F0F7FF` × N, `#FFFFFF` panel backgrounds). Final pass via Playwright snapshot of `/app/shield`. |
| R5 | Existing tests broken | Re-run REST + Playwright smokes at the end of Phase 7f. |

## 7. Cuts

- Per-agent action drilldown timeline (link to JSON modal only).
- Custom skill authoring UI.
- Real-time WebSocket for action feed (poll every 10s).
- Multi-language skill docs.

## 8. Acceptance

1. `/app/shield` and `/app/trade/:id` render with the new dark theme, no white panels.
2. Creating a key via `/app/agents` returns the raw key once; subsequent list calls show only the prefix.
3. Calling `POST /api/ai/recommend-shield` with `Authorization: Bearer aegis_sk_…` + agent headers produces an `AgentAction` row visible at `GET /api/agents/actions?asset=gold`.
4. `/app/trade/gold` shows the chart + at least the empty-state of the agent feed.
5. `openclaw-skill/aegis.skill.md` lists all 5 strategy skills with valid paths.
6. REST + Playwright smokes still pass.
