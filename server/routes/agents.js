/**
 * Aegis.0G — agent session key management + action feed.
 *
 * All mutation endpoints require a wallet signature over a server-issued
 * nonce. Auth header (`X-Wallet-*`) is also accepted as a transport for the
 * fields; the body is the canonical source.
 */

const express = require('express');
const router = express.Router();
const agentKeyService = require('../services/agentKeyService');
const AgentAction = require('../models/AgentAction');

/** Validate that req.body carries a properly signed action proof. */
async function requireSigned(req, action) {
  const { walletAddress, nonce, signature, expiresAt } = req.body || {};
  if (!walletAddress || !nonce || !signature || !expiresAt) {
    const err = new Error('walletAddress, nonce, signature, expiresAt required');
    err.status = 400;
    throw err;
  }
  agentKeyService.verifySignedRequest({
    action,
    walletAddress,
    nonce,
    signature,
    expiresAt,
  });
  return walletAddress.toLowerCase();
}

/** POST /api/agents/nonce - issue a one-shot nonce + the message the client must sign. */
router.post('/nonce', (req, res) => {
  try {
    const { walletAddress, action } = req.body || {};
    if (!walletAddress) return res.status(400).json({ error: 'walletAddress required' });
    if (!action) return res.status(400).json({ error: 'action required' });
    const { nonce, expiresAt } = agentKeyService.issueNonce(walletAddress);
    const message = agentKeyService.buildSignableMessage({
      action,
      walletAddress,
      nonce,
      expiresAt,
    });
    res.json({ nonce, expiresAt, message });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/** POST /api/agents/keys - create a new session key. */
router.post('/keys', async (req, res) => {
  try {
    const walletAddress = await requireSigned(req, 'create');
    const { label, scopes } = req.body || {};
    const out = await agentKeyService.createKey({ walletAddress, label, scopes });
    res.json({ success: true, ...out });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

/** POST /api/agents/keys/list - list this wallet's keys (signed proof in body). */
router.post('/keys/list', async (req, res) => {
  try {
    const walletAddress = await requireSigned(req, 'list');
    const keys = await agentKeyService.listKeys(walletAddress);
    res.json({ keys });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

/** POST /api/agents/keys/:id/revoke */
router.post('/keys/:id/revoke', async (req, res) => {
  try {
    const walletAddress = await requireSigned(req, 'revoke');
    const out = await agentKeyService.revokeKey({ walletAddress, id: req.params.id });
    res.json({ success: true, ...out });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

/** POST /api/agents/keys/:id/rotate */
router.post('/keys/:id/rotate', async (req, res) => {
  try {
    const walletAddress = await requireSigned(req, 'rotate');
    const out = await agentKeyService.rotateKey({ walletAddress, id: req.params.id });
    res.json({ success: true, ...out });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

/** POST /api/agents/actions/list - signed read of this wallet's action feed. */
router.post('/actions/list', async (req, res) => {
  try {
    const walletAddress = await requireSigned(req, 'list');
    const { asset, sessionKeyId, limit = 100 } = req.body || {};
    const q = { walletAddress };
    if (asset) q.asset = asset;
    if (sessionKeyId) q.sessionKeyId = sessionKeyId;
    const actions = await AgentAction.find(q)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit) || 100, 500))
      .lean();
    res.json({ actions });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

/** GET /api/agents/actions/public?wallet=&asset= - public read for the Trade page.
 * Not signature-gated because the address is already on-chain. Returns
 * aggregated rows so the UI can show "all agents acting on ASSET for this user".
 */
router.get('/actions/public', async (req, res) => {
  try {
    const { wallet, asset, limit = 100 } = req.query;
    if (!wallet) return res.status(400).json({ error: 'wallet query param required' });
    const q = { walletAddress: String(wallet).toLowerCase() };
    if (asset) q.asset = asset;
    const actions = await AgentAction.find(q)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit) || 100, 500))
      .lean();

    // Aggregate per (sessionKeyId × agentSlug) for the table view
    const agg = new Map();
    for (const a of actions) {
      const key = `${a.sessionKeyId || 'no-key'}|${a.agentSlug || 'anonymous'}`;
      if (!agg.has(key)) {
        agg.set(key, {
          sessionKeyId: a.sessionKeyId,
          agentSlug: a.agentSlug || 'anonymous',
          agentModel: a.agentModel || 'unknown',
          agentName: a.agentName || null,
          invested: 0,
          currentValue: 0,
          realizedPnl: 0,
          lastAction: a.action,
          lastActionAt: a.createdAt,
          lastOnChainTxHash: a.onChainTxHash || null,
          lastStorageRootHash: a.storageRootHash || null,
          actionCount: 0,
          status: a.status,
        });
      }
      const row = agg.get(key);
      row.actionCount += 1;
      row.invested += Number(a.invested) || 0;
      row.currentValue += Number(a.currentValue) || 0;
      row.realizedPnl += Number(a.realizedPnl) || 0;
    }
    res.json({ actions, agents: Array.from(agg.values()) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
