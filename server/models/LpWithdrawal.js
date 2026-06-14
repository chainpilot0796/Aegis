const mongoose = require('mongoose');

const lpWithdrawalSchema = new mongoose.Schema({
  user: { type: String, required: true, lowercase: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'processed'], default: 'pending' },
  requestedAt: { type: Date, default: Date.now },
  processedAt: { type: Date, default: null },
});

module.exports = mongoose.model('LpWithdrawal', lpWithdrawalSchema);
