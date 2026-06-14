/**
 * HeyElsa x402 API Client
 * Pay-per-request DeFi APIs: portfolio, analyze_wallet, yield suggestions, swap, perp.
 * Uses x402 micropayments on Base. Requires PAYMENT_PRIVATE_KEY with USDC balance.
 * @see https://x402.heyelsa.ai/ https://x402.heyelsa.ai/docs
 */

const axios = require('axios');
const { createWalletClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { base } = require('viem/chains');

const ELSA_API_URL = process.env.HEYELSA_API_URL || 'https://x402-api.heyelsa.ai';
const BASE_RPC = process.env.BASE_MAINNET_RPC || 'https://mainnet.base.org';

let elsaClient = null;
let isInitialized = false;

function isConfigured() {
  return !!process.env.HEYELSA_PAYMENT_PRIVATE_KEY;
}

async function init() {
  if (!isConfigured()) {
    console.log('[HeyElsa] PAYMENT_PRIVATE_KEY not set — x402 APIs disabled (local-only mode)');
    return;
  }

  try {
    const { withPaymentInterceptor } = require('x402-axios');
    const pk = (process.env.HEYELSA_PAYMENT_PRIVATE_KEY || '').trim();
    const hexKey = pk.startsWith('0x') ? pk : `0x${pk}`;
    const account = privateKeyToAccount(hexKey);
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(BASE_RPC),
    });

    elsaClient = withPaymentInterceptor(
      axios.create({
        baseURL: ELSA_API_URL,
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      }),
      walletClient
    );

    isInitialized = true;
    console.log('[HeyElsa] x402 client initialized');
  } catch (err) {
    console.error('[HeyElsa] Init failed:', err.message);
  }
}

async function call(endpoint, payload = {}) {
  if (!isInitialized || !elsaClient) {
    return { ok: false, error: 'HeyElsa x402 not configured' };
  }

  try {
    const res = await elsaClient.post(`/api/${endpoint}`, payload);
    return { ok: true, data: res.data };
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    return { ok: false, error: msg };
  }
}

async function getPortfolio(walletAddress) {
  return call('get_portfolio', { wallet_address: walletAddress });
}

async function getBalances(walletAddress) {
  return call('get_balances', { wallet_address: walletAddress });
}

async function analyzeWallet(walletAddress) {
  return call('analyze_wallet', { wallet_address: walletAddress });
}

async function getYieldSuggestions(walletAddress) {
  return call('get_yield_suggestions', { wallet_address: walletAddress });
}

async function getPnlReport(walletAddress, timePeriod = '30_days') {
  return call('get_pnl_report', { wallet_address: walletAddress, time_period: timePeriod });
}

async function getTokenPrice(tokenAddress, chain = 'base') {
  return call('get_token_price', { token_address: tokenAddress, chain });
}

async function searchToken(symbolOrAddress, limit = 5) {
  return call('search_token', { symbol_or_address: symbolOrAddress, limit });
}

async function getSwapQuote(params) {
  return call('get_swap_quote', params);
}

async function executeSwap(params) {
  return call('execute_swap', params);
}

async function getTransactionStatus(pipelineId) {
  return call('get_transaction_status', { pipeline_id: pipelineId });
}

async function submitTransactionHash(taskId, txHash, status = 'submitted') {
  return call('submit_transaction_hash', { task_id: taskId, tx_hash: txHash, status });
}

function getInfo() {
  return {
    configured: isConfigured(),
    initialized: isInitialized,
    apiUrl: ELSA_API_URL,
  };
}

module.exports = {
  init,
  isConfigured,
  isInitialized: () => isInitialized,
  getInfo,
  getPortfolio,
  getBalances,
  analyzeWallet,
  getYieldSuggestions,
  getPnlReport,
  getTokenPrice,
  searchToken,
  getSwapQuote,
  executeSwap,
  getTransactionStatus,
  submitTransactionHash,
  call,
};
