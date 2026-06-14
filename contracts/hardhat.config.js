require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const {
  DEPLOYER_PRIVATE_KEY,
  BASE_SEPOLIA_RPC,
  ZG_TESTNET_RPC,
  ZG_MAINNET_RPC,
  MANTLE_SEPOLIA_RPC,
  MANTLE_MAINNET_RPC,
  MANTLESCAN_API_KEY,
} = process.env;

const accounts =
  DEPLOYER_PRIVATE_KEY && DEPLOYER_PRIVATE_KEY.length === 64
    ? [`0x${DEPLOYER_PRIVATE_KEY}`]
    : DEPLOYER_PRIVATE_KEY && DEPLOYER_PRIVATE_KEY.startsWith("0x")
      ? [DEPLOYER_PRIVATE_KEY]
      : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./contracts",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    baseSepolia: {
      url: BASE_SEPOLIA_RPC || "https://sepolia.base.org",
      accounts,
      chainId: 84532,
    },
    ogTestnet: {
      url: ZG_TESTNET_RPC || "",
      accounts,
      chainId: 16602,
    },
    ogMainnet: {
      url: ZG_MAINNET_RPC || "",
      accounts,
      chainId: 16661,
    },
    // --- Mantle (Turing Test Hackathon — AI x RWA track) ---
    mantleSepolia: {
      url: MANTLE_SEPOLIA_RPC || "https://rpc.sepolia.mantle.xyz",
      accounts,
      chainId: 5003,
    },
    mantleMainnet: {
      url: MANTLE_MAINNET_RPC || "https://rpc.mantle.xyz",
      accounts,
      chainId: 5000,
    },
  },
  etherscan: {
    apiKey: {
      mantleSepolia: MANTLESCAN_API_KEY || "",
      mantleMainnet: MANTLESCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "mantleSepolia",
        chainId: 5003,
        urls: {
          apiURL: "https://api-sepolia.mantlescan.xyz/api",
          browserURL: "https://sepolia.mantlescan.xyz",
        },
      },
      {
        network: "mantleMainnet",
        chainId: 5000,
        urls: {
          apiURL: "https://api.mantlescan.xyz/api",
          browserURL: "https://mantlescan.xyz",
        },
      },
    ],
  },
};
