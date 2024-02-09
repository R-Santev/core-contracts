/* eslint-disable node/no-extraneous-import */
import { loadFixture, setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import * as hre from "hardhat";

import * as mcl from "../../../ts/mcl";
import { Fixtures, Signers } from "../mochaContext";
import { CHAIN_ID, DOMAIN, MAX_COMMISSION, SYSTEM } from "../constants";
import { generateFixtures } from "../fixtures";
import { initValidators } from "../helper";
import { RunSystemTests } from "./System.test";
import { RunStakingTests } from "./Staking.test";
import { RunDelegationTests } from "./Delegation.test";

describe("ValidatorSet", function () {
  /** Variables */

  // * Method used to initialize the parameters of the mocha context, e.g., the signers
  async function initializeContext(context: any) {
    context.signers = {} as Signers;
    context.fixtures = {} as Fixtures;

    const signers = await hre.ethers.getSigners();
    context.signers.accounts = signers;
    context.signers.admin = signers[0];
    context.signers.validators = initValidators(signers, 1, 4);
    context.signers.governance = signers[5];
    context.signers.delegator = signers[6];
    context.signers.rewardWallet = signers[7];
    context.signers.system = await hre.ethers.getSigner(SYSTEM);
    context.epochId = hre.ethers.BigNumber.from(1);
    context.epochSize = hre.ethers.BigNumber.from(64);
    context.epochReward = hre.ethers.utils.parseEther("0.0000001");
    context.minStake = hre.ethers.utils.parseEther("1");
    context.minDelegation = hre.ethers.utils.parseEther("1");
    context.epochsInYear = 31500;
    context.epoch = {
      startBlock: hre.ethers.BigNumber.from(1),
      endBlock: hre.ethers.BigNumber.from(64),
      epochRoot: hre.ethers.utils.randomBytes(32),
    };
    context.uptime = [
      {
        validator: context.signers.validators[0].address,
        signedBlocks: hre.ethers.BigNumber.from(0),
      },
    ];

    const network = await hre.ethers.getDefaultProvider().getNetwork();
    context.chainId = network.chainId;
  }

  before(async function () {
    // * Initialize the this context of mocha
    await initializeContext(this);

    /** Generate and initialize the context fixtures */
    await generateFixtures(this);

    await mcl.init();
    const keyPair = mcl.newKeyPair();
    const signature = mcl.signValidatorMessage(DOMAIN, CHAIN_ID, this.signers.admin.address, keyPair.secret).signature;
    this.validatorInit = {
      addr: this.signers.admin.address,
      pubkey: mcl.g2ToHex(keyPair.pubkey),
      signature: mcl.g1ToHex(signature),
      stake: this.minStake.mul(2),
    };
  });

  describe("System", function () {
    RunSystemTests();
  });

  // * Main tests for the ValidatorSet with the loaded context and all child fixtures
  describe("ValidatorSet initializations", function () {
    it("should validate default values when ValidatorSet deployed", async function () {
      const { validatorSet, rewardPool } = await loadFixture(this.fixtures.presetValidatorSetStateFixture);

      expect(validatorSet.deployTransaction.from).to.equal(this.signers.admin.address);
      expect(await validatorSet.minStake()).to.equal(0);
      expect(await rewardPool.minDelegation()).to.equal(0);
      expect(await validatorSet.currentEpochId()).to.equal(0);
      expect(await validatorSet.owner()).to.equal(hre.ethers.constants.AddressZero);
    });

    it("should revert when initialized without system call", async function () {
      const { validatorSet, bls, rewardPool, liquidToken } = await loadFixture(
        this.fixtures.presetValidatorSetStateFixture
      );

      await expect(
        validatorSet.initialize(
          {
            epochReward: this.epochReward,
            minStake: this.minStake,
            minDelegation: this.minDelegation,
            epochSize: this.epochSize,
          },
          [this.validatorInit],
          bls.address,
          rewardPool.address,
          this.signers.governance.address,
          liquidToken.address
        )
      )
        .to.be.revertedWithCustomError(validatorSet, "Unauthorized")
        .withArgs("SYSTEMCALL");
    });

    it("should revert with invalid signature when initializing", async function () {
      const { systemValidatorSet, bls, rewardPool, liquidToken } = await loadFixture(
        this.fixtures.presetValidatorSetStateFixture
      );

      this.validatorSetSize = Math.floor(Math.random() * (5 - 1) + 5); // Randomly pick 5-9
      this.validatorStake = hre.ethers.utils.parseEther(String(Math.floor(Math.random() * (10000 - 1000) + 1000)));

      expect(await systemValidatorSet.totalSupply()).to.equal(0);

      await expect(
        systemValidatorSet.initialize(
          {
            epochReward: this.epochReward,
            minStake: this.minStake,
            minDelegation: this.minDelegation,
            epochSize: this.epochSize,
          },
          // eslint-disable-next-line node/no-unsupported-features/es-syntax
          [{ ...this.validatorInit, addr: this.signers.accounts[1].address }],
          bls.address,
          rewardPool.address,
          this.signers.governance.address,
          liquidToken.address
        )
      )
        .to.be.revertedWithCustomError(systemValidatorSet, "InvalidSignature")
        .withArgs(this.signers.accounts[1].address);
    });

    it("should have zero total supply", async function () {
      const { systemValidatorSet } = await loadFixture(this.fixtures.presetValidatorSetStateFixture);

      expect(await systemValidatorSet.totalSupply(), "totalSupply").to.equal(0);
    });

    it("should initialize successfully", async function () {
      const { systemValidatorSet, bls, rewardPool } = await loadFixture(
        this.fixtures.initializedValidatorSetStateFixture
      );

      expect(await systemValidatorSet.minStake(), "minStake").to.equal(this.minStake);
      expect(await rewardPool.minDelegation(), "minDelegation").to.equal(this.minDelegation);
      expect(await systemValidatorSet.currentEpochId(), "currentEpochId").to.equal(1);
      expect(await systemValidatorSet.owner(), "owner").to.equal(this.signers.governance.address);

      const adminAddress = this.signers.admin.address;
      const validator = await systemValidatorSet.getValidator(adminAddress);

      expect(
        validator.blsKey.map((x: any) => x.toHexString()),
        "blsKey"
      ).to.deep.equal(this.validatorInit.pubkey);
      expect(await systemValidatorSet.balanceOf(adminAddress), "balanceOf").to.equal(this.minStake.mul(2));
      expect(await rewardPool.totalDelegationOf(adminAddress), "totalDelegationOf").to.equal(0);
      expect(validator.commission, "commission").to.equal(0);
      expect(await systemValidatorSet.bls(), "bls").to.equal(bls.address);
      expect(await systemValidatorSet.totalSupply(), "totalSupply").to.equal(this.minStake.mul(2));
    });

    it("should revert on reinitialization attempt", async function () {
      const { systemValidatorSet, bls, rewardPool, liquidToken } = await loadFixture(
        this.fixtures.initializedValidatorSetStateFixture
      );

      await expect(
        systemValidatorSet.initialize(
          {
            epochReward: this.epochReward,
            minStake: this.minStake,
            minDelegation: this.minDelegation,
            epochSize: this.epochSize,
          },
          [this.validatorInit],
          bls.address,
          rewardPool.address,
          this.signers.governance.address,
          liquidToken.address
        )
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });

    describe("Voting Power Exponent", async () => {
      it("should have valid initialized values", async function () {
        const { validatorSet } = await loadFixture(this.fixtures.initializedValidatorSetStateFixture);

        const powerExp = await validatorSet.powerExponent();
        expect(powerExp.value, "powerExp.value").to.equal(5000);
        expect(powerExp.pendingValue, "powerExp.pendingValue").to.equal(0);

        const powerExpRes = await validatorSet.getExponent();
        expect(powerExpRes.numerator, "powerExpRes.numerator").to.equal(5000);
        expect(powerExpRes.denominator, "powerExpRes.denominator").to.equal(10000);
      });
    });

    it("should revert on commit epoch without system call", async function () {
      const { validatorSet } = await loadFixture(this.fixtures.initializedValidatorSetStateFixture);

      await expect(validatorSet.commitEpoch(this.epochId, this.epoch, this.epochSize))
        .to.be.revertedWithCustomError(validatorSet, "Unauthorized")
        .withArgs("SYSTEMCALL");
    });

    it("should revert with unexpected epoch id", async function () {
      const { systemValidatorSet } = await loadFixture(this.fixtures.initializedValidatorSetStateFixture);
      const unexpectedEpochId = hre.ethers.utils.parseEther("1");

      await expect(systemValidatorSet.commitEpoch(unexpectedEpochId, this.epoch, this.epochSize)).to.be.revertedWith(
        "UNEXPECTED_EPOCH_ID"
      );
    });

    it("should revert with no blocks committed", async function () {
      const { systemValidatorSet } = await loadFixture(this.fixtures.initializedValidatorSetStateFixture);

      this.epoch.startBlock = hre.ethers.BigNumber.from(0);
      this.epoch.endBlock = hre.ethers.BigNumber.from(0);

      await expect(systemValidatorSet.commitEpoch(this.epochId, this.epoch, this.epochSize)).to.be.revertedWith(
        "NO_BLOCKS_COMMITTED"
      );
    });

    it("should revert that epoch is not divisible by epochSize", async function () {
      const { systemValidatorSet } = await loadFixture(this.fixtures.initializedValidatorSetStateFixture);

      // * commitEpoch checks for (epoch.endBlock - epoch.startBlock + 1) % epochSize === 0
      this.epoch.startBlock = hre.ethers.BigNumber.from(1);
      this.epoch.endBlock = hre.ethers.BigNumber.from(63);

      await expect(systemValidatorSet.commitEpoch(this.epochId, this.epoch, this.epochSize)).to.be.revertedWith(
        "EPOCH_MUST_BE_DIVISIBLE_BY_EPOCH_SIZE"
      );
    });

    it("should revert with invalid start block", async function () {
      const { systemValidatorSet } = await loadFixture(this.fixtures.initializedValidatorSetStateFixture);

      // * commitEpoch checks for (epoch.endBlock - epoch.startBlock + 1) % epochSize === 0
      this.epoch.startBlock = hre.ethers.BigNumber.from(3);
      this.epoch.endBlock = hre.ethers.BigNumber.from(64);
      this.epochSize = hre.ethers.BigNumber.from(62);

      await expect(systemValidatorSet.commitEpoch(this.epochId, this.epoch, this.epochSize)).to.be.revertedWith(
        "INVALID_START_BLOCK"
      );
    });

    it("should commit epoch", async function () {
      this.epochId = hre.ethers.BigNumber.from(1);
      // * commitEpoch checks for (epoch.endBlock - epoch.startBlock + 1) % epochSize === 0
      this.epoch.startBlock = hre.ethers.BigNumber.from(1);
      this.epoch.endBlock = hre.ethers.BigNumber.from(64);
      this.epochSize = hre.ethers.BigNumber.from(64);
      this.epoch.epochRoot = hre.ethers.utils.randomBytes(32);

      const { systemValidatorSet, commitEpochTx } = await loadFixture(this.fixtures.commitEpochTxFixture);

      await expect(commitEpochTx, "tx validation")
        .to.emit(systemValidatorSet, "NewEpoch")
        .withArgs(
          this.epochId,
          this.epoch.startBlock,
          this.epoch.endBlock,
          hre.ethers.utils.hexlify(this.epoch.epochRoot)
        );

      const storedEpoch: any = await systemValidatorSet.epochs(1);
      const currentEpochId = await systemValidatorSet.currentEpochId();

      expect(storedEpoch.startBlock, "startBlock").to.equal(this.epoch.startBlock);
      expect(storedEpoch.endBlock, "endBlock").to.equal(this.epoch.endBlock);
      expect(storedEpoch.epochRoot, "epochRoot").to.equal(hre.ethers.utils.hexlify(this.epoch.epochRoot));
      expect(currentEpochId, "currentEpochId").to.equal(2);
    });

    it("should get all active validators - admin", async function () {
      const { validatorSet } = await loadFixture(this.fixtures.commitEpochTxFixture);

      expect(await validatorSet.getValidators()).to.deep.equal([this.signers.admin.address]);
    });

    it("should get epoch by block", async function () {
      const { systemValidatorSet } = await loadFixture(this.fixtures.commitEpochTxFixture);

      const storedEpoch = await systemValidatorSet.getEpochByBlock(10);

      expect(storedEpoch.startBlock).to.equal(this.epoch.startBlock);
      expect(storedEpoch.endBlock).to.equal(this.epoch.endBlock);
      expect(storedEpoch.epochRoot).to.equal(hre.ethers.utils.hexlify(this.epoch.epochRoot));
    });

    it("should get non-existent epoch by block", async function () {
      const { systemValidatorSet } = await loadFixture(this.fixtures.commitEpochTxFixture);

      const storedEpoch = await systemValidatorSet.getEpochByBlock(128);

      expect(storedEpoch.startBlock).to.equal(hre.ethers.constants.Zero);
      expect(storedEpoch.endBlock).to.equal(hre.ethers.constants.Zero);
      expect(storedEpoch.epochRoot).to.equal(hre.ethers.constants.HashZero);
    });

    describe("Whitelist", function () {
      it("should be modified only by the owner", async function () {
        const { validatorSet } = await loadFixture(this.fixtures.initializedValidatorSetStateFixture);

        await expect(
          validatorSet.connect(this.signers.validators[0]).addToWhitelist([this.signers.validators[0].address]),
          "addToWhitelist"
        ).to.be.revertedWith("Ownable: caller is not the owner");

        await expect(
          validatorSet.connect(this.signers.validators[0]).removeFromWhitelist([this.signers.validators[0].address]),
          "removeFromWhitelist"
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("should be able to add to whitelist", async function () {
        const { validatorSet } = await loadFixture(this.fixtures.initializedValidatorSetStateFixture);

        await expect(
          validatorSet
            .connect(this.signers.governance)
            .addToWhitelist([this.signers.validators[0].address, this.signers.validators[1].address])
        ).to.not.be.reverted;

        expect((await validatorSet.validators(this.signers.validators[0].address)).whitelisted).to.be.true;
        expect((await validatorSet.validators(this.signers.validators[1].address)).whitelisted).to.be.true;
      });

      it("should be able to remove from whitelist", async function () {
        const { validatorSet } = await loadFixture(this.fixtures.initializedValidatorSetStateFixture);

        await expect(
          validatorSet.connect(this.signers.governance).removeFromWhitelist([this.signers.validators[3].address])
        ).to.not.be.reverted;

        expect((await validatorSet.validators(this.signers.validators[1].address)).whitelisted).to.be.false;
      });
    });

    describe("Register", function () {
      it("should be able to register only whitelisted", async function () {
        const { validatorSet } = await loadFixture(this.fixtures.whitelistedValidatorsStateFixture);

        await expect(validatorSet.connect(this.signers.accounts[10]).register([0, 0], [0, 0, 0, 0]))
          .to.be.revertedWithCustomError(validatorSet, "Unauthorized")
          .withArgs("WHITELIST");
      });

      it("should not be able to register with invalid signature", async function () {
        const { validatorSet } = await loadFixture(this.fixtures.whitelistedValidatorsStateFixture);

        const keyPair = mcl.newKeyPair();
        const signature = mcl.signValidatorMessage(
          DOMAIN,
          CHAIN_ID,
          this.signers.accounts[10].address,
          keyPair.secret
        ).signature;

        await expect(
          validatorSet.connect(this.signers.validators[1]).register(mcl.g1ToHex(signature), mcl.g2ToHex(keyPair.pubkey))
        )
          .to.be.revertedWithCustomError(validatorSet, "InvalidSignature")
          .withArgs(this.signers.validators[1].address);
      });

      it("should register", async function () {
        const { validatorSet } = await loadFixture(this.fixtures.whitelistedValidatorsStateFixture);

        expect((await validatorSet.validators(this.signers.validators[0].address)).whitelisted, "whitelisted = true").to
          .be.true;

        const keyPair = mcl.newKeyPair();
        const signature = mcl.signValidatorMessage(
          DOMAIN,
          CHAIN_ID,
          this.signers.validators[0].address,
          keyPair.secret
        ).signature;

        const tx = await validatorSet
          .connect(this.signers.validators[0])
          .register(mcl.g1ToHex(signature), mcl.g2ToHex(keyPair.pubkey));

        await expect(tx, "emit NewValidator")
          .to.emit(validatorSet, "NewValidator")
          .withArgs(
            this.signers.validators[0].address,
            mcl.g2ToHex(keyPair.pubkey).map((x) => hre.ethers.BigNumber.from(x))
          );

        expect((await validatorSet.validators(this.signers.validators[0].address)).whitelisted, "whitelisted = false")
          .to.be.false;
        const validator = await validatorSet.getValidator(this.signers.validators[0].address);

        expect(validator.stake, "stake").to.equal(0);
        expect(validator.totalStake, "total stake").to.equal(0);
        expect(validator.commission).to.equal(0);
        expect(validator.active).to.equal(true);
        expect(validator.blsKey.map((x: any) => x.toHexString())).to.deep.equal(mcl.g2ToHex(keyPair.pubkey));
      });

      it("should revert when attempt to register twice", async function () {
        // * Only the first two validators are being registered
        const { validatorSet } = await loadFixture(this.fixtures.registeredValidatorsStateFixture);

        expect((await validatorSet.validators(this.signers.validators[0].address)).active, "active = true").to.be.true;

        const keyPair = mcl.newKeyPair();
        const signature = mcl.signValidatorMessage(
          DOMAIN,
          CHAIN_ID,
          this.signers.validators[0].address,
          keyPair.secret
        ).signature;

        await expect(
          validatorSet
            .connect(this.signers.validators[0])
            .register(mcl.g1ToHex(signature), mcl.g2ToHex(keyPair.pubkey)),
          "register"
        )
          .to.be.revertedWithCustomError(validatorSet, "AlreadyRegistered")
          .withArgs(this.signers.validators[0].address);
      });
    });

    describe("Staking", function () {
      RunStakingTests();
    });

    describe("Withdraw", function () {
      it("should fail the withdrawal", async function () {
        const { validatorSet } = await loadFixture(this.fixtures.withdrawableFixture);

        const validator = await validatorSet.getValidator(this.signers.validators[0].address);
        const balanceAfterUnstake = this.minStake.mul(2).sub(this.minStake.div(2));
        expect(validator.stake, "validator stake").to.equal(balanceAfterUnstake);

        await setBalance(validatorSet.address, 0);
        const balance = await hre.ethers.provider.getBalance(validatorSet.address);
        expect(balance, "ValidatorSet balance").to.equal(0);

        await expect(
          validatorSet.connect(this.signers.validators[0]).withdraw(this.signers.validators[0].address)
        ).to.be.revertedWith("WITHDRAWAL_FAILED");
      });

      it("should withdraw", async function () {
        const { validatorSet } = await loadFixture(this.fixtures.withdrawableFixture);

        const unstakedAmount = this.minStake.div(2);

        await expect(
          validatorSet.connect(this.signers.validators[0]).withdraw(this.signers.validators[0].address),
          "withdraw"
        )
          .to.emit(validatorSet, "WithdrawalFinished")
          .withArgs(this.signers.validators[0].address, this.signers.validators[0].address, unstakedAmount);
        expect(
          await validatorSet.pendingWithdrawals(this.signers.validators[0].address),
          "pendingWithdrawals"
        ).to.equal(0);
        expect(await validatorSet.withdrawable(this.signers.validators[0].address), "withdrawable").to.equal(0);
      });
    });

    describe("Delegation", function () {
      RunDelegationTests();
    });

    describe("Set Commision", function () {
      it("should revert when call setCommission for inactive validator", async function () {
        const { validatorSet } = await loadFixture(this.fixtures.withdrawableFixture);

        await expect(validatorSet.connect(this.signers.validators[3]).setCommission(MAX_COMMISSION))
          .to.be.revertedWithCustomError(validatorSet, "Unauthorized")
          .withArgs("VALIDATOR");
      });

      it("should revert with invalid commission", async function () {
        const { validatorSet } = await loadFixture(this.fixtures.withdrawableFixture);

        await expect(
          validatorSet.connect(this.signers.validators[0]).setCommission(MAX_COMMISSION.add(1))
        ).to.be.revertedWith("INVALID_COMMISSION");
      });

      it("should set commission", async function () {
        const { validatorSet } = await loadFixture(this.fixtures.withdrawableFixture);

        await validatorSet.connect(this.signers.validators[0]).setCommission(MAX_COMMISSION.div(2));

        const validator = await validatorSet.getValidator(this.signers.validators[0].address);
        expect(validator.commission).to.equal(MAX_COMMISSION.div(2));
      });
    });
  });
});
