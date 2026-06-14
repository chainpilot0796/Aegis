const mongoose = require('mongoose');

const marketSchema = new mongoose.Schema({
  marketId: { type: String, required: true, unique: true },
  name: { type: String },
  category: { type: String },
  emoji: { type: String },
  source: { type: String },
  price: { type: Number, default: 0 },
  change24h: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
  high24h: { type: Number, default: 0 },
  low24h: { type: Number, default: 0 },
});

module.exports = mongoose.model('Market', marketSchema);
