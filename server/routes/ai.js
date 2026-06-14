const express = require('express');
const router = express.Router();
const yieldShieldEngine = require('../engine/yieldShieldEngine');
const aiAdvisorService = require('../services/aiAdvisorService');
const complianceService = require('../services/complianceService');
const { MARKETS } = require('../config/markets');
const agentBearerAuth = require('../middleware/agentBearerAuth');

/**
 * POST /api/ai/recommend-shield
 * Body: { concern: string, depositAmount?: number, durationMonths?: number }
 *
 * Vendor-agnostic AI risk engine: picks a hedge asset and derives risk params.
 * Returns the envelope the frontend expects. The underlying model is never
 * exposed — only a generic engine label and an ai/heuristic mode.
 */
router.post('/recommend-shield', agentBearerAuth({ action: 'recommend' }), async (req, res) => {
  try {
    const { concern, depositAmount = 1000, durationMonths = 3 } = req.body || {};
    if (!concern) {
      return res.status(400).json({ error: 'Missing concern field' });
    }

    const durSec = Math.floor(Number(durationMonths) * 30 * 24 * 3600);
    const advice = await aiAdvisorService.recommendShield({
      concern,
      depositAmount: Number(depositAmount),
      durationSeconds: durSec,
    });
    const rec = advice.recommendation;
    const asset = rec.asset || 'GOLD';
    const market = MARKETS.find((m) => m.id === asset);
    const projection = yieldShieldEngine.getProjection({
      depositAmount: Number(depositAmount),
      asset,
      durationMonths: Number(durationMonths),
    });

    res.json({
      recommendation: {
        asset,
        assetName: rec.assetName || (market ? market.name : asset),
        reason:
          rec.reasoning ||
          `Based on your concern about "${concern}", we recommend hedging with ${rec.assetName || asset}.`,
        projection,
        riskParams: advice.riskParams,
        engine: rec.engine,
        mode: rec.mode,
      },
    });
  } catch (error) {
    console.error('[AI recommend-shield]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai/advise
 * Body: { concern: string, depositAmount?, durationSeconds?, durationMonths?,
 *         jurisdiction?, attestedAccredited? }
 *
 * The auditable Mantle advisor. Returns the AI hedge pick AND AI-derived risk
 * params (hedge ratio sized from volatility), plus a compliance verdict. This is
 * the decision later hashed into the on-chain shield envelope.
 */
router.post('/advise', agentBearerAuth({ action: 'recommend' }), async (req, res) => {
  try {
    const {
      concern,
      depositAmount = 1000,
      durationSeconds,
      durationMonths = 3,
      jurisdiction,
      attestedAccredited = false,
    } = req.body || {};
    if (!concern) return res.status(400).json({ error: 'Missing concern field' });

    const durSec = durationSeconds || Math.floor(Number(durationMonths) * 30 * 24 * 3600);
    const advice = await aiAdvisorService.recommendShield({
      concern,
      depositAmount: Number(depositAmount),
      durationSeconds: durSec,
    });

    let compliance = null;
    if (jurisdiction !== undefined) {
      compliance = await complianceService.checkCompliance({
        user: req.body.address || null,
        asset: advice.recommendation.asset,
        jurisdiction,
        attestedAccredited,
      });
    }

    res.json({ ...advice, compliance });
  } catch (error) {
    console.error('[AI advise]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai/compliance
 * Body: { user?, asset, jurisdiction, attestedAccredited? }
 * Standalone compliance check.
 */
router.post('/compliance', agentBearerAuth({ action: 'recommend' }), async (req, res) => {
  try {
    const { user, asset, jurisdiction, attestedAccredited = false } = req.body || {};
    if (!asset) return res.status(400).json({ error: 'Missing asset field' });
    const result = await complianceService.checkCompliance({
      user,
      asset,
      jurisdiction,
      attestedAccredited,
    });
    res.json({ compliance: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
