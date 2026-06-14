const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: { type: String, required: true, lowercase: true },
  type: {
    type: String,
    enum: [
      'deposit',
      'withdraw',
      'trade_open',
      'trade_close',
      'shield_create',
      'shield_settle',
      'lp_deposit',
      'lp_withdraw',
    ],
    required: true,
  },
  amount: { type: Number, required: true },
  txHash: { type: String, default: null },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Transaction', transactionSchema);
