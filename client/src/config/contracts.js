import { ACTIVE_CHAIN, EXPLORER_BASE as CHAIN_EXPLORER } from './wagmi';

// Deposit token: USDY (Ondo US Dollar Yield) — 6 decimals on the testnet mock.
export const USDY_ADDRESS = import.meta.env.VITE_USDY_ADDRESS;
// Hedge target reference token: mETH (Mantle staked ETH).
export const METH_ADDRESS = import.meta.env.VITE_METH_ADDRESS;
export const AEGIS_VAULT_ADDRESS = import.meta.env.VITE_AEGIS_VAULT_ADDRESS;

// Decimals of the deposit token (USDY testnet mock = 6).
export const USDY_DECIMALS = 6;

// Legacy aliases — kept so older components that haven't been refactored still resolve.
export const AUSDC_ADDRESS = USDY_ADDRESS;
export const HUSDC_ADDRESS = USDY_ADDRESS;
export const VAULT_ADDRESS = AEGIS_VAULT_ADDRESS;

export const EXPLORER_BASE = import.meta.env.VITE_EXPLORER_BASE || CHAIN_EXPLORER;
export const CHAIN_ID = ACTIVE_CHAIN.id;

export const USDY_ABI = [
  {
    name: 'faucet',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
];

// Back-compat aliases
export const AUSDC_ABI = USDY_ABI;
export const HUSDC_ABI = USDY_ABI;

export const AEGIS_VAULT_ABI = [
  // --- Shield (Aegis core) ---
  {
    name: 'createShield',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'deposit', type: 'uint128' },
      { name: 'durationSeconds', type: 'uint64' },
      { name: 'assetId', type: 'bytes32' },
      { name: 'entryPrice', type: 'uint64' },
      { name: 'storageRootHash', type: 'bytes32' },
    ],
    outputs: [{ name: 'idx', type: 'uint256' }],
  },
  {
    name: 'getShield',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'idx', type: 'uint256' },
    ],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'depositAmount', type: 'uint128' },
          { name: 'durationSeconds', type: 'uint64' },
          { name: 'createdAt', type: 'uint64' },
          { name: 'settleAt', type: 'uint64' },
          { name: 'assetId', type: 'bytes32' },
          { name: 'entryPrice', type: 'uint64' },
          { name: 'closePrice', type: 'uint64' },
          { name: 'exposurePayout', type: 'int128' },
          { name: 'storageRootHash', type: 'bytes32' },
          { name: 'settled', type: 'bool' },
        ],
      },
    ],
  },
  {
    name: 'getShields',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      {
        type: 'tuple[]',
        components: [
          { name: 'depositAmount', type: 'uint128' },
          { name: 'durationSeconds', type: 'uint64' },
          { name: 'createdAt', type: 'uint64' },
          { name: 'settleAt', type: 'uint64' },
          { name: 'assetId', type: 'bytes32' },
          { name: 'entryPrice', type: 'uint64' },
          { name: 'closePrice', type: 'uint64' },
          { name: 'exposurePayout', type: 'int128' },
          { name: 'storageRootHash', type: 'bytes32' },
          { name: 'settled', type: 'bool' },
        ],
      },
    ],
  },
  {
    name: 'getShieldCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalShieldsCreated',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalShieldDeposits',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'bonusPool',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'fundBonusPool',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },

  // --- Protocol fee views (Mantle port) ---
  {
    name: 'protocolFeeBps',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint16' }],
  },
  {
    name: 'accruedFees',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'feeRecipient',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'event',
    name: 'ShieldCreated',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'idx', type: 'uint256', indexed: true },
      { name: 'assetId', type: 'bytes32', indexed: true },
      { name: 'deposit', type: 'uint128', indexed: false },
      { name: 'durationSeconds', type: 'uint64', indexed: false },
      { name: 'entryPrice', type: 'uint64', indexed: false },
      { name: 'storageRootHash', type: 'bytes32', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ShieldSettled',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'idx', type: 'uint256', indexed: true },
      { name: 'closePrice', type: 'uint64', indexed: false },
      { name: 'exposurePayout', type: 'int128', indexed: false },
    ],
  },

  // --- Legacy perp surface (not used in the demo) ---
  {
    name: 'depositTrader',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'traderBalances',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
];

// Back-compat alias
export const VAULT_ABI = AEGIS_VAULT_ABI;
