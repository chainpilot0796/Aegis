const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema({
  user: { type: String, required: true, index: true, lowercase: true },
  marketId: { type: String, required: true },
  direction: { type: String, enum: ['LONG', 'SHORT'], required: true },
  margin: { type: Number, required: true },
  leverage: { type: Number, required: true },
  size: { type: Number, required: true },
  entryPrice: { type: Number, required: true },
  currentPrice: { type: Number, default: 0 },
  unrealizedPnl: { type: Number, default: 0 },
  takeProfitPrice: { type: Number, default: null },
  stopLossPrice: { type: Number, default: null },
  borrowFees: { type: Number, default: 0 },
  status: { type: String, enum: ['open', 'closed', 'liquidated'], default: 'open', index: true },
  openedAt: { type: Date, default: Date.now },
  closedAt: { type: Date, default: null },
  closePrice: { type: Number, default: null },
  realizedPnl: { type: Number, default: null },
});

module.exports = mongoose.model('Position', positionSchema);
