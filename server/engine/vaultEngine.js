const Vault = require('../models/Vault');
const User = require('../models/User');
const LpDeposit = require('../models/LpDeposit');
const LpWithdrawal = require('../models/LpWithdrawal');
const Transaction = require('../models/Transaction');

async function getVaultStats() {
  try {
    // Always compute fresh from User collection
    const [traderAgg, lpAgg] = await Promise.all([
      User.aggregate([{ $group: { _id: null, total: { $sum: '$traderBalance' } } }]),
      User.aggregate([{ $group: { _id: null, total: { $sum: '$lpBalance' } } }]),
    ]);

    const totalTraderDeposits = traderAgg.length > 0 ? traderAgg[0].total : 0;
    const totalLpDeposits = lpAgg.length > 0 ? lpAgg[0].total : 0;

    // Read fees from vault doc if it exists
    const vault = await Vault.findOne();
    const totalFeesCollected = vault?.totalFeesCollected || 0;

    const totalPool = totalTraderDeposits + totalLpDeposits;
    const utilizationRate = totalPool > 0 ? (totalTraderDeposits / totalPool) * 100 : 0;

    return {
      totalTraderDeposits: +totalTraderDeposits.toFixed(2),
      totalLpDeposits: +totalLpDeposits.toFixed(2),
      totalFeesCollected: +totalFeesCollected.toFixed(2),
      utilizationRate: +utilizationRate.toFixed(2),
    };
  } catch (error) {
    console.error('[VaultEngine] Error getting stats:', error.message);
    return {
      totalTraderDeposits: 0,
      totalLpDeposits: 0,
      totalFeesCollected: 0,
      utilizationRate: 0,
    };
  }
}

async function processLpDeposit({ address, amount, txHash }) {
  await LpDeposit.create({
    user: address.toLowerCase(),
    amount,
    txHash,
  });

  await Transaction.create({
    user: address.toLowerCase(),
    type: 'lp_deposit',
    amount,
    txHash,
  });

  return { success: true, amount };
}

async function processLpWithdrawal({ address, amount }) {
  const user = await User.findOne({ address: address.toLowerCase() });
  if (!user || user.lpBalance < amount) {
    throw new Error('Insufficient LP balance');
  }

  const withdrawal = await LpWithdrawal.create({
    user: address.toLowerCase(),
    amount,
  });

  await Transaction.create({
    user: address.toLowerCase(),
    type: 'lp_withdraw',
    amount,
  });

  return { success: true, withdrawalId: withdrawal._id, status: 'pending' };
}

module.exports = {
  getVaultStats,
  processLpDeposit,
  processLpWithdrawal,
};
