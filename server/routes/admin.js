/**
 * Admin routes — runtime LLM provider/model + API key management.
 *
 * Gated by a single shared password (ADMIN_PASSWORD). Reachable only by anyone
 * who knows the password and the /admin URL; the panel is not linked in the app
 * nav. API keys are stored via the gateway and are NEVER returned raw — only a
 * masked hint (••••last4) and a "configured" flag are exposed.
 */

const express = require('express');
const router = express.Router();
const llmGateway = require('../services/llmGateway');

const ADMIN_PASSWORD = 'admin';

function checkAuth(req, res) {
  const pw =
    (req.body && req.body.password) ||
    req.headers['x-admin-password'] ||
    (req.query && req.query.password);
  if (pw !== ADMIN_PASSWORD) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}

// Current config + provider catalog (masked keys only).
router.get('/llm', (req, res) => {
  if (!checkAuth(req, res)) return;
  res.json(llmGateway.publicConfig());
});

// Switch active provider and/or model.
router.post('/llm', async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const { provider, model } = req.body || {};
    if (provider && !llmGateway.hasProvider(provider)) {
      return res.status(400).json({ error: `unknown provider: ${provider}` });
    }
    const cfg = await llmGateway.setActiveConfig({ provider, model });
    res.json(cfg);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Set or clear a provider's API key. { provider, action: 'set'|'clear', apiKey }
router.post('/key', async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const { provider, apiKey, action } = req.body || {};
    if (!llmGateway.hasProvider(provider)) {
      return res.status(400).json({ error: `unknown provider: ${provider}` });
    }
    let cfg;
    if (action === 'clear') {
      cfg = await llmGateway.clearApiKey(provider);
    } else {
      if (!apiKey || typeof apiKey !== 'string') {
        return res.status(400).json({ error: 'apiKey (string) required' });
      }
      cfg = await llmGateway.setApiKey(provider, apiKey.trim());
    }
    res.json(cfg);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
