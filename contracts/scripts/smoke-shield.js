/**
 * Aegis.0G mainnet (or testnet) smoke test.
 *
 * Runs the full createShield path end-to-end against a deployed AegisVault:
 *   1. Read deployer balance.
 *   2. Mint A-USDC via the faucet (if balance < deposit).
 *   3. Approve the vault for the deposit.
 *   4. Submit createShield(...) with a fixture rootHash.
 *   5. Parse the ShieldCreated event and print the explorer link.
 *
 * Usage:
 *   node node_modules/hardhat/internal/cli/bootstrap.js run scripts/smoke-shield.js --network ogTestnet
 *   node node_modules/hardhat/internal/cli/bootstrap.js run scripts/smoke-shield.js --network ogMainnet
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const NETWORK_META = {
  ogTestnet: { explorer: "https://chainscan-galileo.0g.ai", label: "0G Galileo Testnet" },
  ogMainnet: { explorer: "https://chainscan.0g.ai",          label: "0G Aristotle Mainnet" },
  baseSepolia: { explorer: "https://sepolia.basescan.org", label: "Base Sepolia" },
  localhost: { explorer: "", label: "Localhost" },
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const networkName = hre.network.name;
  const chainId = (await hre.ethers.provider.getNetwork()).chainId;
  const meta = NETWORK_META[networkName] || { explorer: "", label: networkName };

  const deploymentPath = path.join(__dirname, "..", "deployment.json");
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(
      "deployment.json missing — run scripts/deploy.js for this network first."
    );
  }
  const raw = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const netRec = raw.networks && raw.networks[networkName];
  if (!netRec) {
    throw new Error(
      `No deployment record for network '${networkName}' — run deploy first.`
    );
  }

  const ausdcAddress = netRec.contracts.ausdc.address;
  const vaultAddress = netRec.contracts.aegisVault.address;

  console.log("=========================================");
  console.log(" Aegis.0G — Smoke Test (createShield)");
  console.log("=========================================");
  console.log("Network:    ", meta.label);
  console.log("Chain ID:   ", chainId.toString());
  console.log("Deployer:   ", deployer.address);
  console.log("AUSDC:      ", ausdcAddress);
  console.log("AegisVault: ", vaultAddress);

  const ausdc = await hre.ethers.getContractAt("AUSDC", ausdcAddress);
  const vault = await hre.ethers.getContractAt("AegisVault", vaultAddress);

  const deposit = hre.ethers.parseUnits("100", 6); // 100 A-USDC
  const balance = await ausdc.balanceOf(deployer.address);
  if (balance < deposit) {
    console.log("\nTopping up A-USDC via faucet...");
    const ftx = await ausdc.faucet(deployer.address, deposit);
    await ftx.wait();
    console.log("  faucet tx:", ftx.hash);
  }

  console.log("\nApproving vault...");
  const atx = await ausdc.approve(vaultAddress, deposit);
  await atx.wait();
  console.log("  approve tx:", atx.hash);

  const durationSeconds = 90n * 24n * 3600n; // 90 days
  const assetId = hre.ethers.id("gold");      // keccak256("gold")
  const entryPrice = 2050_00000000n;          // $2050 scaled 1e8
  const rootHash = hre.ethers.id("smoke-test-fixture-rootHash");

  console.log("\nSubmitting createShield...");
  const tx = await vault.createShield(deposit, durationSeconds, assetId, entryPrice, rootHash);
  console.log("  tx hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("  block:  ", receipt.blockNumber);

  // Parse ShieldCreated event
  const iface = vault.interface;
  let idx = null;
  for (const log of receipt.logs || []) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed && parsed.name === "ShieldCreated") {
        idx = parsed.args.idx;
        console.log("  event:  ShieldCreated");
        console.log("    user:        ", parsed.args.user);
        console.log("    idx:         ", parsed.args.idx.toString());
        console.log("    assetId:     ", parsed.args.assetId);
        console.log("    deposit:     ", parsed.args.deposit.toString());
        console.log("    duration:    ", parsed.args.durationSeconds.toString(), "seconds");
        console.log("    entryPrice:  ", parsed.args.entryPrice.toString());
        console.log("    rootHash:    ", parsed.args.storageRootHash);
        break;
      }
    } catch {}
  }

  console.log("\n=========================================");
  console.log("  SMOKE TEST PASSED");
  console.log("=========================================");
  if (meta.explorer) {
    console.log("Explorer tx:", `${meta.explorer}/tx/${tx.hash}`);
    console.log("Vault page: ", `${meta.explorer}/address/${vaultAddress}`);
  }
  console.log("=========================================");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
