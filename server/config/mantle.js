/**
 * Mantle Chain Config
 *
 * Builds the ethers (v6) provider / relayer wallet / contract handles for the
 * Aegis vault on the Mantle network (testnet = Mantle Sepolia, mainnet = Mantle).
 *
 * The vault settles in USDY (6-decimal mock RWA token); the hedge target is mETH.
 * Both are MockRWAToken instances on testnet.
 *
 * Mirrors the graceful-degradation pattern in config/blockchain.js: missing env
 * vars warn (never throw) so `require('./config/mantle')` is always safe.
 */

const { ethers } = require('ethers');

const DEFAULT_SEPOLIA_RPC = 'https://rpc.sepolia.mantle.xyz';
const DEFAULT_MAINNET_RPC = 'https://rpc.mantle.xyz';

const MANTLE_SEPOLIA_CHAIN_ID = 5003;
const MANTLE_MAINNET_CHAIN_ID = 5000;

const EXPLORER_SEPOLIA = 'https://explorer.sepolia.mantle.xyz';
const EXPLORER_MAINNET = 'https://explorer.mantle.xyz';

// Full vault ABI for the Aegis shield + fee + legacy surface.
const VAULT_ABI = [
  // --- Shield core ---
  'function createShield(uint128 deposit, uint64 durationSeconds, bytes32 assetId, uint64 entryPrice, bytes32 storageRootHash) returns (uint256 idx)',
  'function settleShield(address user, uint256 idx, uint64 closePrice, int128 exposurePayout)',
  'function getShields(address user) view returns (tuple(uint128 depositAmount, uint64 durationSeconds, uint64 createdAt, uint64 settleAt, bytes32 assetId, uint64 entryPrice, uint64 closePrice, int128 exposurePayout, bytes32 storageRootHash, bool settled)[])',
  'function getShield(address user, uint256 idx) view returns (tuple(uint128 depositAmount, uint64 durationSeconds, uint64 createdAt, uint64 settleAt, bytes32 assetId, uint64 entryPrice, uint64 closePrice, int128 exposurePayout, bytes32 storageRootHash, bool settled))',
  'function getShieldCount(address user) view returns (uint256)',
  'function totalShieldsCreated() view returns (uint256)',
  'function totalShieldDeposits() view returns (uint256)',
  'function fundBonusPool(uint256 amount)',
  'function bonusPool() view returns (uint256)',
  // --- Protocol fee ---
  'function setProtocolFee(uint16 newBps)',
  'function protocolFeeBps() view returns (uint16)',
  'function accruedFees() view returns (uint256)',
  'function feeRecipient() view returns (address)',
  'function withdrawFees(uint256 amount)',
  // --- Ownership / relayer ---
  'function owner() view returns (address)',
  'function relayer() view returns (address)',
  'function ausdcToken() view returns (address)',
  // --- Shield events ---
  'event ShieldCreated(address indexed user, uint256 indexed idx, bytes32 indexed assetId, uint128 deposit, uint64 durationSeconds, uint64 entryPrice, bytes32 storageRootHash)',
  'event ShieldSettled(address indexed user, uint256 indexed idx, uint64 closePrice, int128 exposurePayout)',
  'event ProtocolFeeAccrued(address indexed user, uint256 idx, uint256 feeAmount)',
];

// Minimal ERC20 ABI for the RWA tokens (USDY / mETH).
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

let provider = null;
let relayer = null;
let vaultContract = null;
let depositToken = null; // USDY
let methToken = null;

const network = (process.env.MANTLE_NETWORK || 'testnet').toLowerCase();
const isMainnet = network === 'mainnet';

const rpc = isMainnet
  ? process.env.MANTLE_MAINNET_RPC || DEFAULT_MAINNET_RPC
  : process.env.MANTLE_SEPOLIA_RPC || DEFAULT_SEPOLIA_RPC;

const chainId = Number(
  process.env.MANTLE_CHAIN_ID ||
    (isMainnet ? MANTLE_MAINNET_CHAIN_ID : MANTLE_SEPOLIA_CHAIN_ID)
);

const explorerBase = isMainnet ? EXPLORER_MAINNET : EXPLORER_SEPOLIA;

try {
  if (rpc) {
    // staticNetwork avoids an eager network round-trip at require() time.
    provider = new ethers.JsonRpcProvider(rpc, chainId, { staticNetwork: true });
  } else {
    console.warn('[Mantle] No RPC resolved — provider unavailable');
  }

  const pk = process.env.RELAYER_PRIVATE_KEY;
  if (pk && pk !== 'YOUR_KEY_HERE' && provider) {
    const key = pk.startsWith('0x') ? pk : `0x${pk}`;
    relayer = new ethers.Wallet(key, provider);
  } else {
    console.warn('[Mantle] RELAYER_PRIVATE_KEY not set — relayer unavailable (read-only)');
  }

  const vaultAddr = process.env.VAULT_CONTRACT_ADDRESS;
  if (vaultAddr && vaultAddr !== 'YOUR_ADDRESS' && provider) {
    vaultContract = new ethers.Contract(vaultAddr, VAULT_ABI, relayer || provider);
    console.log(`[Mantle] Vault contract: ${vaultAddr} (${network}, chainId=${chainId})`);
  } else {
    console.warn('[Mantle] VAULT_CONTRACT_ADDRESS not set — vault contract unavailable');
  }

  const usdyAddr = process.env.USDY_ADDRESS;
  if (usdyAddr && usdyAddr !== 'YOUR_ADDRESS' && provider) {
    depositToken = new ethers.Contract(usdyAddr, ERC20_ABI, relayer || provider);
    console.log(`[Mantle] USDY (deposit token): ${usdyAddr}`);
  } else {
    console.warn('[Mantle] USDY_ADDRESS not set — deposit token unavailable');
  }

  const methAddr = process.env.METH_ADDRESS;
  if (methAddr && methAddr !== 'YOUR_ADDRESS' && provider) {
    methToken = new ethers.Contract(methAddr, ERC20_ABI, relayer || provider);
    console.log(`[Mantle] mETH (hedge token): ${methAddr}`);
  } else {
    console.warn('[Mantle] METH_ADDRESS not set — hedge token unavailable');
  }
} catch (error) {
  console.warn('[Mantle] Setup error (non-fatal):', error.message);
}

module.exports = {
  provider,
  relayer,
  vaultContract,
  depositToken,
  methToken,
  network,
  chainId,
  rpc,
  explorerBase,
  VAULT_ABI,
  ERC20_ABI,
};
