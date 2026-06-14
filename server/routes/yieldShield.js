const express = require('express');
const router = express.Router();
const yieldShieldEngine = require('../engine/yieldShieldEngine');
const priceEngine = require('../engine/priceEngine');
const { MARKETS } = require('../config/markets');
const PriceHistory = require('../models/PriceHistory');
const Shield = require('../models/Shield');
const agentBearerAuth = require('../middleware/agentBearerAuth');
const shieldEnvelopeService = require('../services/shieldEnvelopeService');

// In-memory cache of recently-built envelopes keyed by rootHash, so /doc/:rootHash
// can serve the auditable envelope even in hash-only (no-IPFS) mode within a session.
const envelopeCache = new Map();
function cacheEnvelope(rootHash, payload) {
  if (!rootHash) return;
  envelopeCache.set(rootHash.toLowerCase(), payload);
  // Bound the cache.
  if (envelopeCache.size > 500) {
    const firstKey = envelopeCache.keys().next().value;
    envelopeCache.delete(firstKey);
  }
}

// GET /rates — current yield rates
router.get('/rates', (req, res) => {
  const rates = yieldShieldEngine.getBestYield();
  res.json({ rates });
});

// GET /assets — shield-eligible markets with prices
router.get('/assets', (req, res) => {
  const eligible = MARKETS.filter((m) => m.shieldEligible).map((market) => {
    const priceData = priceEngine.getPrice(market.id);
    return {
      id: market.id,
      name: market.name,
      category: market.category,
      emoji: market.emoji,
      price: priceData ? priceData.price : null,
      change24h: priceData ? priceData.change24h : null,
    };
  });
  res.json({ assets: eligible });
});

// POST /simulate — projection
router.post('/simulate', agentBearerAuth({ action: 'simulate' }), (req, res) => {
  try {
    const { depositAmount, asset, durationMonths } = req.body;
    if (!depositAmount || !asset || !durationMonths) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const projection = yieldShieldEngine.getProjection({
      depositAmount: Number(depositAmount),
      asset,
      durationMonths: Number(durationMonths),
    });
    res.json({ projection });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /prepare — commit the decision envelope, return on-chain args for AegisVault.createShield.
// Frontend calls this BEFORE the on-chain tx so it has the rootHash to pass into the contract.
router.post('/prepare', agentBearerAuth({ action: 'prepare' }), async (req, res) => {
  try {
    const {
      address,
      depositAmount,
      asset,
      durationMonths,
      teeInferenceSignature,
      teeInferenceProvider,
      teeInferenceModel,
    } = req.body || {};
    if (!address || !depositAmount || !asset || !durationMonths) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const prep = await yieldShieldEngine.prepareShield({
      address,
      depositAmount: Number(depositAmount),
      asset,
      durationMonths: Number(durationMonths),
      teeInferenceSignature: teeInferenceSignature || null,
      teeInferenceProvider: teeInferenceProvider || null,
      teeInferenceModel: teeInferenceModel || null,
    });
    res.json({ success: true, prepare: prep });
  } catch (err) {
    console.error('[yield-shield/prepare]', err);
    res.status(400).json({ error: err.message });
  }
});

// POST /prepare-mantle — Mantle-native auditable flow.
// Runs the AI advisor (asset pick + risk params), compliance, builds + stores the
// shield envelope, and returns the keccak256 rootHash to commit on-chain plus the
// on-chain args for AegisVault.createShield (Mantle).
router.post('/prepare-mantle', agentBearerAuth({ action: 'prepare' }), async (req, res) => {
  try {
    const {
      address,
      depositAmount,
      durationMonths,
      concern,
      jurisdiction,
      attestedAccredited,
      asset, // optional override
    } = req.body || {};
    if (!address || !depositAmount || !durationMonths) {
      return res.status(400).json({ error: 'Missing required fields (address, depositAmount, durationMonths)' });
    }
    const prep = await yieldShieldEngine.prepareShieldMantle({
      address,
      depositAmount: Number(depositAmount),
      durationMonths: Number(durationMonths),
      concern: concern || null,
      jurisdiction,
      attestedAccredited: attestedAccredited === true,
      asset: asset || null,
    });
    // Cache the envelope so /doc/:rootHash and /verify can serve it.
    cacheEnvelope(prep.rootHash, { envelope: prep.envelope, canonicalJson: prep.canonicalJson, uri: prep.storageUri, cid: prep.storageCid });
    res.json({ success: true, prepare: prep });
  } catch (err) {
    if (err.code === 'COMPLIANCE_REJECTED') {
      return res.status(403).json({ error: err.message, compliance: err.compliance });
    }
    console.error('[yield-shield/prepare-mantle]', err);
    res.status(400).json({ error: err.message });
  }
});

// POST /sponsor-create — relayer-sponsored (gasless-ish) shield creation on Mantle.
//
// LIMITATION: AegisVault.createShield uses msg.sender as the shield owner AND pulls
// USDY from msg.sender via safeTransferFrom. There is no permit/meta-tx/forwarder on
// the contract, so the relayer CANNOT create a shield owned by the user without the
// user signing the tx. True account-abstraction meta-tx is out of scope for the 24h
// demo (would require an EIP-2612 permit or ERC-2771 forwarder on the contract).
//
// FEASIBLE gasless path implemented here: the relayer pre-funds the user's address
// with a small amount of native MNT so the user can submit createShield themselves
// without holding gas. The user still signs createShield (they own the shield and
// their USDY is pulled). This is the honest, contract-compatible "gasless" path.
router.post('/sponsor-create', agentBearerAuth({ action: 'activate' }), async (req, res) => {
  try {
    const mantle = require('../config/mantle');
    const { ethers } = require('ethers');
    const { userAddress } = req.body || {};
    if (!userAddress || !ethers.isAddress(userAddress)) {
      return res.status(400).json({ error: 'Valid userAddress required' });
    }
    if (!mantle.relayer) {
      return res.status(503).json({ error: 'Relayer not configured on this server' });
    }

    // Gas top-up amount (native MNT). Default 0.02 MNT — enough for a createShield tx.
    const topUp = process.env.SPONSOR_GAS_TOPUP_MNT || '0.02';
    const value = ethers.parseEther(String(topUp));

    // Only top up if the user is below a threshold so we don't drain the relayer.
    const bal = await mantle.provider.getBalance(userAddress);
    const threshold = ethers.parseEther(String(process.env.SPONSOR_GAS_THRESHOLD_MNT || '0.005'));
    if (bal >= threshold) {
      return res.json({
        success: true,
        sponsored: false,
        reason: 'User already has sufficient gas',
        balance: bal.toString(),
      });
    }

    const tx = await mantle.relayer.sendTransaction({ to: userAddress, value });
    const receipt = await tx.wait();
    const txHash = receipt?.hash || tx?.hash;
    res.json({
      success: true,
      sponsored: true,
      gasTopUpMnt: topUp,
      txHash,
      explorerUrl: txHash ? `${mantle.explorerBase}/tx/${txHash}` : null,
      note: 'Gas pre-funded. User now submits createShield themselves (they own the shield; their USDY is pulled). The contract has no permit/forwarder, so the relayer cannot create the shield on the user\'s behalf.',
    });
  } catch (err) {
    console.error('[yield-shield/sponsor-create]', err);
    res.status(400).json({ error: err.message });
  }
});

// POST /settle-mantle/:id — relayer settles a shield ON-CHAIN on Mantle.
router.post('/settle-mantle/:id', async (req, res) => {
  try {
    const result = await yieldShieldEngine.settleShieldOnChainMantle(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /verify — re-hash a published canonical envelope JSON and confirm it matches
// a rootHash. Lets anyone independently audit the on-chain commitment.
// Body: { canonicalJson: string, rootHash: string }
router.post('/verify', (req, res) => {
  try {
    const { canonicalJson, rootHash } = req.body || {};
    if (!canonicalJson || !rootHash) {
      return res.status(400).json({ error: 'canonicalJson and rootHash required' });
    }
    const valid = shieldEnvelopeService.verify(canonicalJson, rootHash);
    res.json({ valid, rootHash });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /activate — create a shield (server-side: commit the decision envelope,
// persist Shield record with TEE inference proof + on-chain tx hash from the
// frontend's `AegisVault.createShield` call).
router.post('/activate', agentBearerAuth({ action: 'activate' }), async (req, res) => {
  try {
    const {
      address,
      depositAmount,
      asset,
      durationMonths,
      // Optional — pass-through from the frontend recommend step:
      teeInferenceSignature,
      teeInferenceProvider,
      teeInferenceModel,
      teeInferenceVerified,
      // Optional — pass-through from the frontend on-chain createShield call:
      onChainTxHash,
      onChainIdx,
    } = req.body;
    if (!address || !depositAmount || !asset || !durationMonths) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // Two activation modes:
    // 1. Frontend already called /prepare and submitted the on-chain tx — it sends
    //    the prepare-result back as `prepare` along with on-chain confirmation. Use
    //    `persistShield` to avoid re-uploading the doc.
    // 2. Legacy callers (WhatsApp / Elsa agent) call /activate with just the
    //    intent fields — use the full `createShield` flow (uploads + persists).
    const { prepare } = req.body;
    let shield;
    if (prepare && prepare.rootHash) {
      shield = await yieldShieldEngine.persistShield({
        address,
        depositAmount: Number(depositAmount),
        asset,
        durationMonths: Number(durationMonths),
        storageProvider: prepare.storageProvider,
        storageRootHash: prepare.rootHash,
        storageTxHash: prepare.storageTxHash,
        storageCid: prepare.storageCid || null,
        storageUri: prepare.storageUri || null,
        // Mantle auditable envelope pass-through
        envelopeRootHash: prepare.rootHash,
        recommendation: prepare.recommendation || null,
        riskParams: prepare.riskParams || null,
        compliance: prepare.compliance || null,
        chain: prepare.recommendation ? 'mantle' : null,
        asset: prepare.asset || asset,
        yieldApy: prepare.yieldApy,
        yieldSource: prepare.yieldSource,
        exposureBudget: prepare.exposureBudget,
        entryPrice: prepare.entryPrice,
        assetName: prepare.assetName,
        onChainTxHash: onChainTxHash || null,
        onChainIdx: typeof onChainIdx === 'number' ? onChainIdx : null,
        teeInferenceSignature: teeInferenceSignature || null,
        teeInferenceProvider: teeInferenceProvider || null,
        teeInferenceModel: teeInferenceModel || null,
        teeInferenceVerified: teeInferenceVerified === true,
      });
    } else {
      shield = await yieldShieldEngine.createShield({
        address,
        depositAmount: Number(depositAmount),
        asset,
        durationMonths: Number(durationMonths),
        teeInferenceSignature: teeInferenceSignature || null,
        teeInferenceProvider: teeInferenceProvider || null,
        teeInferenceModel: teeInferenceModel || null,
        teeInferenceVerified: teeInferenceVerified === true,
      });
      if (onChainTxHash || typeof onChainIdx === 'number') {
        shield.onChainTxHash = onChainTxHash || null;
        shield.onChainIdx = typeof onChainIdx === 'number' ? onChainIdx : null;
        await shield.save();
      }
    }
    res.json({ success: true, shield });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /settle/:id — settle a shield
router.post('/settle/:id', async (req, res) => {
  try {
    const shield = await yieldShieldEngine.settleShield(req.params.id);
    res.json({ success: true, shield });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /active/:address — active shields
router.get('/active/:address', async (req, res) => {
  try {
    const shields = await yieldShieldEngine.getActiveShields(req.params.address);
    res.json({ shields });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /history/:address — settled shields
router.get('/history/:address', async (req, res) => {
  try {
    const shields = await yieldShieldEngine.getShieldHistory(req.params.address);
    res.json({ shields });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /doc/:rootHash — fetch the auditable shield envelope so anyone can re-hash
// and verify the on-chain commitment.
// Resolution order: in-memory cache -> Shield DB record -> IPFS gateway (Pinata)
// -> legacy storage. Includes a self-verification of the rootHash.
router.get('/doc/:rootHash', async (req, res) => {
  try {
    const { rootHash } = req.params;
    if (!rootHash || rootHash.length < 4) {
      return res.status(400).json({ error: 'Invalid rootHash' });
    }
    const key = rootHash.toLowerCase();

    // 1. In-memory cache (built this session)
    const cached = envelopeCache.get(key);
    if (cached) {
      const verified = shieldEnvelopeService.verify(cached.canonicalJson, rootHash);
      return res.json({
        rootHash,
        source: 'cache',
        verified,
        envelope: cached.envelope,
        canonicalJson: cached.canonicalJson,
        uri: cached.uri || null,
        cid: cached.cid || null,
      });
    }

    // 2. Shield DB record (rebuild canonical JSON deterministically for verification)
    const shieldDoc = await Shield.findOne({
      $or: [{ envelopeRootHash: rootHash }, { storageRootHash: rootHash }],
    }).lean();
    if (shieldDoc && shieldDoc.recommendation) {
      const rebuilt = shieldEnvelopeService.buildEnvelope({
        user: shieldDoc.user,
        concern: (shieldDoc.envelope && shieldDoc.envelope.concern) || null,
        recommendation: shieldDoc.recommendation,
        riskParams: shieldDoc.riskParams,
        compliance: shieldDoc.compliance,
        deposit: Math.floor(shieldDoc.depositAmount * 1e6).toString(),
        durationSeconds: Math.floor(shieldDoc.durationMonths * 30 * 24 * 3600),
        entryPrice: Math.max(Math.floor(shieldDoc.entryPrice * 1e8), 1),
      });
      // createdAt differs on rebuild, so report the stored envelope + a best-effort flag.
      return res.json({
        rootHash,
        source: 'db',
        verified: rebuilt.rootHash.toLowerCase() === key,
        recommendation: shieldDoc.recommendation,
        riskParams: shieldDoc.riskParams,
        compliance: shieldDoc.compliance,
        uri: shieldDoc.storageUri || null,
        cid: shieldDoc.storageCid || null,
        note: 'Rebuilt from DB; for byte-exact verification fetch the canonicalJson from the IPFS uri.',
      });
    }

    // 3. IPFS gateway via stored CID (if any DB record has a uri)
    if (shieldDoc && shieldDoc.storageUri) {
      try {
        const axios = require('axios');
        const r = await axios.get(shieldDoc.storageUri, { timeout: 12000 });
        return res.json({ rootHash, source: 'ipfs', envelope: r.data, uri: shieldDoc.storageUri });
      } catch (e) {
        console.warn('[doc] IPFS fetch failed:', e.message);
      }
    }

    // 4. Legacy envelope storage fallback
    const zeroGStorageService = require('../services/zeroGStorageService');
    if (zeroGStorageService.isConfigured()) {
      const doc = await zeroGStorageService.fetchShieldDoc(rootHash);
      if (doc) return res.json({ rootHash, source: '0g', ...doc });
    }

    return res.status(404).json({ error: 'Shield envelope not found for rootHash' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /backtest/:asset — generate backtest data
router.get('/backtest/:asset', async (req, res) => {
  try {
    const { asset } = req.params;
    const history = await PriceHistory.find({ marketId: asset })
      .sort({ timestamp: 1 })
      .limit(365)
      .lean();

    if (history.length < 2) {
      return res.json({ asset, backtest: [], message: 'Insufficient price history' });
    }

    const backtestResults = [];
    const depositAmount = 1000;
    const durationMonths = 3;

    for (let i = 0; i < history.length - 1; i += 30) {
      const entry = history[i];
      const exitIdx = Math.min(i + 90, history.length - 1);
      const exit = history[exitIdx];

      const priceChange = (exit.price - entry.price) / entry.price;
      const yieldEarned = depositAmount * 0.05 * (durationMonths / 12);
      const exposureBudget = yieldEarned;
      const exposureReturn = Math.max(exposureBudget * priceChange, -exposureBudget);

      backtestResults.push({
        entryDate: entry.timestamp,
        exitDate: exit.timestamp,
        entryPrice: entry.price,
        exitPrice: exit.price,
        priceChange: +(priceChange * 100).toFixed(2),
        yieldEarned: +yieldEarned.toFixed(2),
        exposureReturn: +exposureReturn.toFixed(2),
        totalReturn: +(depositAmount + yieldEarned + exposureReturn).toFixed(2),
      });
    }

    res.json({ asset, backtest: backtestResults });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
