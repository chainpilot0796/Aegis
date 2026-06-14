const mongoose = require('mongoose');

const agentSessionKeySchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, lowercase: true, index: true },
  hashedKey:     { type: String, required: true, unique: true, index: true },
  keyPrefix:     { type: String, required: true },
  label:         { type: String, default: 'untitled' },
  scopes:        { type: [String], default: ['recommend', 'shield', 'read'] },
  createdAt:     { type: Date, default: Date.now },
  revokedAt:     { type: Date, default: null },
  lastUsedAt:    { type: Date, default: null },
});

module.exports = mongoose.model('AgentSessionKey', agentSessionKeySchema);
