const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  address: { type: String, required: true, unique: true, index: true, lowercase: true },
  traderBalance: { type: Number, default: 0 },
  lpBalance: { type: Number, default: 0 },
  totalDeposited: { type: Number, default: 0 },
  totalWithdrawn: { type: Number, default: 0 },
  totalPnl: { type: Number, default: 0 },
  shieldCount: { type: Number, default: 0 },
  tradeCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  lastActiveAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', userSchema);
