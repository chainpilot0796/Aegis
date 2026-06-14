const mongoose = require('mongoose');

const custodialWalletSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true, index: true },
  bitgoWalletId: { type: String, required: true, index: true },
  coin: { type: String, default: 'tbaseeth' },
  // Deposit address the user sends funds to (BitGo forwarder address for agent wallets)
  receiveAddress: { type: String, required: true, lowercase: true, index: true },
  // Optional: for agent wallets created via BitGo v3 on hteth
  forwarderAddress: { type: String, lowercase: true },
  walletVersion: { type: Number },
  policyHash: { type: String },
  nativePoliciesSet: { type: Boolean },
  lastSyncedBalance: { type: Number, default: 0 },
  label: { type: String },
  createdAt: { type: Date, default: Date.now },
  lastUsedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('CustodialWallet', custodialWalletSchema);
