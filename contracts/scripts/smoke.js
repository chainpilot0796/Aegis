// End-to-end on-chain smoke test against the live Mantle Sepolia deployment.
// Exercises: faucet -> approve -> createShield (with envelope rootHash) ->
// getShield read-back -> fundBonusPool -> settleShield -> fee accrual.
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const EXPLORER = "https://sepolia.mantlescan.xyz";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const link = (h) => `${EXPLORER}/tx/${h}`;

async function main() {
  const net = path.basename(hre.network.name);
  const dep = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployment.json"), "utf8"));
  const c = dep.networks[net].contracts;
  const [user] = await hre.ethers.getSigners();

  const usdy = await hre.ethers.getContractAt("MockRWAToken", c.usdy.address);
  const vault = await hre.ethers.getContractAt("AegisVault", c.aegisVault.address);
  const vaultAddr = await vault.getAddress();
  const dec = Number(c.usdy.decimals);
  const unit = (n) => BigInt(Math.round(n * 10 ** dec));

  const pass = [];
  const ok = (label, cond, extra = "") => {
    pass.push(cond);
    console.log(`  ${cond ? "PASS" : "FAIL"}  #${pass.length} ${label}${extra ? " — " + extra : ""}`);
  };

  console.log("=== Aegis Mantle smoke test ===");
  console.log("User/relayer:", user.address);
  console.log("Vault:", vaultAddr, "| USDY:", c.usdy.address);

  // [6] Faucet
  const fTx = await usdy.faucet(user.address, unit(1000));
  await fTx.wait(1);
  ok("USDY faucet mint", (await usdy.balanceOf(user.address)) >= unit(1000), link(fTx.hash));

  // [7] Approve
  const deposit = unit(100);
  const aTx = await usdy.approve(vaultAddr, deposit);
  await aTx.wait(1);
  ok("approve vault", (await usdy.allowance(user.address, vaultAddr)) >= deposit, link(aTx.hash));

  // [8] createShield — commit an envelope rootHash on-chain
  const assetId = hre.ethers.id("mETH");
  const entryPrice = 3000_00000000n; // $3000 scaled 1e8
  const rootHash = hre.ethers.id("smoke-envelope-" + Date.now());
  const idxBefore = await vault.getShieldCount(user.address);
  const cTx = await vault.createShield(deposit, 5n, assetId, entryPrice, rootHash);
  const cRcpt = await cTx.wait(1);
  ok("createShield (deposit pulled + shield stored)",
    (await vault.getShieldCount(user.address)) === idxBefore + 1n, link(cTx.hash));
  const idx = idxBefore;

  // [9] Read back — on-chain storageRootHash must equal the envelope hash we committed
  const stored = await vault.getShield(user.address, idx);
  ok("getShield read-back: on-chain rootHash == envelope hash", stored.storageRootHash === rootHash,
    stored.storageRootHash);

  // [10] Fund bonus pool (backs the upside payout)
  const bonus = unit(10);
  const apTx = await usdy.approve(vaultAddr, bonus);
  await apTx.wait(1);
  const fbTx = await vault.fundBonusPool(bonus);
  await fbTx.wait(1);
  ok("fundBonusPool", (await vault.bonusPool()) >= bonus, link(fbTx.hash));

  // [11] Settle after maturity — principal + bonus - fee
  console.log("  ...waiting for maturity (5s duration)");
  await wait(12000);
  const balBefore = await usdy.balanceOf(user.address);
  const accruedBefore = await vault.accruedFees();
  const sTx = await vault.settleShield(user.address, idx, entryPrice, bonus); // +bonus exposure
  await sTx.wait(1);
  const balAfter = await usdy.balanceOf(user.address);
  const feeBps = await vault.protocolFeeBps();
  const fee = (bonus * feeBps) / 10000n;
  const expectedPayout = deposit + bonus - fee;
  ok("settleShield payout = principal + bonus - fee",
    balAfter - balBefore === expectedPayout, `+${hre.ethers.formatUnits(balAfter - balBefore, dec)} USDY`);

  // [12] Fee accrual reflects fee-on-yield
  ok("accruedFees increased by the 10% fee",
    (await vault.accruedFees()) - accruedBefore === fee, `${hre.ethers.formatUnits(fee, dec)} USDY`);

  const settled = await vault.getShield(user.address, idx);
  ok("shield marked settled", settled.settled === true);

  const allPass = pass.every(Boolean);
  console.log(`\n=== ${pass.filter(Boolean).length}/${pass.length} on-chain checks passed ===`);
  if (!allPass) process.exit(1);
}

main().then(() => process.exit(0)).catch((e) => { console.error("SMOKE ERROR:", e.message); process.exit(1); });
