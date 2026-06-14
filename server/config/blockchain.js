const { ethers } = require('ethers');

let provider = null;
let relayer = null;
let vaultContract = null;
let husdcContract = null;

// USDC on Base Sepolia (0x17b9526493820c6eb04988433b9220b06e210a3e)
const USDC_BASE_SEPOLIA = '0x17b9526493820c6eb04988433b9220b06e210a3e';

const VAULT_ABI = [
  'event TraderDeposit(address indexed user, uint256 amount)',
  'event LpDeposit(address indexed user, uint256 amount)',
  'event TraderWithdraw(address indexed user, uint256 amount)',
  'event PnlSettled(address indexed user, int256 pnl)',
  'function traderBalances(address) view returns (uint256)',
  'function lpBalances(address) view returns (uint256)',
  'function totalTraderDeposits() view returns (uint256)',
  'function totalLpDeposits() view returns (uint256)',
];

const HUSDC_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

try {
  const rpc = process.env.BASE_SEPOLIA_RPC;
  if (rpc) {
    provider = new ethers.JsonRpcProvider(rpc);
  } else {
    console.warn('[Blockchain] BASE_SEPOLIA_RPC not set — provider unavailable');
  }

  const pk = process.env.RELAYER_PRIVATE_KEY;
  if (pk && pk !== 'YOUR_KEY_HERE' && provider) {
    relayer = new ethers.Wallet(pk, provider);
  } else {
    console.warn('[Blockchain] RELAYER_PRIVATE_KEY not set — relayer unavailable');
  }

  const vaultAddr = process.env.VAULT_CONTRACT_ADDRESS;
  if (vaultAddr && vaultAddr !== 'YOUR_ADDRESS' && provider) {
    vaultContract = new ethers.Contract(vaultAddr, VAULT_ABI, relayer || provider);
  } else {
    console.warn('[Blockchain] VAULT_CONTRACT_ADDRESS not set — vault contract unavailable');
  }

  // USDC on Base Sepolia (0x17b9526493820c6eb04988433b9220b06e210a3e)
  const usdcAddr = process.env.USDC_ADDRESS || USDC_BASE_SEPOLIA;
  if (usdcAddr && usdcAddr !== 'YOUR_ADDRESS' && provider) {
    husdcContract = new ethers.Contract(usdcAddr, HUSDC_ABI, relayer || provider);
    console.log(`[Blockchain] USDC contract: ${usdcAddr} on Base Sepolia`);
  } else {
    console.warn('[Blockchain] USDC_ADDRESS not set — balance sync unavailable');
  }
} catch (error) {
  console.warn('[Blockchain] Setup error (non-fatal):', error.message);
}

module.exports = { provider, relayer, vaultContract, husdcContract, USDC_BASE_SEPOLIA };
