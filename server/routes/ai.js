const express = require('express');
const router = express.Router();
const yieldShieldEngine = require('../engine/yieldShieldEngine');
const zeroGComputeService = require('../services/zeroGComputeService');
const aiAdvisorService = require('../services/aiAdvisorService');
const complianceService = require('../services/complianceService');
const { MARKETS } = require('../config/markets');
const agentBearerAuth = require('../middleware/agentBearerAuth');

/**
 * POST /api/ai/recommend-shield
 * Body: { concern: string, depositAmount?: number, durationMonths?: number }
 *
 * Asks 0G Compute (TEE-verified) for an asset recommendation, with silent
 * NIM and OpenAI fallbacks. Returns the same envelope the frontend expects,
 * augmented with TEE proof fields when 0G Compute served the request.
 */
router.post('/recommend-shield', agentBearerAuth({ action: 'recommend' }), async (req, res) => {
  try {
    const { concern, depositAmount = 1000, durationMonths = 3 } = req.body || {};
    if (!concern) {
      return res.status(400).json({ error: 'Missing concern field' });
    }

    const rec = await zeroGComputeService.recommendShield(concern);

    const asset = rec.asset || 'gold';
    const market = MARKETS.find((m) => m.id === asset);
    const projection = yieldShieldEngine.getProjection({
      depositAmount: Number(depositAmount),
      asset,
      durationMonths: Number(durationMonths),
    });

    res.json({
      recommendation: {
        asset,
        assetName: market ? market.name : asset,
        reason:
          rec.reason ||
          `Based on your concern about "${concern}", we recommend hedging with ${market ? market.name : asset}.`,
        projection,
        // Inference provenance — surface to the UI so judges can see verifiability
        providerUsed: rec.providerUsed,
        teeVerified: rec.teeVerified === true,
        teeProviderAddress: rec.teeProviderAddress || null,
        teeModel: rec.teeModel || null,
        teeChatId: rec.teeChatId || null,
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
