/**
 * USDC Balance Sync Service
 * Polls Base Sepolia USDC balances for all custodial wallets.
 * Auto-detects deposits and credits User.traderBalance.
 */

const CustodialWallet = require('../models/CustodialWallet');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { husdcContract } = require('../config/blockchain');
const bitgoService = require('./bitgoService');

const POLL_INTERVAL_MS = 15_000; // 15 seconds
const USDC_DECIMALS = 6;

let pollTimer = null;
let isPolling = false;

/**
 * Get on-chain USDC balance for an address (Base Sepolia).
 * @param {string} address
 * @returns {Promise<number>} balance in human-readable USDC (e.g. 100.5)
 */
async function getUsdcBalance(address) {
  if (!husdcContract) return 0;
  try {
    const raw = await husdcContract.balanceOf(address);
    return Number(raw) / 10 ** USDC_DECIMALS;
  } catch (err) {
    console.warn('[USDCBalanceSync] balanceOf failed for', address, err.message);
    return 0;
  }
}

/**
 * Sync balances for all custodial wallets.
 * Detects new deposits by comparing on-chain balance vs lastSyncedBalance.
 */
async function syncAll() {
  if (isPolling) return; // prevent overlapping polls
  isPolling = true;

  try {
    const wallets = await CustodialWallet.find({}).lean();
    if (!wallets.length) return;

    for (const w of wallets) {
      try {
        const addr = w.receiveAddress;
        if (!addr) continue;

        const onChainBalance = await getUsdcBalance(addr);
        const lastSynced = w.lastSyncedBalance || 0;
        const depositAmount = onChainBalance - lastSynced;

        if (depositAmount > 0.001) {
          // New deposit detected — credit user
          await User.findOneAndUpdate(
            { address: addr },
            {
              $inc: { traderBalance: depositAmount, totalDeposited: depositAmount },
              $set: { lastActiveAt: new Date() },
            },
            { upsert: true }
          );

          // Log transaction
          await Transaction.create({
            user: addr,
            type: 'deposit',
            amount: depositAmount,
            details: {
              source: 'usdc_base_sepolia',
              previousBalance: lastSynced,
              newBalance: onChainBalance,
            },
          });

          // Audit log
          bitgoService.logTx('usdc_deposit_detected', {
            user: addr,
            amount: depositAmount,
            onChainBalance,
          });

          console.log(
            `[USDCBalanceSync] Deposit detected: ${addr.slice(0, 8)}... +$${depositAmount.toFixed(2)} USDC (total: $${onChainBalance.toFixed(2)})`
          );
        }

        // Update synced balance
        await CustodialWallet.updateOne(
          { _id: w._id },
          { $set: { lastSyncedBalance: onChainBalance, lastUsedAt: new Date() } }
        );
      } catch (err) {
        console.warn('[USDCBalanceSync] Error syncing wallet', w.receiveAddress, err.message);
      }
    }
  } catch (err) {
    console.error('[USDCBalanceSync] syncAll error:', err.message);
  } finally {
    isPolling = false;
  }
}

/**
 * Start periodic balance polling.
 */
function start() {
  if (!husdcContract) {
    console.warn('[USDCBalanceSync] USDC contract not available — balance sync disabled');
    return;
  }
  console.log('[USDCBalanceSync] Starting USDC deposit detection (every 15s)');
  // Initial sync after 5s delay
  setTimeout(() => syncAll(), 5000);
  pollTimer = setInterval(() => syncAll(), POLL_INTERVAL_MS);
}

/**
 * Stop polling.
 */
function stop() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

module.exports = {
  start,
  stop,
  syncAll,
  getUsdcBalance,
};
