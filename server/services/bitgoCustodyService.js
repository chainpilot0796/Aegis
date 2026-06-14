/**
 * BitGo Custodial Wallet Service
 * Uses the modular BitGo SDK (@bitgo/sdk-api + @bitgo/sdk-coin-eth) for wallet creation.
 * @see https://developers.bitgo.com/docs/get-started-sdk-install
 * @see https://developers.bitgo.com/docs/wallets-create-wallets
 */

const axios = require('axios');
const { BitGoAPI } = require('@bitgo/sdk-api');
const { register: registerEthCoins, Eth } = require('@bitgo/sdk-coin-eth');
const { keccak256, toHex } = require('viem');
const stableStringify = require('json-stringify-deterministic');

const BITGO_TEST_URL = 'https://app.bitgo-test.com';
const BITGO_COIN = process.env.BITGO_CUSTODY_COIN || 'tbaseeth';

/** Extract a clear error message from BitGo API/SDK or axios errors. */
function getBitGoErrorMessage(err) {
  // Connection errors to BitGo Express (no HTTP response at all)
  const topCode = err.code || err.cause?.code;
  if (topCode === 'ECONNREFUSED') {
    const host = process.env.BITGO_EXPRESS_HOST || 'http://localhost:3080';
    return `Cannot connect to BitGo Express at ${host}. Is BitGo Express running? See https://developers.bitgo.com/docs/get-started-bitgo-express`;
  }

  const body = err.response?.data;
  if (body && typeof body === 'object') {
    const parts = [];
    if (body.error) parts.push(String(body.error));
    if (body.message && body.message !== body.error) parts.push(String(body.message));
    if (body.name) parts.push(`(${body.name})`);
    if (parts.length) return parts.join(' ').trim();
  }
  if (err.response?.data && typeof err.response.data === 'string') {
    return err.response.data;
  }
  const status = err.response?.status;
  const statusText = err.response?.statusText;
  if (status) {
    const detail = body?.error || body?.message || statusText || '';
    return detail ? `HTTP ${status}: ${detail}` : `HTTP ${status}`;
  }
  return err.message || String(err);
}

let accessToken = null;
let enterpriseId = null;
let configured = false;
let bitgoInstance = null;

function init() {
  accessToken = process.env.BITGO_ACCESS_TOKEN;
  enterpriseId = process.env.BITGO_ENTERPRISE_ID;
  configured = !!(accessToken && accessToken !== 'YOUR_KEY_HERE' && enterpriseId);
  if (!configured) {
    console.warn('[BitGo Custody] BITGO_ACCESS_TOKEN and BITGO_ENTERPRISE_ID required for custodial wallets');
  }
  return configured;
}

function getBitGo() {
  if (!configured || !accessToken) return null;
  if (bitgoInstance) return bitgoInstance;
  try {
    const bitgo = new BitGoAPI({ accessToken, env: 'test' });
    registerEthCoins(bitgo);

    // Explicitly register hteth (Hoodi testnet) if available
    if (typeof bitgo.register === 'function' && Eth?.createInstance) {
      try {
        bitgo.register('hteth', Eth.createInstance);
      } catch {
        // ignore — may already be registered
      }
    }

    // Attempt to register tbaseeth (Base testnet) via @bitgo/sdk-coin-base if installed
    try {
      const { register: registerBaseCoins } = require('@bitgo/sdk-coin-base');
      registerBaseCoins(bitgo);
    } catch {
      // @bitgo/sdk-coin-base not installed — tbaseeth SDK path unavailable,
      // will fall back to BitGo Express REST for wallet ops.
    }

    bitgoInstance = bitgo;
    return bitgoInstance;
  } catch (err) {
    console.warn('[BitGo Custody] BitGo SDK init failed:', err.message);
    return null;
  }
}

function isConfigured() {
  return configured;
}

/**
 * Create a new wallet using BitGo SDK generateWallet() when coin is supported (e.g. teth, eth),
 * or REST API for tbaseeth (Base) since it may not be in @bitgo/sdk-coin-eth.
 * Requires BITGO_WALLET_PASSPHRASE in env for SDK path.
 */
async function createCustodialWallet(label) {
  if (!configured) {
    throw new Error('BitGo custody not configured (BITGO_ACCESS_TOKEN + BITGO_ENTERPRISE_ID)');
  }

  const walletLabel = label || `Aegis-${Date.now()}`;
  const passphrase = process.env.BITGO_WALLET_PASSPHRASE;

  const bitgo = getBitGo();
  const useSdk = !!bitgo && !!passphrase;

  if (useSdk) {
    try {
      const coin = bitgo.coin(BITGO_COIN);
      const newWallet = await coin.wallets().generateWallet({
        label: walletLabel,
        passphrase,
        enterprise: enterpriseId,
      });
      let result = extractWalletResult(newWallet);
      if (!result || !result.walletId) throw new Error('Invalid wallet response');
      if (!result.receiveAddress) {
        result.receiveAddress = await getWalletReceiveAddress(result.walletId);
      }
      if (!result.receiveAddress) {
        throw new Error('Wallet created but no receive address available yet');
      }
      return result;
    } catch (err) {
      if (
        err.message &&
        (err.message.includes('not supported') ||
          err.message.includes('not registered') ||
          err.message.includes('Unknown coin') ||
          err.message.includes('Unsupported'))
      ) {
        return createWalletViaRest(walletLabel, passphrase);
      }
      const msg = getBitGoErrorMessage(err);
      console.error('[BitGo Custody] SDK create wallet error:', err.response?.data || err.message || err);
      throw new Error(msg);
    }
  }

  if (passphrase) {
    return createWalletViaRest(walletLabel, passphrase);
  }
  throw new Error('BITGO_WALLET_PASSPHRASE is required to create wallets');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a BitGo v3 onchain multisig wallet for an agent (Hoodi testnet: hteth).
 *
 * Key rules:
 * - On hteth testnet, set walletVersion=3 in generateWallet().
 * - Do NOT force multisigType="onchain" on hteth (can cause key-type mismatch).
 * - Policy amounts MUST be in WEI (strings).
 * - userKeyPrv is returned ONCE and must be stored by caller immediately.
 *
 * Returns:
 *  - walletId, walletVersion, forwarderAddress, userKeyPrv (ONE TIME), policyHash
 */
async function createAgentWallet({
  label,
  passphrase,
  allowedRecipients,
  dailyLimitWei,
  isTestnet = true,
} = {}) {
  if (!configured) {
    throw new Error('BitGo custody not configured (BITGO_ACCESS_TOKEN + BITGO_ENTERPRISE_ID)');
  }

  const walletLabel = label || `Aegis-Agent-${Date.now()}`;
  const walletPassphrase = passphrase || process.env.BITGO_WALLET_PASSPHRASE;
  if (!walletPassphrase) {
    throw new Error('Wallet passphrase must be provided or BITGO_WALLET_PASSPHRASE must be set');
  }

  const bitgo = getBitGo();
  if (!bitgo) {
    throw new Error('BitGo SDK not available (check BITGO_ACCESS_TOKEN and SDK init)');
  }

  const coinId = isTestnet ? 'hteth' : 'eth';

  // Step 1: Generate wallet (walletVersion=3; do not pass multisigType on hteth)
  const result = await bitgo.coin(coinId).wallets().generateWallet({
    label: walletLabel,
    passphrase: walletPassphrase,
    enterprise: enterpriseId,
    walletVersion: 3,
  });

  const wallet = result.wallet;
  const walletId = wallet.id();

  // userKeychain.prv is ONLY available in this response — never again.
  const userKeyPrv = result.userKeychain?.prv || '';

  // Step 2: Wait for on-chain initialization
  let initialized = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    const w = await bitgo.coin(coinId).wallets().get({ id: walletId });
    const coinSpecific = w.coinSpecific?.() || {};
    if (!coinSpecific.pendingChainInitialization) {
      initialized = true;
      break;
    }
    await sleep(10_000);
  }
  if (!initialized) {
    throw new Error(
      `BitGo wallet ${walletId} initialization timed out after 5 minutes. ` +
        'Check that the enterprise gas tank has sufficient ETH on Hoodi testnet.'
    );
  }

  // Re-fetch wallet post-init
  const liveWallet = await bitgo.coin(coinId).wallets().get({ id: walletId });

  // Step 3: Set policy rules (optional; skip on testnet)
  if (!isTestnet) {
    if (allowedRecipients && allowedRecipients.length > 0) {
      await liveWallet.createPolicyRule({
        id: 'vcr-whitelist',
        type: 'whitelist',
        condition: { addresses: allowedRecipients },
        action: { type: 'deny' },
      });
    }

    if (dailyLimitWei) {
      await liveWallet.createPolicyRule({
        id: 'vcr-velocity',
        type: 'velocityLimit',
        condition: {
          amountString: String(dailyLimitWei), // MUST be in WEI
          timeWindow: 86400,
          groupBy: ['wallet'],
        },
        action: { type: 'getApproval' },
      });
    }
  }

  // Step 4: Create forwarder address
  const forwarderResult = await liveWallet.createAddress({ walletVersion: 3 });
  const forwarderAddress = forwarderResult?.address || forwarderResult?.id || '';

  // Step 5: Compute policy hash (deterministic stringify)
  const livePolicies = await getWalletPolicyInternal({ coinId, walletId, liveWallet });
  const policyJson = stableStringify(livePolicies || {});
  const policyHash = keccak256(toHex(policyJson));

  return {
    walletId,
    walletVersion: wallet?._wallet?.walletVersion || 3,
    forwarderAddress,
    userKeyPrv,
    policyHash,
    nativePoliciesSet: !isTestnet,
  };
}

async function getWalletPolicyInternal({ coinId, walletId, liveWallet }) {
  // Prefer SDK if present
  try {
    if (liveWallet && typeof liveWallet.getPolicies === 'function') {
      return await liveWallet.getPolicies();
    }
  } catch {
    // fall through
  }

  // Fallback to BitGo REST (cloud) endpoint
  try {
    const url = `${BITGO_TEST_URL}/api/v2/${coinId}/wallet/${walletId}/policy`;
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10000,
    });
    return data;
  } catch {
    return {};
  }
}

function computeBitGoPolicyHash(livePolicies) {
  return keccak256(toHex(stableStringify(livePolicies)));
}

function extractWalletResult(newWallet) {
  const wallet = newWallet.wallet || newWallet;
  const walletId = wallet.id;
  if (!walletId) return null;
  let receiveAddress = wallet.receiveAddress;
  if (receiveAddress && typeof receiveAddress === 'object') {
    receiveAddress = receiveAddress.address || receiveAddress.id;
  }
  if (!receiveAddress && wallet.addresses && wallet.addresses.length > 0) {
    receiveAddress = wallet.addresses[0].address || wallet.addresses[0];
  }
  return { walletId, receiveAddress: receiveAddress || null, wallet };
}

async function createWalletViaRest(label, passphrase) {
  // Wallet "generate" is only available on BitGo Express, not on the BitGo cloud server.
  const expressHost = process.env.BITGO_EXPRESS_HOST;
  if (!expressHost) {
    throw new Error(
      'Wallet creation for this network requires BitGo Express. Set BITGO_EXPRESS_HOST in .env (e.g. http://localhost:3080) and run BitGo Express. See: https://developers.bitgo.com/docs/get-started-bitgo-express'
    );
  }
  const baseUrl = expressHost.replace(/\/$/, '');
  const url = `${baseUrl}/api/v2/${BITGO_COIN}/wallet/generate`;
  const body = {
    label,
    passphrase: passphrase || undefined,
    enterprise: enterpriseId,
    walletVersion: 4,
  };
  if (!passphrase) {
    throw new Error('BITGO_WALLET_PASSPHRASE is required for wallet generation');
  }

  try {
    const { data } = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    });

    const wallet = data.wallet || data;
    const walletId = wallet.id;
    let receiveAddress = wallet.receiveAddress?.address || wallet.receiveAddress;
    if (!receiveAddress && wallet.addresses?.length > 0) {
      receiveAddress = wallet.addresses[0].address || wallet.addresses[0];
    }
    if (!receiveAddress && data.receiveAddress) {
      receiveAddress = typeof data.receiveAddress === 'string' ? data.receiveAddress : data.receiveAddress.address;
    }
    if (!receiveAddress) {
      receiveAddress = await getWalletReceiveAddress(walletId);
    }
    if (!receiveAddress) {
      throw new Error('Wallet created but no receive address available yet (EVM may need chain confirmation)');
    }
    return { walletId, receiveAddress, wallet: data.wallet || data };
  } catch (err) {
    const msg = getBitGoErrorMessage(err);
    console.error(
      '[BitGo Custody] REST create wallet error:',
      err.response?.status,
      err.response?.data || err.message || err
    );
    if (typeof msg === 'string' && (msg.includes('BitGo Express') || msg.includes('Express endpoint'))) {
      throw new Error(
        'BitGo Express is required for wallet generation. Set BITGO_EXPRESS_HOST (e.g. http://localhost:3080) and run BitGo Express. Docs: https://developers.bitgo.com/docs/get-started-bitgo-express'
      );
    }
    throw new Error(msg || 'BitGo create wallet failed');
  }
}

/**
 * Get the first receive address for a wallet (REST).
 */
async function getWalletReceiveAddress(walletId) {
  if (!configured) throw new Error('BitGo custody not configured');

  try {
    const walletUrl = `${BITGO_TEST_URL}/api/v2/${BITGO_COIN}/wallet/${walletId}`;
    const { data: wallet } = await axios.get(walletUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10000,
    });

    let address = wallet.receiveAddress?.address || wallet.receiveAddress;
    if (address) return typeof address === 'string' ? address : address.address;

    const addrUrl = `${BITGO_TEST_URL}/api/v2/${BITGO_COIN}/wallet/${walletId}/address`;
    const { data: addrRes } = await axios.post(
      addrUrl,
      { chain: 0 },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
    const created = addrRes.address || addrRes;
    return (created && (created.address || created)) || null;
  } catch (err) {
    const msg = err.response?.data?.error || err.message;
    throw new Error(`BitGo get address failed: ${msg}`);
  }
}

/**
 * Get wallet balance (for display / validation).
 */
async function getWalletBalance(walletId) {
  if (!configured) return null;
  try {
    const url = `${BITGO_TEST_URL}/api/v2/${BITGO_COIN}/wallet/${walletId}`;
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10000,
    });
    const bal = data.balanceString ?? data.balance ?? 0;
    return typeof bal === 'string' ? parseFloat(bal) || 0 : bal;
  } catch {
    return null;
  }
}

/**
 * Send an ERC-20 token (e.g. USDC) from a BitGo custodial wallet.
 *
 * IMPORTANT: This MUST go through BitGo Express (not the BitGo cloud URL).
 * The cloud endpoint cannot sign transactions — Express is required.
 * Set BITGO_EXPRESS_HOST in your .env (e.g. http://localhost:3080).
 *
 * @param {string} walletId              - BitGo wallet ID
 * @param {string} recipientAddress      - Destination address
 * @param {string} amountBaseUnits       - Amount in token base units (e.g. "300000000" for 300 USDC at 6 decimals)
 * @param {string} tokenContractAddress  - ERC-20 contract address
 * @returns {Promise<{ txHash: string, transferId: string } | null>}
 */
async function sendTokenFromWallet(walletId, recipientAddress, amountBaseUnits, tokenContractAddress) {
  if (!configured) {
    console.warn('[BitGo Custody] Not configured — cannot send tokens');
    return null;
  }

  const passphrase = process.env.BITGO_WALLET_PASSPHRASE;
  if (!passphrase) {
    console.warn('[BitGo Custody] BITGO_WALLET_PASSPHRASE required to send tokens');
    return null;
  }

  // sendmany REQUIRES BitGo Express for transaction signing.
  // The cloud endpoint (app.bitgo-test.com) does NOT support signing and will
  // return "Coin or token type X not supported" or similar errors.
  const expressHost = process.env.BITGO_EXPRESS_HOST;
  if (!expressHost) {
    console.error(
      '[BitGo Custody] BITGO_EXPRESS_HOST is required for sendTokenFromWallet. ' +
        'Set it to your running BitGo Express instance (e.g. http://localhost:3080). ' +
        'See: https://developers.bitgo.com/docs/get-started-bitgo-express'
    );
    return null;
  }

  const baseUrl = expressHost.replace(/\/$/, '');
  const url = `${baseUrl}/api/v2/${BITGO_COIN}/wallet/${walletId}/sendmany`;

  const body = {
    recipients: [
      {
        amount: String(amountBaseUnits),
        address: recipientAddress,
      },
    ],
    walletPassphrase: passphrase,
    tokenContractAddress,
  };

  const doSend = async (baseUrl) => {
    const sendUrl = `${baseUrl}/api/v2/${BITGO_COIN}/wallet/${walletId}/sendmany`;
    const { data } = await axios.post(sendUrl, body, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
    return data;
  };

  try {
    const data = await doSend(baseUrl);
    const txHash = data.txid || data.txHash || data.hash || null;
    const transferId = data.transfer?.id || data.id || null;

    console.log(
      `[BitGo Custody] Token send success: walletId=${walletId}, txHash=${txHash}, amount=${amountBaseUnits}`
    );

    return { txHash, transferId, data };
  } catch (err) {
    const msg = getBitGoErrorMessage(err);
    console.error('[BitGo Custody] sendTokenFromWallet error:', msg);

    // When Express returns "not supported" (e.g. tbaseeth not compiled in Express),
    // try BitGo cloud — some coins are supported by cloud but not in open-source Express.
    const isUnsupported =
      typeof msg === 'string' &&
      (msg.includes('not supported') || msg.includes('not compiled') || msg.includes('not registered'));

    if (isUnsupported && BITGO_COIN === 'tbaseeth') {
      console.log('[BitGo Custody] Express lacks tbaseeth — trying BitGo cloud API as fallback');
      try {
        const data = await doSend(BITGO_TEST_URL.replace(/\/$/, ''));
        const txHash = data.txid || data.txHash || data.hash || null;
        const transferId = data.transfer?.id || data.id || null;
        console.log(
          `[BitGo Custody] Token send via cloud success: walletId=${walletId}, txHash=${txHash}`
        );
        return { txHash, transferId, data };
      } catch (cloudErr) {
        const cloudMsg = getBitGoErrorMessage(cloudErr);
        console.error('[BitGo Custody] Cloud fallback also failed:', cloudMsg);
      }
    }

    // Provide actionable guidance for the most common failure modes
    if (typeof msg === 'string') {
      if (isUnsupported) {
        console.error(
          '[BitGo Custody] Hint: Your BitGo Express version may not support ' +
            `"${BITGO_COIN}". Try: docker pull bitgo/express:latest and run with --env test. ` +
            'For tbaseeth, BitGo cloud was tried as fallback (see logs above).'
        );
      }
      if (msg.includes('ECONNREFUSED')) {
        console.error(
          `[BitGo Custody] Hint: Cannot reach BitGo Express at ${expressHost}. ` +
            'Is the container running? Check with: docker ps'
        );
      }
    }

    return null;
  }
}

function getInfo() {
  return {
    configured,
    coin: BITGO_COIN,
    enterpriseId: enterpriseId ? `${enterpriseId.slice(0, 8)}...` : null,
    sdk: !!getBitGo(),
  };
}

module.exports = {
  init: () => init(),
  isConfigured,
  createCustodialWallet,
  createAgentWallet,
  getWalletReceiveAddress,
  getWalletBalance,
  sendTokenFromWallet,
  getInfo,
  computeBitGoPolicyHash,
};