/**
 * On-Chain Settlement Service
 * Sends USDC from the user's BitGo custodial wallet when trades open/close.
 * For Base Sepolia (tbaseeth), BitGo Express may not support the coin — use
 * BITGO_RELAYER_FALLBACK_TESTNET=true to fall back to relayer-signed transfers.
 * Returns transaction hashes for user verification on basescan.
 */

const bitgoCustodyService = require('./bitgoCustodyService');
const CustodialWallet = require('../models/CustodialWallet');
const { relayer, husdcContract } = require('../config/blockchain');

const EXPLORER_BASE = 'https://sepolia.basescan.org';
const USDC_DECIMALS = 6;
const USDC_CONTRACT = process.env.USDC_ADDRESS || '0x17b9526493820c6eb04988433b9220b06e210a3e';

// Vault/treasury address — receives margin on trade open
const VAULT_ADDRESS = (process.env.VAULT_CONTRACT_ADDRESS || '').toLowerCase();

// When BitGo lacks tbaseeth support, allow relayer to settle on-chain (testnet only)
const RELAYER_FALLBACK =
  process.env.BITGO_RELAYER_FALLBACK_TESTNET === 'true' &&
  (process.env.BITGO_CUSTODY_COIN || 'tbaseeth') === 'tbaseeth';

/**
 * Check if settlement is available (BitGo configured + vault address set).
 */
function isAvailable() {
  return bitgoCustodyService.isConfigured() && !!VAULT_ADDRESS;
}

/**
 * Send USDC from a user's BitGo custodial wallet to a recipient.
 * Uses BitGo's sendmany REST API — this is the ONLY transfer path.
 * @param {string} userAddress - The user's custodial receive address
 * @param {string} toAddress - Recipient address
 * @param {number} amountUsdc - Amount in human-readable USDC (e.g. 300)
 * @returns {Promise<{ txHash: string, explorerUrl: string } | null>}
 */
async function sendUsdcFromWallet(userAddress, toAddress, amountUsdc) {
  if (!bitgoCustodyService.isConfigured()) {
    console.warn('[OnChainSettlement] BitGo not configured — cannot send');
    return null;
  }

  // Look up BitGo wallet ID from the custodial wallet record
  const custodialWallet = await CustodialWallet.findOne({
    receiveAddress: userAddress.toLowerCase(),
  }).lean();

  if (!custodialWallet?.bitgoWalletId) {
    console.error('[OnChainSettlement] No BitGo wallet found for address:', userAddress);
    return null;
  }

  // Convert to base units (USDC has 6 decimals)
  const amountBaseUnits = Math.floor(amountUsdc * 10 ** USDC_DECIMALS).toString();

  let result = await bitgoCustodyService.sendTokenFromWallet(
    custodialWallet.bitgoWalletId,
    toAddress,
    amountBaseUnits,
    USDC_CONTRACT
  );

  // When BitGo lacks tbaseeth support, use relayer to send USDC to vault (testnet demo only)
  if (!result?.txHash && RELAYER_FALLBACK && relayer && husdcContract && VAULT_ADDRESS && toAddress.toLowerCase() === VAULT_ADDRESS) {
    try {
      const tx = await husdcContract.transfer(toAddress, amountBaseUnits);
      const receipt = await tx.wait();
      const txHash = receipt?.hash || tx?.hash;
      if (txHash) {
        console.log(`[OnChainSettlement] Relayer fallback: ${txHash} (${amountUsdc} USDC from relayer → vault)`);
        return { txHash, explorerUrl: `${EXPLORER_BASE}/tx/${txHash}` };
      }
    } catch (relayerErr) {
      console.warn('[OnChainSettlement] Relayer fallback failed:', relayerErr?.message || relayerErr);
    }
  }

  if (!result?.txHash) {
    console.error('[OnChainSettlement] BitGo send returned no txHash');
    return null;
  }

  console.log(
    `[OnChainSettlement] USDC sent: ${result.txHash} (${amountUsdc} USDC from ${userAddress.slice(0, 8)}... → ${toAddress.slice(0, 8)}...)`
  );

  return {
    txHash: result.txHash,
    explorerUrl: `${EXPLORER_BASE}/tx/${result.txHash}`,
  };
}

/**
 * Settle a trade open on-chain.
 * Sends the full margin USDC from the user's BitGo custodial wallet to the vault.
 * @param {object} opts
 * @param {string} opts.userAddress
 * @param {number} opts.margin - Margin amount in USDC
 * @param {string} opts.marketId
 * @param {string} opts.direction - LONG or SHORT
 * @returns {Promise<{ txHash: string, explorerUrl: string } | null>}
 */
async function settleTradeOpen({ userAddress, margin, marketId, direction }) {
  if (!VAULT_ADDRESS) {
    console.warn('[OnChainSettlement] No vault address configured');
    return null;
  }

  // Send the full margin amount from the user's BitGo wallet to the vault
  return sendUsdcFromWallet(userAddress, VAULT_ADDRESS, margin);
}

/**
 * Settle a trade close on-chain.
 * Sends margin + PnL back to user's BitGo wallet from the vault.
 * Note: The vault wallet also needs to be a BitGo wallet for this to work.
 * If the vault is not a BitGo wallet, the close settlement is recorded off-chain.
 * @param {object} opts
 * @param {string} opts.userAddress
 * @param {number} opts.realizedPnl
 * @param {number} opts.margin
 * @returns {Promise<{ txHash: string, explorerUrl: string } | null>}
 */
async function settleTradeClose({ userAddress, realizedPnl, margin }) {
  const returnAmount = Math.max(margin + (realizedPnl || 0), 0);
  if (returnAmount <= 0) return null;

  // For close, we need to send from vault back to user.
  // If vault is also a BitGo wallet, look it up and send.
  // Otherwise this is handled off-chain via User.traderBalance.
  const vaultWallet = await CustodialWallet.findOne({
    receiveAddress: VAULT_ADDRESS,
  }).lean();

  if (!vaultWallet?.bitgoWalletId) {
    console.log('[OnChainSettlement] Vault is not a BitGo wallet — close settlement recorded off-chain');
    return null;
  }

  const amountBaseUnits = Math.floor(returnAmount * 10 ** USDC_DECIMALS).toString();

  const result = await bitgoCustodyService.sendTokenFromWallet(
    vaultWallet.bitgoWalletId,
    userAddress,
    amountBaseUnits,
    USDC_CONTRACT
  );

  if (!result?.txHash) {
    console.warn('[OnChainSettlement] Vault send returned no txHash');
    return null;
  }

  return {
    txHash: result.txHash,
    explorerUrl: `${EXPLORER_BASE}/tx/${result.txHash}`,
  };
}

/**
 * Get explorer URL for a tx hash.
 */
function explorerTxUrl(txHash) {
  return txHash ? `${EXPLORER_BASE}/tx/${txHash}` : '';
}

function explorerAddressUrl(address) {
  return address ? `${EXPLORER_BASE}/address/${address}` : '';
}

module.exports = {
  isAvailable,
  sendUsdcFromWallet,
  settleTradeOpen,
  settleTradeClose,
  explorerTxUrl,
  explorerAddressUrl,
};
