/**
 * BitGo custodial wallet API
 * Get or create deposit address by phone; optional balance sync.
 */

const express = require('express');
const router = express.Router();
const elsaAgentService = require('../services/elsaAgentService');
const bitgoCustodyService = require('../services/bitgoCustodyService');
const CustodialWallet = require('../models/CustodialWallet');

// GET /api/custody/status
router.get('/status', (req, res) => {
  res.json({
    custody: 'BitGo',
    ...bitgoCustodyService.getInfo(),
    endpoints: {
      depositAddress: 'POST /api/custody/deposit-address { "phone": "+1234567890" }',
    },
  });
});

// POST /api/custody/deposit-address — get or create custodial wallet for phone
router.post('/deposit-address', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Missing phone' });
    }
    const result = await elsaAgentService.getOrCreateCustodialWallet(phone);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    res.json({
      receiveAddress: result.receiveAddress,
      isNew: result.isNew,
      walletId: result.walletId,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/custody/wallet/:phone — get custodial wallet info by phone
router.get('/wallet/:phone', async (req, res) => {
  try {
    const custodial = await CustodialWallet.findOne({ phone: req.params.phone }).lean();
    if (!custodial) {
      return res.status(404).json({ error: 'No custodial wallet for this phone' });
    }
    let balance = null;
    if (bitgoCustodyService.isConfigured()) {
      balance = await bitgoCustodyService.getWalletBalance(custodial.bitgoWalletId);
    }
    res.json({
      receiveAddress: custodial.receiveAddress,
      bitgoWalletId: custodial.bitgoWalletId,
      balance,
      createdAt: custodial.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
