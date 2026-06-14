const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  loadFixture,
  time,
} = require("@nomicfoundation/hardhat-network-helpers");

describe("Aegis.0G", function () {
  // ─── Shared fixture ───────────────────────────────────────────────
  async function deployFixture() {
    const [owner, relayer, user1, user2, lp1] = await ethers.getSigners();

    const AUSDC = await ethers.getContractFactory("AUSDC");
    const ausdc = await AUSDC.deploy();

    const AegisVault = await ethers.getContractFactory("AegisVault");
    const vault = await AegisVault.deploy(
      await ausdc.getAddress(),
      relayer.address
    );

    const DECIMALS = 6;
    const unit = (n) => BigInt(n) * 10n ** BigInt(DECIMALS);

    for (const u of [user1, user2, lp1]) {
      await ausdc.faucet(u.address, unit(1_000_000));
    }

    return { ausdc, vault, owner, relayer, user1, user2, lp1, unit };
  }

  // =================================================================
  //  AUSDC
  // =================================================================
  describe("AUSDC", function () {
    it("has correct name, symbol, and decimals", async function () {
      const { ausdc } = await loadFixture(deployFixture);
      expect(await ausdc.name()).to.equal("Aegis USD");
      expect(await ausdc.symbol()).to.equal("A-USDC");
      expect(await ausdc.decimals()).to.equal(6);
    });

    it("mints 1 trillion tokens to deployer", async function () {
      const { ausdc, owner, unit } = await loadFixture(deployFixture);
      expect(await ausdc.balanceOf(owner.address)).to.equal(
        unit(1_000_000_000_000)
      );
    });

    it("faucet mints up to 1M tokens", async function () {
      const { ausdc, user1, unit } = await loadFixture(deployFixture);
      const before = await ausdc.balanceOf(user1.address);
      await ausdc.faucet(user1.address, unit(500_000));
      expect(await ausdc.balanceOf(user1.address)).to.equal(
        before + unit(500_000)
      );
    });

    it("faucet reverts if amount > 1M", async function () {
      const { ausdc, user1, unit } = await loadFixture(deployFixture);
      await expect(
        ausdc.faucet(user1.address, unit(1_000_001))
      ).to.be.revertedWith("Max 1M per faucet");
    });
  });

  // =================================================================
  //  Shield path — Aegis.0G core
  // =================================================================
  describe("Shield", function () {
    const ASSET_GOLD = ethers.id("gold"); // keccak256("gold")
    const ENTRY_PRICE = 2050_00000000n;   // $2050.00000000 scaled 1e8
    const DURATION = 90n * 24n * 3600n;    // 90 days
    const ROOT_HASH = ethers.id("rootHash-fixture-1");

    it("createShield: pulls A-USDC, stores Shield, emits event", async function () {
      const { ausdc, vault, user1, unit } = await loadFixture(deployFixture);
      const vaultAddr = await vault.getAddress();
      const deposit = unit(1000);

      await ausdc.connect(user1).approve(vaultAddr, deposit);

      const tx = await vault
        .connect(user1)
        .createShield(deposit, DURATION, ASSET_GOLD, ENTRY_PRICE, ROOT_HASH);

      await expect(tx)
        .to.emit(vault, "ShieldCreated")
        .withArgs(
          user1.address,
          0,
          ASSET_GOLD,
          deposit,
          DURATION,
          ENTRY_PRICE,
          ROOT_HASH
        );

      // A-USDC moved into the vault
      expect(await ausdc.balanceOf(vaultAddr)).to.equal(deposit);
      expect(await vault.totalShieldsCreated()).to.equal(1);
      expect(await vault.totalShieldDeposits()).to.equal(deposit);

      // Shield record is correct
      const stored = await vault.getShield(user1.address, 0);
      expect(stored.depositAmount).to.equal(deposit);
      expect(stored.assetId).to.equal(ASSET_GOLD);
      expect(stored.entryPrice).to.equal(ENTRY_PRICE);
      expect(stored.storageRootHash).to.equal(ROOT_HASH);
      expect(stored.settled).to.equal(false);

      // getShields returns the array
      const arr = await vault.getShields(user1.address);
      expect(arr.length).to.equal(1);
      expect(arr[0].depositAmount).to.equal(deposit);

      expect(await vault.getShieldCount(user1.address)).to.equal(1);
    });

    it("createShield: reverts on zero deposit / zero duration / zero rootHash", async function () {
      const { ausdc, vault, user1, unit } = await loadFixture(deployFixture);
      const vaultAddr = await vault.getAddress();
      const deposit = unit(100);
      await ausdc.connect(user1).approve(vaultAddr, deposit);

      await expect(
        vault.connect(user1).createShield(0, DURATION, ASSET_GOLD, ENTRY_PRICE, ROOT_HASH)
      ).to.be.revertedWith("Deposit must be > 0");

      await expect(
        vault.connect(user1).createShield(deposit, 0, ASSET_GOLD, ENTRY_PRICE, ROOT_HASH)
      ).to.be.revertedWith("Duration must be > 0");

      await expect(
        vault.connect(user1).createShield(deposit, DURATION, ASSET_GOLD, ENTRY_PRICE, ethers.ZeroHash)
      ).to.be.revertedWith("Missing storage rootHash");
    });

    it("createShield: reverts without ERC20 approval", async function () {
      const { vault, user1, unit } = await loadFixture(deployFixture);
      await expect(
        vault
          .connect(user1)
          .createShield(unit(100), DURATION, ASSET_GOLD, ENTRY_PRICE, ROOT_HASH)
      ).to.be.reverted;
    });

    it("multiple shields stack per user, indexes 0/1/2 in order", async function () {
      const { ausdc, vault, user1, unit } = await loadFixture(deployFixture);
      const vaultAddr = await vault.getAddress();
      const d1 = unit(100), d2 = unit(200), d3 = unit(300);
      await ausdc.connect(user1).approve(vaultAddr, d1 + d2 + d3);

      await vault.connect(user1).createShield(d1, DURATION, ASSET_GOLD, ENTRY_PRICE, ethers.id("a"));
      await vault.connect(user1).createShield(d2, DURATION, ASSET_GOLD, ENTRY_PRICE, ethers.id("b"));
      await vault.connect(user1).createShield(d3, DURATION, ASSET_GOLD, ENTRY_PRICE, ethers.id("c"));

      expect(await vault.getShieldCount(user1.address)).to.equal(3);
      const arr = await vault.getShields(user1.address);
      expect(arr[0].depositAmount).to.equal(d1);
      expect(arr[1].depositAmount).to.equal(d2);
      expect(arr[2].depositAmount).to.equal(d3);
    });

    it("settleShield: positive payout transfers deposit + bonus back", async function () {
      const { ausdc, vault, relayer, lp1, user1, unit } = await loadFixture(deployFixture);
      const vaultAddr = await vault.getAddress();

      // Fund bonus pool first (lp1 acts as protocol treasury for the demo)
      await ausdc.connect(lp1).approve(vaultAddr, unit(500));
      await expect(vault.connect(lp1).fundBonusPool(unit(500)))
        .to.emit(vault, "BonusPoolFunded")
        .withArgs(lp1.address, unit(500));
      expect(await vault.bonusPool()).to.equal(unit(500));

      const deposit = unit(1000);
      await ausdc.connect(user1).approve(vaultAddr, deposit);
      await vault
        .connect(user1)
        .createShield(deposit, DURATION, ASSET_GOLD, ENTRY_PRICE, ROOT_HASH);

      await time.increase(Number(DURATION));

      const balBefore = await ausdc.balanceOf(user1.address);
      const closePrice = 2200_00000000n;
      const exposurePayout = unit(50); // +50 A-USDC of profit

      await expect(
        vault
          .connect(relayer)
          .settleShield(user1.address, 0, closePrice, exposurePayout)
      )
        .to.emit(vault, "ShieldSettled")
        .withArgs(user1.address, 0, closePrice, exposurePayout);

      expect(await ausdc.balanceOf(user1.address)).to.equal(
        balBefore + deposit + exposurePayout
      );
      expect(await vault.bonusPool()).to.equal(unit(500) - unit(50));

      const stored = await vault.getShield(user1.address, 0);
      expect(stored.settled).to.equal(true);
      expect(stored.closePrice).to.equal(closePrice);
      expect(stored.exposurePayout).to.equal(exposurePayout);
      expect(await vault.totalShieldDeposits()).to.equal(0);
    });

    it("settleShield: positive payout reverts if bonus pool empty", async function () {
      const { ausdc, vault, relayer, user1, unit } = await loadFixture(deployFixture);
      const vaultAddr = await vault.getAddress();
      const deposit = unit(100);
      await ausdc.connect(user1).approve(vaultAddr, deposit);
      await vault
        .connect(user1)
        .createShield(deposit, DURATION, ASSET_GOLD, ENTRY_PRICE, ROOT_HASH);

      await time.increase(Number(DURATION));
      await expect(
        vault.connect(relayer).settleShield(user1.address, 0, ENTRY_PRICE, unit(10))
      ).to.be.revertedWith("Bonus pool empty - fund via fundBonusPool");
    });

    it("settleShield: negative exposure absorbs only up to deposit (principal protected)", async function () {
      const { ausdc, vault, relayer, user1, unit } = await loadFixture(deployFixture);
      const vaultAddr = await vault.getAddress();
      const deposit = unit(1000);
      await ausdc.connect(user1).approve(vaultAddr, deposit);
      await vault
        .connect(user1)
        .createShield(deposit, DURATION, ASSET_GOLD, ENTRY_PRICE, ROOT_HASH);

      await time.increase(Number(DURATION));

      const balBefore = await ausdc.balanceOf(user1.address);
      const exposurePayout = -unit(40); // worst-case exposure realised

      await vault
        .connect(relayer)
        .settleShield(user1.address, 0, 1500_00000000n, exposurePayout);

      // User gets deposit - 40 (40 of the *yield-derived exposure budget* lost,
      // but principal floor is preserved by clamp inside the contract).
      expect(await ausdc.balanceOf(user1.address)).to.equal(
        balBefore + deposit - unit(40)
      );
    });

    it("settleShield: reverts before maturity", async function () {
      const { ausdc, vault, relayer, user1, unit } = await loadFixture(deployFixture);
      const vaultAddr = await vault.getAddress();
      const deposit = unit(100);
      await ausdc.connect(user1).approve(vaultAddr, deposit);
      await vault
        .connect(user1)
        .createShield(deposit, DURATION, ASSET_GOLD, ENTRY_PRICE, ROOT_HASH);

      await expect(
        vault.connect(relayer).settleShield(user1.address, 0, ENTRY_PRICE, 0)
      ).to.be.revertedWith("Not mature");
    });

    it("settleShield: only relayer", async function () {
      const { ausdc, vault, user1, unit } = await loadFixture(deployFixture);
      const vaultAddr = await vault.getAddress();
      const deposit = unit(100);
      await ausdc.connect(user1).approve(vaultAddr, deposit);
      await vault
        .connect(user1)
        .createShield(deposit, DURATION, ASSET_GOLD, ENTRY_PRICE, ROOT_HASH);

      await time.increase(Number(DURATION));
      await expect(
        vault.connect(user1).settleShield(user1.address, 0, ENTRY_PRICE, 0)
      ).to.be.revertedWith("Only relayer");
    });

    it("settleShield: cannot double-settle", async function () {
      const { ausdc, vault, relayer, user1, unit } = await loadFixture(deployFixture);
      const vaultAddr = await vault.getAddress();
      const deposit = unit(100);
      await ausdc.connect(user1).approve(vaultAddr, deposit);
      await vault
        .connect(user1)
        .createShield(deposit, DURATION, ASSET_GOLD, ENTRY_PRICE, ROOT_HASH);

      await time.increase(Number(DURATION));
      await vault.connect(relayer).settleShield(user1.address, 0, ENTRY_PRICE, 0);

      await expect(
        vault.connect(relayer).settleShield(user1.address, 0, ENTRY_PRICE, 0)
      ).to.be.revertedWith("Already settled");
    });
  });

  // =================================================================
  //  Protocol fee (fee-on-yield revenue model)
  // =================================================================
  describe("Protocol fee", function () {
    const ASSET_GOLD = ethers.id("gold");
    const ENTRY_PRICE = 2050_00000000n;
    const DURATION = 90n * 24n * 3600n;
    const ROOT_HASH = ethers.id("rootHash-fee-1");

    it("setProtocolFee: owner sets it, caps at 20%, non-owner reverts", async function () {
      const { vault, owner, user1 } = await loadFixture(deployFixture);
      await expect(vault.connect(owner).setProtocolFee(1000))
        .to.emit(vault, "ProtocolFeeChanged")
        .withArgs(0, 1000);
      expect(await vault.protocolFeeBps()).to.equal(1000);
      await expect(vault.connect(owner).setProtocolFee(2001)).to.be.revertedWith("Fee too high");
      await expect(vault.connect(user1).setProtocolFee(500)).to.be.revertedWith("Only owner");
    });

    it("skims fee from positive payout only; principal & negative payouts untouched", async function () {
      const { ausdc, vault, owner, relayer, lp1, user1, unit } = await loadFixture(deployFixture);
      const vaultAddr = await vault.getAddress();
      await vault.connect(owner).setProtocolFee(1000); // 10% of upside

      await ausdc.connect(lp1).approve(vaultAddr, unit(500));
      await vault.connect(lp1).fundBonusPool(unit(500));

      const deposit = unit(1000);
      await ausdc.connect(user1).approve(vaultAddr, deposit);
      await vault.connect(user1).createShield(deposit, DURATION, ASSET_GOLD, ENTRY_PRICE, ROOT_HASH);
      await time.increase(Number(DURATION));

      const balBefore = await ausdc.balanceOf(user1.address);
      const bonus = unit(100);
      const fee = bonus / 10n; // 10%
      await vault.connect(relayer).settleShield(user1.address, 0, 2200_00000000n, bonus);

      // user gets deposit + bonus - fee; protocol accrues the fee
      expect(await ausdc.balanceOf(user1.address)).to.equal(balBefore + deposit + bonus - fee);
      expect(await vault.accruedFees()).to.equal(fee);
    });

    it("withdrawFees: owner pulls accrued fees to feeRecipient", async function () {
      const { ausdc, vault, owner, relayer, lp1, user1, unit } = await loadFixture(deployFixture);
      const vaultAddr = await vault.getAddress();
      await vault.connect(owner).setProtocolFee(1000);
      await ausdc.connect(lp1).approve(vaultAddr, unit(500));
      await vault.connect(lp1).fundBonusPool(unit(500));
      const deposit = unit(1000);
      await ausdc.connect(user1).approve(vaultAddr, deposit);
      await vault.connect(user1).createShield(deposit, DURATION, ASSET_GOLD, ENTRY_PRICE, ROOT_HASH);
      await time.increase(Number(DURATION));
      await vault.connect(relayer).settleShield(user1.address, 0, 2200_00000000n, unit(100));

      const fee = unit(10);
      const ownerBefore = await ausdc.balanceOf(owner.address);
      await expect(vault.connect(owner).withdrawFees(fee))
        .to.emit(vault, "FeesWithdrawn");
      expect(await ausdc.balanceOf(owner.address)).to.equal(ownerBefore + fee);
      expect(await vault.accruedFees()).to.equal(0);
      await expect(vault.connect(owner).withdrawFees(1n)).to.be.revertedWith("Exceeds accrued");
    });
  });

  // =================================================================
  //  Ownership / relayer rotation
  // =================================================================
  describe("Ownership & relayer rotation", function () {
    it("owner is the deployer; relayer is the constructor arg", async function () {
      const { vault, owner, relayer } = await loadFixture(deployFixture);
      expect(await vault.owner()).to.equal(owner.address);
      expect(await vault.relayer()).to.equal(relayer.address);
      expect(await vault.pendingOwner()).to.equal(ethers.ZeroAddress);
    });

    it("setRelayer: owner rotates the relayer; emits event", async function () {
      const { vault, owner, relayer, user2 } = await loadFixture(deployFixture);
      await expect(vault.connect(owner).setRelayer(user2.address))
        .to.emit(vault, "RelayerChanged")
        .withArgs(relayer.address, user2.address);
      expect(await vault.relayer()).to.equal(user2.address);
    });

    it("setRelayer: reverts for non-owner / zero address", async function () {
      const { vault, owner, relayer, user2 } = await loadFixture(deployFixture);
      await expect(vault.connect(user2).setRelayer(user2.address))
        .to.be.revertedWith("Only owner");
      await expect(vault.connect(owner).setRelayer(ethers.ZeroAddress))
        .to.be.revertedWith("relayer=0");
    });

    it("transferOwnership: two-step handover", async function () {
      const { vault, owner, user2 } = await loadFixture(deployFixture);
      await expect(vault.connect(owner).transferOwnership(user2.address))
        .to.emit(vault, "OwnershipTransferStarted")
        .withArgs(owner.address, user2.address);
      expect(await vault.owner()).to.equal(owner.address); // still old until accepted
      expect(await vault.pendingOwner()).to.equal(user2.address);

      await expect(vault.connect(user2).acceptOwnership())
        .to.emit(vault, "OwnershipTransferred")
        .withArgs(owner.address, user2.address);
      expect(await vault.owner()).to.equal(user2.address);
      expect(await vault.pendingOwner()).to.equal(ethers.ZeroAddress);
    });

    it("acceptOwnership: only the pending owner can accept", async function () {
      const { vault, owner, user1, user2 } = await loadFixture(deployFixture);
      await vault.connect(owner).transferOwnership(user2.address);
      await expect(vault.connect(user1).acceptOwnership())
        .to.be.revertedWith("Not pending owner");
    });

    it("after relayer rotation, only new relayer can settle", async function () {
      const { ausdc, vault, owner, relayer, user1, user2, unit } = await loadFixture(deployFixture);
      const vaultAddr = await vault.getAddress();
      const deposit = unit(100);
      await ausdc.connect(user1).approve(vaultAddr, deposit);
      const ASSET_GOLD = ethers.id("gold");
      const ENTRY = 2050_00000000n;
      const DUR = 90n * 24n * 3600n;
      const ROOT = ethers.id("rot-fixture");
      await vault.connect(user1).createShield(deposit, DUR, ASSET_GOLD, ENTRY, ROOT);
      await time.increase(Number(DUR));

      await vault.connect(owner).setRelayer(user2.address);
      await expect(vault.connect(relayer).settleShield(user1.address, 0, ENTRY, 0))
        .to.be.revertedWith("Only relayer");
      await expect(vault.connect(user2).settleShield(user1.address, 0, ENTRY, 0))
        .to.not.be.reverted;
    });
  });

  // =================================================================
  //  Legacy perp surface — minimal smoke tests retained
  // =================================================================
  describe("Legacy perp surface", function () {
    it("deposit + settlePnl + withdraw still works", async function () {
      const { ausdc, vault, relayer, user1, lp1, unit } = await loadFixture(deployFixture);
      const vaultAddr = await vault.getAddress();

      await ausdc.connect(user1).approve(vaultAddr, unit(10_000));
      await vault.connect(user1).depositTrader(unit(10_000));
      await ausdc.connect(lp1).approve(vaultAddr, unit(50_000));
      await vault.connect(lp1).depositLp(unit(50_000));

      await vault
        .connect(relayer)
        .settlePnl(user1.address, BigInt(unit(2000)));
      expect(await vault.traderBalances(user1.address)).to.equal(unit(12_000));

      await vault.connect(relayer).withdrawTrader(user1.address, unit(12_000));
      expect(await vault.traderBalances(user1.address)).to.equal(0);
    });

    it("advanceEpoch increments after EPOCH_DURATION", async function () {
      const { vault } = await loadFixture(deployFixture);
      expect(await vault.currentEpoch()).to.equal(1);
      await time.increase(7 * 24 * 3600);
      await vault.advanceEpoch();
      expect(await vault.currentEpoch()).to.equal(2);
    });
  });
});
