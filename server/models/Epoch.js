const mongoose = require('mongoose');

const epochSchema = new mongoose.Schema({
  epochNumber: { type: Number, required: true, unique: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  totalVolume: { type: Number, default: 0 },
  totalFees: { type: Number, default: 0 },
  totalPnl: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
});

module.exports = mongoose.model('Epoch', epochSchema);
