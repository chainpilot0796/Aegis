const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema({
  marketId: { type: String, required: true, index: true },
  price: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now, index: true },
});

priceHistorySchema.index({ marketId: 1, timestamp: 1 });

module.exports = mongoose.model('PriceHistory', priceHistorySchema);
