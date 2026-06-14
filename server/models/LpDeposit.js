const mongoose = require('mongoose');

const lpDepositSchema = new mongoose.Schema({
  user: { type: String, required: true, lowercase: true },
  amount: { type: Number, required: true },
  txHash: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('LpDeposit', lpDepositSchema);
