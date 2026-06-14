const Shield = require('../models/Shield');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const perpEngine = require('./perpEngine');
const priceEngine = require('./priceEngine');
const sponsorService = require('../services/sponsorService');
const bitgoService = require('../services/bitgoService');
const aiAdvisorService = require('../services/aiAdvisorService');
const complianceService = require('../services/complianceService');
const shieldEnvelopeService = require('../services/shieldEnvelopeService');
const { MARKETS } = require('../config/markets');
const { ethers } = require('ethers');

const YIELD_SOURCES = [
  { protocol: 'Morpho', vault: 'Steakhouse USDC', baseApy: 6.4 },
  { protocol: 'Aave V3', vault: 'USDC Supply', baseApy: 3.8 },
  { protocol: 'Moonwell', vault: 'USDC Market', baseApy: 5.9 },
];

function getBestYield() {
  const sources = YIELD_SOURCES.map((s) => ({
    ...s,
    currentApy: +(s.baseApy + (Math.random() * 0.4 - 0.2)).toFixed(2),
  }));
  sources.sort((a, b) => b.currentApy - a.currentApy);
  return sources;
}

function getProjection({ depositAmount, asset, durationMonths }) {
  const sources = getBestYield();
  const bestSource = sources[0];
  const apy = bestSource.currentApy;

  const yieldEarned = depositAmount * (apy / 100) * (durationMonths / 12);
  const exposureBudget = yieldEarned;

  const market = MARKETS.find((m) => m.id === asset);
  const priceData = priceEngine.getPrice(asset);
  const currentPrice = priceData ? priceData.price : 0;

  // Scenario table: asset price changes from -100% to +100%
  const scenarios = [];
  for (let pctChange = -100; pctChange <= 100; pctChange += 25) {
    const assetReturn = exposureBudget * (pctChange / 100);
    const totalReturn = depositAmount + yieldEarned + Math.max(assetReturn, -exposureBudget);
    scenarios.push({
      assetChange: pctChange,
      yieldEarned: +yieldEarned.toFixed(2),
      exposureReturn: +Math.max(assetReturn, -exposureBudget).toFixed(2),
      totalReturn: +totalReturn.toFixed(2),
      netReturn: +(totalReturn - depositAmount).toFixed(2),
    });
  }

  return {
    depositAmount,
    asset,
    assetName: market ? market.name : asset,
    durationMonths,
    yieldSource: `${bestSource.protocol} - ${bestSource.vault}`,
    yieldApy: apy,
    yieldEarned: +yieldEarned.toFixed(2),
    exposureBudget: +exposureBudget.toFixed(2),
    currentPrice,
    scenarios,
  };
}

/**
 * Mantle-native prepare flow (auditable AI advisor + compliance + envelope hash).
 *
 * Runs:
 *   1. aiAdvisorService.recommendShield  -> asset pick + AI-derived risk params
 *   2. complianceService.checkCompliance -> regulatory verdict (blocks on "reject")
 *   3. shieldEnvelopeService.buildEnvelope/store -> canonical envelope + keccak256
 *      rootHash (committed on-chain as createShield's `storageRootHash`) + IPFS uri.
 *
 * Returns everything the route/frontend need to invoke AegisVault.createShield on
 * Mantle, plus the recommendation / riskParams / compliance / rootHash to surface.
 *
 * @param {object} opts
 * @param {string} opts.address
 * @param {number} opts.depositAmount    human USDY (6dp token)
 * @param {number} opts.durationMonths
 * @param {string} opts.concern          natural-language concern (drives the AI)
 * @param {string} [opts.jurisdiction]   for compliance
 * @param {boolean} [opts.attestedAccredited]
 * @param {string} [opts.asset]          optional symbol override (else AI picks)
 */
async function prepareShieldMantle({
  address,
  depositAmount,
  durationMonths,
  concern,
  jurisdiction,
  attestedAccredited = false,
  asset: assetOverride = null,
}) {
  if (!address || !depositAmount || !durationMonths) {
    throw new Error('Missing required prepareShieldMantle fields (address, depositAmount, durationMonths)');
  }
  if (!concern && !assetOverride) {
    throw new Error('Provide a `concern` for the AI advisor or an explicit `asset`');
  }

  const durationSeconds = Math.floor(durationMonths * 30 * 24 * 3600);

  // 1. Auditable AI advisor: asset pick + risk params + entry price.
  const advice = await aiAdvisorService.recommendShield({
    concern: concern || `Hedge with ${assetOverride}`,
    depositAmount,
    durationSeconds,
  });
  const recommendation = advice.recommendation;
  const riskParams = advice.riskParams;

  // Honor an explicit asset override while keeping the AI-derived risk params.
  if (assetOverride) {
    const sym = String(assetOverride);
    recommendation.asset = sym;
    recommendation.assetId = ethers.keccak256(ethers.toUtf8Bytes(sym));
  }
  const assetSymbol = recommendation.asset;
  const entryPrice = advice.entryPrice; // already 1e8-scaled int

  // 2. Compliance — blocks creation on "reject".
  const compliance = await complianceService.checkCompliance({
    user: address,
    asset: assetSymbol,
    jurisdiction,
    attestedAccredited,
  });
  if (compliance.verdict === 'reject') {
    const err = new Error(
      `Compliance check rejected: ${compliance.notes || compliance.flags.join(', ')}`
    );
    err.code = 'COMPLIANCE_REJECTED';
    err.compliance = compliance;
    throw err;
  }

  // Yield projection (off-chain economics) — drives exposure budget.
  const sources = getBestYield();
  const bestSource = sources[0];
  const apy = bestSource.currentApy;
  const yieldEarned = depositAmount * (apy / 100) * (durationMonths / 12);
  // Exposure budget is the yield, sized by the AI-derived hedge ratio.
  const exposureBudget = +(yieldEarned * (riskParams.hedgeRatioBps / 10000)).toFixed(2);

  // 3. Build the auditable envelope and commit its keccak256 hash on-chain.
  const deposit = Number(depositAmount);
  const { envelope, canonicalJson, rootHash } = shieldEnvelopeService.buildEnvelope({
    user: address,
    concern: concern || null,
    recommendation,
    riskParams,
    compliance,
    deposit,
    durationSeconds,
    entryPrice,
  });
  const stored = await shieldEnvelopeService.store(envelope, canonicalJson);

  // Deterministic on-chain args for AegisVault.createShield.
  const assetIdBytes32 = recommendation.assetId;
  const depositBaseUnits = Math.floor(deposit * 1e6).toString(); // USDY 6dp, uint128

  return {
    rootHash,                       // bytes32 -> createShield storageRootHash
    storageProvider: stored.provider,
    storageCid: stored.cid,
    storageUri: stored.uri,
    canonicalJson,                  // re-hash this to verify rootHash
    envelope,
    recommendation,
    riskParams,
    compliance,
    // On-chain args
    assetIdBytes32,
    entryPriceScaled: entryPrice,
    durationSeconds,
    depositBaseUnits,
    // Economics
    asset: assetSymbol,
    assetName: recommendation.assetName || assetSymbol,
    yieldApy: apy,
    yieldSource: `${bestSource.protocol} - ${bestSource.vault}`,
    exposureBudget,
    entryPrice,
  };
}

/**
 * Build the deterministic on-chain args + upload the agreement doc to 0G Storage.
 * Returns everything the frontend needs to invoke AegisVault.createShield.
 *
 * Splits out from the legacy `createShield()` flow so the frontend can:
 *   1. POST /api/yield-shield/prepare       -> get rootHash + bytes32/uint64 args
 *   2. (client) submit on-chain tx via wagmi
 *   3. POST /api/yield-shield/activate      -> persist Shield record
 */
async function prepareShield({
  address,
  depositAmount,
  asset,
  durationMonths,
  teeInferenceSignature = null,
  teeInferenceProvider = null,
  teeInferenceModel = null,
}) {
  if (!address || !depositAmount || !asset || !durationMonths) {
    throw new Error('Missing required prepareShield fields');
  }

  const sources = getBestYield();
  const bestSource = sources[0];
  const apy = bestSource.currentApy;

  const yieldEarned = depositAmount * (apy / 100) * (durationMonths / 12);
  const exposureBudget = +yieldEarned.toFixed(2);

  const market = MARKETS.find((m) => m.id === asset);
  const assetName = market ? market.name : asset;

  // Entry price — best-effort from price engine; falls back to 1 (real-time feeds are
  // out of scope for the Aegis.0G hackathon demo, README notes this explicitly).
  const priceData = priceEngine.getPrice(asset);
  const entryPrice = priceData && priceData.price ? priceData.price : 1;

  // Upload shield agreement doc to 0G Storage (with Fileverse + content-hash fallback)
  const docResult = await sponsorService.createShieldDoc({
    address,
    asset,
    depositAmount,
    durationMonths,
    exposureBudget,
    entryPrice,
    yieldApy: apy,
    yieldSource: `${bestSource.protocol} - ${bestSource.vault}`,
    teeInferenceSignature,
    teeInferenceProvider,
  });

  // Derive deterministic on-chain args
  const assetIdBytes32 = ethers.keccak256(ethers.toUtf8Bytes(asset));
  const durationSeconds = Math.floor(durationMonths * 30 * 24 * 3600);
  const entryPriceScaled = Math.max(Math.floor(entryPrice * 1e8), 1); // uint64
  const depositBaseUnits = Math.floor(depositAmount * 1e6).toString(); // uint128 (USDC 6dp), as string for safety

  // The rootHash must fit bytes32 — 0G Storage rootHashes are 0x + 64 hex chars already
  let storageRootHash = docResult?.rootHash || null;
  if (!storageRootHash) {
    // No 0G Storage available — fall back to deterministic content hash as bytes32 so the
    // on-chain `createShield` call still succeeds; flag the provider as 'hash'.
    const payload = JSON.stringify({ address, asset, depositAmount, durationMonths, entryPrice, at: Date.now() });
    storageRootHash = ethers.keccak256(ethers.toUtf8Bytes(payload));
  }

  return {
    rootHash: storageRootHash,
    storageProvider: docResult?.provider || 'hash',
    storageTxHash: docResult?.txHash || null,
    assetIdBytes32,
    entryPriceScaled,
    durationSeconds,
    depositBaseUnits,
    assetName,
    yieldApy: apy,
    yieldSource: `${bestSource.protocol} - ${bestSource.vault}`,
    exposureBudget,
    entryPrice,
    markdown: docResult?.markdown || null,
    json: docResult?.json || null,
  };
}

/**
 * Persist a Shield record after the user's on-chain `createShield` tx confirmed.
 * Does NOT re-upload the doc — relies on `prepareShield` having done so already.
 */
async function persistShield({
  address,
  depositAmount,
  asset,
  durationMonths,
  // Prep outputs (passed through from the frontend or recomputed if missing):
  storageProvider,
  storageRootHash,
  storageTxHash,
  yieldApy,
  yieldSource,
  exposureBudget,
  entryPrice,
  assetName,
  // On-chain confirmation:
  onChainTxHash = null,
  onChainIdx = null,
  // Inference proof:
  teeInferenceSignature = null,
  teeInferenceProvider = null,
  teeInferenceModel = null,
  teeInferenceVerified = false,
  // Mantle auditable-envelope fields (optional):
  storageCid = null,
  storageUri = null,
  envelopeRootHash = null,
  recommendation = null,
  riskParams = null,
  compliance = null,
  chain = null,
}) {
  if (!address || !depositAmount || !asset || !durationMonths) {
    throw new Error('Missing required persistShield fields');
  }

  // Backfill any missing numeric/metadata fields cheaply (no upload)
  if (yieldApy == null || exposureBudget == null) {
    const sources = getBestYield();
    const best = sources[0];
    yieldApy = yieldApy ?? best.currentApy;
    yieldSource = yieldSource ?? `${best.protocol} - ${best.vault}`;
    if (exposureBudget == null) {
      exposureBudget = +(depositAmount * (yieldApy / 100) * (durationMonths / 12)).toFixed(2);
    }
  }
  if (!assetName) {
    const market = MARKETS.find((m) => m.id === asset);
    assetName = market ? market.name : asset;
  }
  if (entryPrice == null) {
    const priceData = priceEngine.getPrice(asset);
    entryPrice = priceData && priceData.price ? priceData.price : 1;
  }

  const userShort = address.slice(2, 6).toLowerCase();
  const ensSubname = await sponsorService.registerEnsSubname(asset, userShort, address);

  const settleAt = new Date(Date.now() + durationMonths * 30 * 24 * 60 * 60 * 1000);

  const shield = await Shield.create({
    user: address.toLowerCase(),
    depositAmount,
    asset,
    assetName,
    durationMonths,
    yieldSource,
    yieldApy,
    exposureBudget,
    entryPrice,
    settleAt,
    ensSubname,

    storageProvider: storageProvider || null,
    storageRootHash: storageRootHash || null,
    storageTxHash: storageTxHash || null,
    storageCid: storageCid || null,
    storageUri: storageUri || null,
    fileverseDocHash: storageRootHash || null,

    // Mantle auditable envelope
    envelopeRootHash: envelopeRootHash || storageRootHash || null,
    recommendation: recommendation || null,
    riskParams: riskParams || null,
    compliance: compliance || null,
    chain: chain || null,

    teeInferenceSignature,
    teeInferenceProvider,
    teeInferenceModel,
    teeInferenceVerified,

    onChainTxHash,
    onChainIdx,
  });

  await User.findOneAndUpdate(
    { address: address.toLowerCase() },
    {
      $inc: { shieldCount: 1, traderBalance: -depositAmount },
      $set: { lastActiveAt: new Date() },
    },
    { upsert: true }
  );

  await Transaction.create({
    user: address.toLowerCase(),
    type: 'shield_create',
    amount: depositAmount,
    details: {
      shieldId: shield._id,
      asset,
      durationMonths,
      exposureBudget,
      yieldApy,
      storageRootHash,
      onChainTxHash,
    },
  });

  bitgoService.logTx('shield_create', {
    user: address,
    asset,
    depositAmount,
    exposureBudget,
    durationMonths,
    storageRootHash,
    onChainTxHash,
  });

  return shield;
}

async function createShield({
  address,
  depositAmount,
  asset,
  durationMonths,
  teeInferenceSignature = null,
  teeInferenceProvider = null,
  teeInferenceModel = null,
  teeInferenceVerified = false,
}) {
  const sources = getBestYield();
  const bestSource = sources[0];
  const apy = bestSource.currentApy;

  const yieldEarned = depositAmount * (apy / 100) * (durationMonths / 12);
  const exposureBudget = +yieldEarned.toFixed(2);

  const priceData = priceEngine.getPrice(asset);
  if (!priceData || !priceData.price) {
    throw new Error(`No price available for asset ${asset}`);
  }
  const entryPrice = priceData.price;

  const market = MARKETS.find((m) => m.id === asset);
  const assetName = market ? market.name : asset;

  // Create a linked 1x LONG position using exposureBudget as margin (legacy perp path)
  let positionId = null;
  try {
    const position = await perpEngine.openPosition({
      user: address,
      marketId: asset,
      direction: 'LONG',
      margin: exposureBudget,
      leverage: 1,
    });
    positionId = position._id;
  } catch (err) {
    console.warn('[YieldShield] Could not create linked position:', err.message);
  }

  // ENS subname (aegis.eth) — best-effort, mocked if ENS not configured
  const userShort = address.slice(2, 6).toLowerCase();
  const ensSubname = await sponsorService.registerEnsSubname(asset, userShort, address);

  // Storage: try 0G Storage first, then Fileverse, then content hash
  const docResult = await sponsorService.createShieldDoc({
    address,
    asset,
    depositAmount,
    durationMonths,
    exposureBudget,
    entryPrice,
    yieldApy: apy,
    yieldSource: `${bestSource.protocol} - ${bestSource.vault}`,
    teeInferenceSignature,
    teeInferenceProvider,
  });

  const settleAt = new Date(Date.now() + durationMonths * 30 * 24 * 60 * 60 * 1000);

  const shield = await Shield.create({
    user: address.toLowerCase(),
    depositAmount,
    asset,
    assetName,
    durationMonths,
    yieldSource: `${bestSource.protocol} - ${bestSource.vault}`,
    yieldApy: apy,
    exposureBudget,
    entryPrice,
    positionId,
    settleAt,
    ensSubname,

    // Storage
    storageProvider: docResult?.provider || null,
    storageRootHash: docResult?.rootHash || null,
    storageTxHash: docResult?.txHash || null,
    fileverseDocHash: docResult?.fileId || docResult?.hash || docResult?.txHash || null,

    // TEE inference proof
    teeInferenceSignature,
    teeInferenceProvider,
    teeInferenceModel,
    teeInferenceVerified,
  });

  // Update user
  await User.findOneAndUpdate(
    { address: address.toLowerCase() },
    {
      $inc: { shieldCount: 1, traderBalance: -depositAmount },
      $set: { lastActiveAt: new Date() },
    },
    { upsert: true }
  );

  // Log transaction
  await Transaction.create({
    user: address.toLowerCase(),
    type: 'shield_create',
    amount: depositAmount,
    details: {
      shieldId: shield._id,
      asset,
      durationMonths,
      exposureBudget,
      yieldApy: apy,
    },
  });

  bitgoService.logTx('shield_create', { user: address, asset, depositAmount, exposureBudget, durationMonths });

  return shield;
}

async function settleShield(shieldId) {
  const shield = await Shield.findById(shieldId);
  if (!shield) throw new Error('Shield not found');
  if (shield.status !== 'active') throw new Error('Shield is not active');

  const priceData = priceEngine.getPrice(shield.asset);
  const closePrice = priceData ? priceData.price : shield.entryPrice;

  // Calculate exposure payout
  const priceChange = (closePrice - shield.entryPrice) / shield.entryPrice;
  const exposurePayout = Math.max(shield.exposureBudget * priceChange, -shield.exposureBudget);

  // Authorize settlement through BitGo custody
  bitgoService.authorizeTransaction({
    type: 'shield_settle',
    to: shield.user,
    value: shield.depositAmount,
    details: { shieldId, asset: shield.asset, closePrice, exposurePayout },
  });

  // Close linked position if exists
  if (shield.positionId) {
    try {
      await perpEngine.closePosition(shield.positionId);
    } catch (err) {
      console.warn('[YieldShield] Could not close linked position:', err.message);
    }
  }

  const yieldEarned = shield.depositAmount * (shield.yieldApy / 100) * (shield.durationMonths / 12);
  const totalReturn = shield.depositAmount + yieldEarned + exposurePayout;

  shield.status = 'settled';
  shield.settledAt = new Date();
  shield.closePrice = closePrice;
  shield.exposurePayout = +exposurePayout.toFixed(2);
  shield.totalReturn = +totalReturn.toFixed(2);
  await shield.save();

  // Credit user
  await User.findOneAndUpdate(
    { address: shield.user },
    {
      $inc: { traderBalance: totalReturn },
      $set: { lastActiveAt: new Date() },
    }
  );

  // Log transaction
  await Transaction.create({
    user: shield.user,
    type: 'shield_settle',
    amount: totalReturn,
    details: {
      shieldId: shield._id,
      closePrice,
      exposurePayout: +exposurePayout.toFixed(2),
      totalReturn: +totalReturn.toFixed(2),
    },
  });

  bitgoService.logTx('shield_settle', { user: shield.user, asset: shield.asset, closePrice, exposurePayout, totalReturn });

  return shield;
}

/**
 * Settle a shield ON-CHAIN on Mantle: the relayer calls
 * AegisVault.settleShield(user, idx, closePrice, exposurePayout).
 *
 * Reads price from the price engine, computes the exposure payout (clamped so
 * principal is never touched), scales to the contract's units, and submits the
 * relayer tx on Mantle. Then mirrors the off-chain settlement bookkeeping.
 *
 * @param {string} shieldId   mongoose Shield _id
 * @returns {Promise<{ shield, txHash, explorerUrl }>}
 */
async function settleShieldOnChainMantle(shieldId) {
  const mantle = require('../config/mantle');
  if (!mantle.vaultContract || !mantle.relayer) {
    throw new Error('Mantle vault/relayer not configured — cannot settle on-chain');
  }

  const shield = await Shield.findById(shieldId);
  if (!shield) throw new Error('Shield not found');
  if (shield.status !== 'active') throw new Error('Shield is not active');
  if (shield.onChainIdx == null) {
    throw new Error('Shield has no on-chain idx — cannot settle on-chain');
  }

  const priceData = priceEngine.getPrice(shield.asset);
  const closePrice = priceData && priceData.price ? priceData.price : shield.entryPrice;

  const priceChange = (closePrice - shield.entryPrice) / shield.entryPrice;
  const exposurePayout = Math.max(shield.exposureBudget * priceChange, -shield.exposureBudget);

  // Scale to contract units: closePrice -> 1e8 uint64; exposurePayout -> USDY 6dp int128.
  const closePriceScaled = BigInt(Math.max(Math.floor(closePrice * 1e8), 0));
  const exposurePayoutBase = BigInt(Math.trunc(exposurePayout * 1e6));

  const tx = await mantle.vaultContract.settleShield(
    shield.user,
    BigInt(shield.onChainIdx),
    closePriceScaled,
    exposurePayoutBase
  );
  const receipt = await tx.wait();
  const txHash = receipt?.hash || tx?.hash;
  const explorerUrl = txHash ? `${mantle.explorerBase}/tx/${txHash}` : null;

  // Mirror off-chain bookkeeping.
  const yieldEarned = shield.depositAmount * (shield.yieldApy / 100) * (shield.durationMonths / 12);
  const totalReturn = shield.depositAmount + yieldEarned + exposurePayout;

  shield.status = 'settled';
  shield.settledAt = new Date();
  shield.closePrice = closePrice;
  shield.exposurePayout = +exposurePayout.toFixed(2);
  shield.totalReturn = +totalReturn.toFixed(2);
  shield.onChainSettleTxHash = txHash || null;
  await shield.save();

  await User.findOneAndUpdate(
    { address: shield.user },
    { $inc: { traderBalance: totalReturn }, $set: { lastActiveAt: new Date() } }
  );

  await Transaction.create({
    user: shield.user,
    type: 'shield_settle',
    amount: totalReturn,
    details: { shieldId: shield._id, closePrice, exposurePayout: +exposurePayout.toFixed(2), totalReturn: +totalReturn.toFixed(2), onChainSettleTxHash: txHash, chain: 'mantle' },
  });

  bitgoService.logTx('shield_settle_mantle', { user: shield.user, asset: shield.asset, closePrice, exposurePayout, totalReturn, txHash });

  console.log(`[YieldShield] Mantle on-chain settle: ${txHash}`);
  return { shield, txHash, explorerUrl };
}

async function getActiveShields(address) {
  return Shield.find({ user: address.toLowerCase(), status: 'active' })
    .sort({ createdAt: -1 })
    .populate('positionId', 'currentPrice unrealizedPnl')
    .lean();
}

async function getShieldHistory(address) {
  return Shield.find({
    user: address.toLowerCase(),
    status: { $in: ['settled', 'cancelled'] },
  })
    .sort({ settledAt: -1 })
    .lean();
}

module.exports = {
  YIELD_SOURCES,
  getBestYield,
  getProjection,
  prepareShield,
  prepareShieldMantle,
  persistShield,
  createShield,
  settleShield,
  settleShieldOnChainMantle,
  getActiveShields,
  getShieldHistory,
};
