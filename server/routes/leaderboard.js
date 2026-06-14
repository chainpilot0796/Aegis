const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Shield = require('../models/Shield');
const priceEngine = require('../engine/priceEngine');

// GET / — top traders ranked by realized+unrealized PnL across their shields.
//
// Why: User.totalPnl is never updated on shield settlement, and User.tradeCount
// is never incremented (only shieldCount). So sorting by a stored field always
// returned 0. We compute PnL on-the-fly here:
//
//   realizedPnl    = sum(shield.exposurePayout) for settled shields
//   unrealizedPnl  = sum(exposureBudget * (markPrice - entryPrice) / entryPrice)
//                    clamped to [-exposureBudget, +exposureBudget]  for active shields
//   totalPnl       = realizedPnl + unrealizedPnl
//   tradeCount     = total shields created (active + settled + cancelled)
//   winRate        = wins / shields-with-known-pnl * 100
//                    where a "win" is exposurePayout > 0 (settled) or current
//                    mark-to-market > 0 (active).
//
// Response is backward-compatible: { leaderboard: [{ address, totalPnl,
// tradeCount, winRate, trades, shields, ensSubname, realizedPnl, unrealizedPnl }] }.
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    // Pull users who have created at least one shield. We don't want to surface
    // users with only a balance and no activity (that's where the ghost
    // gold-4523.aegis.eth row came from — a user with shieldCount > 0 but no
    // settled PnL).
    const users = await User.find({ shieldCount: { $gt: 0 } })
      .select('address shieldCount tradeCount')
      .lean();

    if (users.length === 0) {
      return res.json({ leaderboard: [] });
    }

    const addresses = users.map((u) => u.address);
    const shields = await Shield.find({ user: { $in: addresses } })
      .select('user asset entryPrice exposureBudget exposurePayout status ensSubname')
      .lean();

    // Group shields by user
    const byUser = new Map();
    for (const s of shields) {
      const key = (s.user || '').toLowerCase();
      if (!byUser.has(key)) byUser.set(key, []);
      byUser.get(key).push(s);
    }

    // Build leaderboard rows
    const rows = users
      .map((u) => {
        const userShields = byUser.get(u.address) || [];
        if (userShields.length === 0) return null;

        let realizedPnl = 0;
        let unrealizedPnl = 0;
        let wins = 0;
        let scored = 0;
        let ensSubname = null;

        for (const s of userShields) {
          if (s.ensSubname && !ensSubname) ensSubname = s.ensSubname;

          if (s.status === 'settled') {
            const payout = Number(s.exposurePayout || 0);
            realizedPnl += payout;
            scored += 1;
            if (payout > 0) wins += 1;
          } else if (s.status === 'active' && s.entryPrice && s.exposureBudget) {
            const priceData = priceEngine.getPrice(s.asset);
            const markPrice = priceData ? priceData.price : null;
            if (markPrice && s.entryPrice > 0) {
              const change = (markPrice - s.entryPrice) / s.entryPrice;
              const raw = s.exposureBudget * change;
              const clamped = Math.max(-s.exposureBudget, Math.min(s.exposureBudget, raw));
              unrealizedPnl += clamped;
              scored += 1;
              if (clamped > 0) wins += 1;
            }
          }
          // cancelled: ignored
        }

        const totalPnl = realizedPnl + unrealizedPnl;
        const winRate = scored > 0 ? (wins / scored) * 100 : 0;
        // tradeCount = number of shields created (most accurate signal of
        // activity for this product). We keep User.tradeCount as a fallback in
        // case it's later wired up to perp trades.
        const tradeCount = userShields.length || u.tradeCount || 0;

        return {
          address: u.address,
          ensSubname,
          totalPnl: +totalPnl.toFixed(2),
          realizedPnl: +realizedPnl.toFixed(2),
          unrealizedPnl: +unrealizedPnl.toFixed(2),
          tradeCount,
          trades: tradeCount, // legacy alias for older frontends
          shields: userShields.length,
          winRate: +winRate.toFixed(1),
        };
      })
      .filter(Boolean);

    rows.sort((a, b) => b.totalPnl - a.totalPnl);
    const leaderboard = rows.slice(0, limit).map((row, i) => ({ rank: i + 1, ...row }));

    res.json({ leaderboard });
  } catch (error) {
    console.error('[leaderboard] error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /recent — latest shields across all users (small feed under the table).
// Used by the Leaderboard page to show that the product has activity even when
// nothing has settled with positive PnL.
router.get('/recent', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 5, 25);
    const shields = await Shield.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('user asset assetName depositAmount entryPrice exposureBudget exposurePayout status createdAt')
      .lean();

    const recent = shields.map((s) => {
      let currentPnl = null;
      if (s.status === 'settled') {
        currentPnl = Number(s.exposurePayout || 0);
      } else if (s.status === 'active' && s.entryPrice && s.exposureBudget) {
        const priceData = priceEngine.getPrice(s.asset);
        const markPrice = priceData ? priceData.price : null;
        if (markPrice && s.entryPrice > 0) {
          const change = (markPrice - s.entryPrice) / s.entryPrice;
          const raw = s.exposureBudget * change;
          currentPnl = Math.max(-s.exposureBudget, Math.min(s.exposureBudget, raw));
        }
      }
      return {
        user: s.user,
        asset: s.asset,
        assetName: s.assetName,
        depositAmount: s.depositAmount,
        currentPnl: currentPnl == null ? null : +currentPnl.toFixed(2),
        status: s.status,
        createdAt: s.createdAt,
      };
    });

    res.json({ recent });
  } catch (error) {
    console.error('[leaderboard/recent] error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
