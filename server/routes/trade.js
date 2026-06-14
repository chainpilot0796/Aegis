const express = require('express');
const router = express.Router();
const tradeService = require('../services/tradeService');

// POST /open — open a new position
router.post('/open', async (req, res) => {
  try {
    const { address, marketId, direction, margin, leverage, tp, sl } = req.body;

    if (!address || !marketId || !direction || !margin || !leverage) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const position = await tradeService.openPosition({
      address,
      marketId,
      direction,
      margin,
      leverage,
      tp,
      sl,
    });

    res.json({ success: true, position });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /close — close a position
router.post('/close', async (req, res) => {
  try {
    const { positionId } = req.body;
    if (!positionId) {
      return res.status(400).json({ error: 'Missing positionId' });
    }

    const position = await tradeService.closePosition(positionId);
    res.json({ success: true, position });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /positions/:address — open positions (optional ?marketId= filter)
router.get('/positions/:address', async (req, res) => {
  try {
    const positions = await tradeService.getOpenPositions(req.params.address, req.query.marketId);
    res.json({ positions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /history/:address — closed positions
router.get('/history/:address', async (req, res) => {
  try {
    const positions = await tradeService.getPositionHistory(req.params.address);
    res.json({ positions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
