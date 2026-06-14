const mongoose = require('mongoose');

const agentActionSchema = new mongoose.Schema({
  sessionKeyId:   { type: mongoose.Schema.Types.ObjectId, ref: 'AgentSessionKey', index: true },
  walletAddress:  { type: String, required: true, lowercase: true, index: true },

  // Self-reported metadata via X-Agent-* headers — UNVERIFIED.
  agentSlug:  { type: String, default: null, index: true },
  agentModel: { type: String, default: null },
  agentName:  { type: String, default: null },

  action: { type: String, required: true, index: true },  // recommend | prepare | activate | simulate | doc-fetch | …
  asset:  { type: String, default: null, index: true },
  params: { type: mongoose.Schema.Types.Mixed, default: null },
  result: { type: mongoose.Schema.Types.Mixed, default: null },

  // Populated as the lifecycle progresses
  invested:      { type: Number, default: 0 },
  currentValue:  { type: Number, default: 0 },
  realizedPnl:   { type: Number, default: 0 },
  onChainTxHash: { type: String, default: null },
  storageRootHash: { type: String, default: null },

  status: { type: String, enum: ['ok', 'error', 'pending'], default: 'ok' },
  errorMessage: { type: String, default: null },

  createdAt: { type: Date, default: Date.now, index: true },
});

agentActionSchema.index({ walletAddress: 1, asset: 1, createdAt: -1 });

module.exports = mongoose.model('AgentAction', agentActionSchema);
