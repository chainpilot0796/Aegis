const mongoose = require('mongoose');

const vaultSchema = new mongoose.Schema({
  totalTraderDeposits: { type: Number, default: 0 },
  totalLpDeposits: { type: Number, default: 0 },
  totalFeesCollected: { type: Number, default: 0 },
  utilizationRate: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});

// Single document pattern — always use findOne()
module.exports = mongoose.model('Vault', vaultSchema);
