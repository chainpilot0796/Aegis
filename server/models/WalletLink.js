const mongoose = require('mongoose');

const walletLinkSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true, index: true },
  address: { type: String, required: true, lowercase: true, index: true },
  createdAt: { type: Date, default: Date.now },
  lastUsedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('WalletLink', walletLinkSchema);
