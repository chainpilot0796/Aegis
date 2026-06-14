const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const NETWORK_META = {
  baseSepolia:   { explorer: "https://sepolia.basescan.org",     label: "Base Sepolia" },
  ogTestnet:     { explorer: "https://chainscan-galileo.0g.ai",  label: "0G Galileo Testnet" },
  ogMainnet:     { explorer: "https://chainscan.0g.ai",          label: "0G Aristotle Mainnet" },
  mantleSepolia: { explorer: "https://sepolia.mantlescan.xyz",   label: "Mantle Sepolia Testnet" },
  mantleMainnet: { explorer: "https://mantlescan.xyz",           label: "Mantle Mainnet" },
  localhost:     { explorer: "",                                  label: "Localhost" },
};

// Fee-on-yield default: 10% of positive exposure payout (upside only). 0 = off.
const PROTOCOL_FEE_BPS = Number(process.env.PROTOCOL_FEE_BPS || 1000);

async function deployRWA(label, name, symbol, decimals) {
  console.log(`\n  Deploying ${label} (${symbol})...`);
  const Token = await hre.ethers.getContractFactory("MockRWAToken");
  const token = await Token.deploy(name, symbol, decimals);
  await token.waitForDeployment();
  const address = await token.getAddress();
  const txHash = token.deploymentTransaction().hash;
  await token.deploymentTransaction().wait(2);
  console.log(`    ${symbol}: ${address}`);
  return { address, txHash, name, symbol, decimals };
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const networkName = hre.network.name;
  const chainId = (await hre.ethers.provider.getNetwork()).chainId;
  const meta = NETWORK_META[networkName] || { explorer: "", label: networkName };
  const isMantle = networkName.startsWith("mantle");

  console.log("=========================================");
  console.log(" Aegis — Contract Deployment (Mantle RWA)");
  console.log("=========================================");
  console.log("Network:    ", meta.label);
  console.log("Chain ID:   ", chainId.toString());
  console.log("Deployer:   ", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:    ", hre.ethers.formatEther(balance), "(native)");
  if (balance === 0n) {
    throw new Error("Deployer has no native token — fund the wallet first");
  }

  // 1. Deposit/settlement asset — USDY (Ondo yield-bearing stable). 6dp mock on testnet.
  const usdy = await deployRWA("USDY (deposit asset)", "Ondo US Dollar Yield", "USDY", 6);

  // 2. Hedge-target asset — mETH (Mantle LSD). Faucet token for demos.
  const meth = await deployRWA("mETH (hedge target)", "Mantle Staked Ether", "mETH", 18);

  // 3. AegisVault — settles in USDY, relayer = deployer
  console.log("\n  Deploying AegisVault...");
  const AegisVault = await hre.ethers.getContractFactory("AegisVault");
  const vault = await AegisVault.deploy(usdy.address, deployer.address);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  const vaultTxHash = vault.deploymentTransaction().hash;
  await vault.deploymentTransaction().wait(2);
  console.log("    AegisVault:", vaultAddress);

  // 4. Configure fee-on-yield revenue model
  if (PROTOCOL_FEE_BPS > 0) {
    console.log(`\n  Setting protocol fee → ${PROTOCOL_FEE_BPS} bps (${PROTOCOL_FEE_BPS / 100}% of upside)...`);
    const feeTx = await vault.setProtocolFee(PROTOCOL_FEE_BPS);
    await feeTx.wait(1);
  }

  // Persist deployment record (merged per-network)
  const deploymentPath = path.join(__dirname, "..", "deployment.json");
  let existing = { networks: {} };
  if (fs.existsSync(deploymentPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
      if (raw.networks) existing = raw;
      else if (raw.network) existing = { networks: { [raw.network]: raw } };
    } catch {
      // ignore parse errors, treat as fresh
    }
  }

  existing.networks[networkName] = {
    network: networkName,
    label: meta.label,
    chainId: chainId.toString(),
    explorer: meta.explorer,
    deployer: deployer.address,
    relayer: deployer.address,
    deploymentTime: new Date().toISOString(),
    protocolFeeBps: PROTOCOL_FEE_BPS,
    contracts: {
      usdy: {
        address: usdy.address,
        name: usdy.name,
        symbol: usdy.symbol,
        decimals: usdy.decimals,
        txHash: usdy.txHash,
        role: "deposit / settlement asset",
      },
      meth: {
        address: meth.address,
        name: meth.name,
        symbol: meth.symbol,
        decimals: meth.decimals,
        txHash: meth.txHash,
        role: "hedge target",
      },
      aegisVault: {
        address: vaultAddress,
        depositToken: usdy.address,
        relayer: deployer.address,
        protocolFeeBps: PROTOCOL_FEE_BPS,
        txHash: vaultTxHash,
      },
    },
  };

  fs.writeFileSync(deploymentPath, JSON.stringify(existing, null, 2));
  console.log("\nSaved deployment to:", deploymentPath);

  console.log("\n=========================================");
  console.log("  DEPLOYMENT COMPLETE");
  console.log("=========================================");
  console.log("USDY:         ", usdy.address);
  console.log("mETH:         ", meth.address);
  console.log("AegisVault:   ", vaultAddress);
  console.log("Relayer:      ", deployer.address);
  if (meta.explorer) {
    console.log("Vault tx:     ", `${meta.explorer}/tx/${vaultTxHash}`);
  }
  console.log("=========================================");
  console.log("\nServer env (server/.env):");
  console.log(`VAULT_CONTRACT_ADDRESS=${vaultAddress}`);
  console.log(`USDY_ADDRESS=${usdy.address}`);
  console.log(`METH_ADDRESS=${meth.address}`);
  console.log("\nClient env (client/.env):");
  console.log(`VITE_AEGIS_VAULT_ADDRESS=${vaultAddress}`);
  console.log(`VITE_USDY_ADDRESS=${usdy.address}`);
  console.log(`VITE_METH_ADDRESS=${meth.address}`);
  console.log("=========================================");
  if (isMantle) {
    console.log("\nVerify (optional):");
    console.log(`  npx hardhat verify --network ${networkName} ${vaultAddress} ${usdy.address} ${deployer.address}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
