const mongoose = require('mongoose');

const shieldSchema = new mongoose.Schema({
  user: { type: String, required: true, index: true, lowercase: true },
  depositAmount: { type: Number, required: true },
  asset: { type: String, required: true },
  assetName: { type: String, required: true },
  durationMonths: { type: Number, required: true },
  yieldSource: { type: String },
  yieldApy: { type: Number },
  exposureBudget: { type: Number, default: 0 },
  entryPrice: { type: Number },
  positionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Position', default: null },
  status: { type: String, enum: ['active', 'settled', 'cancelled'], default: 'active', index: true },
  settleAt: { type: Date },
  closePrice: { type: Number, default: null },
  exposurePayout: { type: Number, default: null },
  totalReturn: { type: Number, default: null },
  ensSubname: { type: String, default: null },

  // Legacy storage (Fileverse / content hash) — kept for back-compat with old records
  fileverseDocHash: { type: String, default: null },

  // Storage — canonical going forward (0G legacy + Mantle/Pinata)
  storageProvider: { type: String, enum: ['zerog', 'fileverse', 'pinata', 'hash', null], default: null },
  storageRootHash: { type: String, default: null, index: true },
  storageTxHash: { type: String, default: null },
  storageCid: { type: String, default: null },   // IPFS CID (Pinata)
  storageUri: { type: String, default: null },    // IPFS gateway URI

  // Mantle auditable envelope — AI advisor recommendation + risk params + compliance
  envelopeRootHash: { type: String, default: null, index: true },
  recommendation: { type: mongoose.Schema.Types.Mixed, default: null },
  riskParams: { type: mongoose.Schema.Types.Mixed, default: null },
  compliance: { type: mongoose.Schema.Types.Mixed, default: null },
  chain: { type: String, default: null }, // 'mantle' | '0g' | null

  // AI inference metadata for the recommendation that produced this shield
  teeInferenceProvider: { type: String, default: null },
  teeInferenceSignature: { type: String, default: null },
  teeInferenceVerified: { type: Boolean, default: false },
  teeInferenceModel: { type: String, default: null },

  // On-chain shield index returned by AegisVault.createShield
  onChainIdx: { type: Number, default: null },
  onChainTxHash: { type: String, default: null },
  onChainSettleTxHash: { type: String, default: null },

  createdAt: { type: Date, default: Date.now },
  settledAt: { type: Date, default: null },
});

module.exports = mongoose.model('Shield', shieldSchema);
