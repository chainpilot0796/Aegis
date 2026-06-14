/**
 * Elsa AI Agent REST API
 * Programmatic access to the same agent logic as WhatsApp.
 * For web clients, MCP, or internal integrations.
 */

const express = require('express');
const router = express.Router();
const heyelsaService = require('../services/heyelsaService');

/**
 * GET /api/elsa/status
 * Elsa agent + HeyElsa x402 status
 */
router.get('/status', (req, res) => {
  res.json({
    agent: 'Aegis Elsa',
    heyelsa: heyelsaService.getInfo(),
    endpoints: {
      chat: 'POST /api/elsa/chat',
      confirm: 'POST /api/elsa/confirm',
      link: 'POST /api/elsa/link',
      intent: 'GET /api/elsa/intent?q=...',
    },
  });
});
const elsaAgentService = require('../services/elsaAgentService');
const WalletLink = require('../models/WalletLink');
// const heyelsaService = require('../services/heyelsaService');

/**
 * POST /api/elsa/chat
 * Body: { message, address?, phone? }
 * If address provided, uses it. Else resolves from phone via WalletLink.
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, address, phone } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Missing message' });
    }

    const walletOrPhone = address || phone;
    const result = await elsaAgentService.processMessage(message, walletOrPhone, req.body);

    res.json({
      intent: result.intent,
      success: result.success,
      message: result.message,
      needsConfirmation: result.needsConfirmation,
      confirmIntent: result.confirmIntent,
      data: result.data,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/elsa/confirm
 * Confirm a pending action (e.g. Yield Shield activation)
 * Body: { address, confirmIntent, confirm: true }
 */
router.post('/confirm', async (req, res) => {
  try {
    const { address, confirmIntent } = req.body;
    if (!address || !confirmIntent) {
      return res.status(400).json({ error: 'Missing address or confirmIntent' });
    }

    const result = await elsaAgentService.executeIntent(
      confirmIntent,
      address.toLowerCase(),
      { confirm: true }
    );

    res.json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/elsa/link
 * Link phone to wallet
 * Body: { phone, address }
 */
router.post('/link', async (req, res) => {
  try {
    const { phone, address } = req.body;
    if (!phone || !address) {
      return res.status(400).json({ error: 'Missing phone or address' });
    }
    const normalizedAddress = address.toLowerCase().trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(normalizedAddress)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    await WalletLink.findOneAndUpdate(
      { phone: String(phone).replace(/^whatsapp:/i, '') },
      { address: normalizedAddress, lastUsedAt: new Date() },
      { upsert: true }
    );

    res.json({ success: true, message: 'Wallet linked' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/elsa/intent
 * Parse intent only (no execution)
 * Query: ?q=Long%20%24300%20ETH
 */
router.get('/intent', (req, res) => {
  try {
    const q = req.query.q || '';
    const intent = elsaAgentService.detectIntent(q);
    res.json({ intent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
