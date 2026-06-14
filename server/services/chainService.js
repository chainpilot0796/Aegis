const User = require('../models/User');
const bitgoService = require('./bitgoService');

let lastBlock = 0;
let pollInterval = null;

async function init(vaultContract) {
  if (!vaultContract) {
    console.warn('[ChainService] No vault contract — skipping event polling');
    return;
  }

  try {
    const provider = vaultContract.runner?.provider || vaultContract.provider;
    if (provider) {
      lastBlock = await provider.getBlockNumber();
    }
  } catch (err) {
    console.warn('[ChainService] Could not get initial block number:', err.message);
    lastBlock = 0;
  }

  pollInterval = setInterval(() => pollEvents(vaultContract), 5000);
  console.log('[ChainService] Event polling started');
}

async function pollEvents(vaultContract) {
  try {
    const provider = vaultContract.runner?.provider || vaultContract.provider;
    const currentBlock = await provider.getBlockNumber();

    if (currentBlock <= lastBlock) return;

    // TraderDeposit events
    const depositEvents = await vaultContract.queryFilter('TraderDeposit', lastBlock + 1, currentBlock);
    for (const event of depositEvents) {
      const userAddr = event.args[0].toLowerCase();
      const amount = Number(event.args[1]) / 1e6; // USDC 6 decimals
      await User.findOneAndUpdate(
        { address: userAddr },
        {
          $inc: { traderBalance: amount, totalDeposited: amount },
          $set: { lastActiveAt: new Date() },
        },
        { upsert: true }
      );
      console.log(`[ChainService] TraderDeposit: ${userAddr} +${amount}`);
      bitgoService.logTx('onchain_deposit', { txHash: event.transactionHash, user: userAddr, amount });
    }

    // LpDeposit events
    const lpEvents = await vaultContract.queryFilter('LpDeposit', lastBlock + 1, currentBlock);
    for (const event of lpEvents) {
      const userAddr = event.args[0].toLowerCase();
      const amount = Number(event.args[1]) / 1e6;
      await User.findOneAndUpdate(
        { address: userAddr },
        {
          $inc: { lpBalance: amount, totalDeposited: amount },
          $set: { lastActiveAt: new Date() },
        },
        { upsert: true }
      );
      console.log(`[ChainService] LpDeposit: ${userAddr} +${amount}`);
      bitgoService.logTx('onchain_lp_deposit', { txHash: event.transactionHash, user: userAddr, amount });
    }

    // TraderWithdraw events
    const withdrawEvents = await vaultContract.queryFilter('TraderWithdraw', lastBlock + 1, currentBlock);
    for (const event of withdrawEvents) {
      const userAddr = event.args[0].toLowerCase();
      const amount = Number(event.args[1]) / 1e6;
      await User.findOneAndUpdate(
        { address: userAddr },
        {
          $inc: { traderBalance: -amount, totalWithdrawn: amount },
          $set: { lastActiveAt: new Date() },
        },
        { upsert: true }
      );
      console.log(`[ChainService] TraderWithdraw: ${userAddr} -${amount}`);
      bitgoService.logTx('onchain_withdraw', { txHash: event.transactionHash, user: userAddr, amount });
    }

    // PnlSettled events
    const pnlEvents = await vaultContract.queryFilter('PnlSettled', lastBlock + 1, currentBlock);
    for (const event of pnlEvents) {
      const userAddr = event.args[0].toLowerCase();
      const pnl = Number(event.args[1]) / 1e6;
      await User.findOneAndUpdate(
        { address: userAddr },
        {
          $inc: { traderBalance: pnl, totalPnl: pnl },
          $set: { lastActiveAt: new Date() },
        },
        { upsert: true }
      );
      console.log(`[ChainService] PnlSettled: ${userAddr} ${pnl >= 0 ? '+' : ''}${pnl}`);
      bitgoService.logTx('onchain_pnl_settled', { txHash: event.transactionHash, user: userAddr, pnl });
    }

    lastBlock = currentBlock;
  } catch (error) {
    console.error('[ChainService] Error polling events:', error.message);
  }
}

function stop() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

module.exports = { init, stop };
