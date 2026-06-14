const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Position = require('../models/Position');

// GET /:address — user profile with balances
router.get('/:address', async (req, res) => {
  try {
    let user = await User.findOne({ address: req.params.address.toLowerCase() });
    if (!user) {
      // Auto-create user on first access
      user = await User.create({ address: req.params.address.toLowerCase() });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /:address/pnl — P&L summary
router.get('/:address/pnl', async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();
    const user = await User.findOne({ address });

    if (!user) {
      return res.json({ totalPnl: 0, realizedPnl: 0, unrealizedPnl: 0, tradeCount: 0 });
    }

    // Calculate unrealized PnL from open positions
    const openPositions = await Position.find({ user: address, status: 'open' });
    const unrealizedPnl = openPositions.reduce((sum, p) => sum + (p.unrealizedPnl || 0), 0);

    // Realized PnL from closed positions
    const closedPositions = await Position.find({
      user: address,
      status: { $in: ['closed', 'liquidated'] },
    });
    const realizedPnl = closedPositions.reduce((sum, p) => sum + (p.realizedPnl || 0), 0);

    res.json({
      totalPnl: user.totalPnl,
      realizedPnl: +realizedPnl.toFixed(2),
      unrealizedPnl: +unrealizedPnl.toFixed(2),
      tradeCount: user.tradeCount,
      shieldCount: user.shieldCount,
      traderBalance: user.traderBalance,
      lpBalance: user.lpBalance,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
