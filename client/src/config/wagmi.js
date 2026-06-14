import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';

// Mantle Mainnet (chain id 5000)
export const mantleMainnet = {
  id: 5000,
  name: 'Mantle',
  network: 'mantle',
  nativeCurrency: { name: 'Mantle', symbol: 'MNT', decimals: 18 },
  rpcUrls: {
    default: { http: [import.meta.env.VITE_MANTLE_MAINNET_RPC || 'https://rpc.mantle.xyz'] },
    public: { http: ['https://rpc.mantle.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Mantle Explorer', url: 'https://mantlescan.xyz' },
  },
  testnet: false,
};

// Mantle Sepolia Testnet (chain id 5003)
export const mantleSepolia = {
  id: 5003,
  name: 'Mantle Sepolia',
  network: 'mantle-sepolia',
  nativeCurrency: { name: 'Mantle', symbol: 'MNT', decimals: 18 },
  rpcUrls: {
    default: { http: [import.meta.env.VITE_MANTLE_TESTNET_RPC || 'https://rpc.sepolia.mantle.xyz'] },
    public: { http: ['https://rpc.sepolia.mantle.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Mantle Sepolia Explorer', url: 'https://sepolia.mantlescan.xyz' },
  },
  testnet: true,
};

const network = (import.meta.env.VITE_NETWORK || 'testnet').toLowerCase();
const primaryChain = network === 'mainnet' ? mantleMainnet : mantleSepolia;
const secondaryChain = network === 'mainnet' ? mantleSepolia : mantleMainnet;

export const chains = [primaryChain, secondaryChain];
export const ACTIVE_CHAIN = primaryChain;
export const EXPLORER_BASE = primaryChain.blockExplorers.default.url;

export const config = getDefaultConfig({
  appName: 'Aegis',
  projectId:
    import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ||
    'YOUR_32_CHAR_PROJECT_ID_HERE',
  chains,
  transports: {
    [mantleMainnet.id]: http(import.meta.env.VITE_MANTLE_MAINNET_RPC || 'https://rpc.mantle.xyz'),
    [mantleSepolia.id]: http(import.meta.env.VITE_MANTLE_TESTNET_RPC || 'https://rpc.sepolia.mantle.xyz'),
  },
});
