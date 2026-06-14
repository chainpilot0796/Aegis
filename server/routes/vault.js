const express = require('express');
const router = express.Router();
const vaultEngine = require('../engine/vaultEngine');

// GET /stats — vault statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await vaultEngine.getVaultStats();
    res.json({ stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /deposit — LP deposit
router.post('/deposit', async (req, res) => {
  try {
    const { address, amount, txHash } = req.body;
    if (!address || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const result = await vaultEngine.processLpDeposit({
      address,
      amount: Number(amount),
      txHash,
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /withdraw — LP withdrawal request
router.post('/withdraw', async (req, res) => {
  try {
    const { address, amount } = req.body;
    if (!address || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const result = await vaultEngine.processLpWithdrawal({
      address,
      amount: Number(amount),
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
