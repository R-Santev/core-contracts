/* eslint-disable node/no-extraneous-import */
import { loadFixture, setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import * as hre from "hardhat";

import * as mcl from "../../../ts/mcl";
import { Fixtures, Signers } from "../mochaContext";
import { CHAIN_ID, DOMAIN, MAX_COMMISSION, SYSTEM } from "../constants";
import { generateFixtures } from "../fixtures";
import { getMaxEpochReward, initValidators } from "../helper";
import { RunSystemTests } from "./System.test";
import { RunStakingTests } from "./Staking.test";

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
      const { validatorSet } = await loadFixture(this.fixtures.presetValidatorSetStateFixture);

      expect(validatorSet.deployTransaction.from).to.equal(this.signers.admin.address);
      expect(await validatorSet.minStake()).to.equal(0);
      expect(await validatorSet.minDelegation()).to.equal(0);
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

      const epochId = await systemValidatorSet.currentEpochId();
      expect(await systemValidatorSet.totalSupplyAt(epochId)).to.equal(0);

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
      const epochId = await systemValidatorSet.currentEpochId();

      expect(await systemValidatorSet.totalSupplyAt(epochId), "totalSupply").to.equal(0);
    });

    it("should initialize successfully", async function () {
      const { systemValidatorSet, bls } = await loadFixture(this.fixtures.initializedValidatorSetStateFixture);

      expect(await systemValidatorSet.minStake(), "minStake").to.equal(this.minStake);
      expect(await systemValidatorSet.minDelegation(), "minDelegation").to.equal(this.minDelegation);
      expect(await systemValidatorSet.currentEpochId(), "currentEpochId").to.equal(1);
      expect(await systemValidatorSet.owner(), "owner").to.equal(this.signers.governance.address);

      const adminAddress = this.signers.admin.address;
      const validator = await systemValidatorSet.getValidator(adminAddress);

      expect(
        validator.blsKey.map((x) => x.toHexString()),
        "blsKey"
      ).to.deep.equal(this.validatorInit.pubkey);
      expect(await systemValidatorSet.balanceOf(adminAddress), "balanceOf").to.equal(this.minStake.mul(2));
      expect(await systemValidatorSet.totalDelegationOf(adminAddress), "totalDelegationOf").to.equal(
        this.minStake.mul(2)
      );
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

      const maxReward = await getMaxEpochReward(validatorSet, this.epochId);
      await expect(validatorSet.commitEpoch(this.epochId, this.epoch, this.epochSize, { value: maxReward }))
        .to.be.revertedWithCustomError(validatorSet, "Unauthorized")
        .withArgs("SYSTEMCALL");
    });

    it("should revert with unexpected epoch id", async function () {
      const { systemValidatorSet } = await loadFixture(this.fixtures.initializedValidatorSetStateFixture);
      const unexpectedEpochId = hre.ethers.utils.parseEther("1");

      const maxReward = await getMaxEpochReward(systemValidatorSet, this.epochId);

      await expect(
        systemValidatorSet.commitEpoch(unexpectedEpochId, this.epoch, this.epochSize, { value: maxReward })
      ).to.be.revertedWith("UNEXPECTED_EPOCH_ID");
    });

    it("should revert with no blocks committed", async function () {
      const { systemValidatorSet } = await loadFixture(this.fixtures.initializedValidatorSetStateFixture);

      this.epoch.startBlock = hre.ethers.BigNumber.from(0);
      this.epoch.endBlock = hre.ethers.BigNumber.from(0);
      const maxReward = await getMaxEpochReward(systemValidatorSet, this.epochId);
      await expect(
        systemValidatorSet.commitEpoch(this.epochId, this.epoch, this.epochSize, { value: maxReward })
      ).to.be.revertedWith("NO_BLOCKS_COMMITTED");
    });

    it("should revert that epoch is not divisible by epochSize", async function () {
      const { systemValidatorSet } = await loadFixture(this.fixtures.initializedValidatorSetStateFixture);

      // * commitEpoch checks for (epoch.endBlock - epoch.startBlock + 1) % epochSize === 0
      this.epoch.startBlock = hre.ethers.BigNumber.from(1);
      this.epoch.endBlock = hre.ethers.BigNumber.from(63);

      const maxReward = await getMaxEpochReward(systemValidatorSet, this.epochId);
      await expect(
        systemValidatorSet.commitEpoch(this.epochId, this.epoch, this.epochSize, { value: maxReward })
      ).to.be.revertedWith("EPOCH_MUST_BE_DIVISIBLE_BY_EPOCH_SIZE");
    });

    it("should revert with invalid start block", async function () {
      const { systemValidatorSet } = await loadFixture(this.fixtures.initializedValidatorSetStateFixture);

      // * commitEpoch checks for (epoch.endBlock - epoch.startBlock + 1) % epochSize === 0
      this.epoch.startBlock = hre.ethers.BigNumber.from(3);
      this.epoch.endBlock = hre.ethers.BigNumber.from(64);
      this.epochSize = hre.ethers.BigNumber.from(62);

      const maxReward = await getMaxEpochReward(systemValidatorSet, this.epochId);
      await expect(
        systemValidatorSet.commitEpoch(this.epochId, this.epoch, this.epochSize, { value: maxReward })
      ).to.be.revertedWith("INVALID_START_BLOCK");
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

    it("should all active validators - admin", async function () {
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

    // TODO: Get to know how the delegate should work and implement it in the contracts first
    // describe.skip("Delegate", function () {
    //   it("should only be able to delegate to validators", async function () {
    //     // const { validatorSet } = await loadFixture(this.fixtures.stakedValidatorsStateFixture);
    //     // const restake = false;
    //     // await expect(validatorSet.delegate(this.signers.validators[1], restake, { value: this.minDelegation }))
    //     //   .to.be.revertedWithCustomError(validatorSet, "Unauthorized")
    //     //   .withArgs("INVALID_VALIDATOR");
    //   });

    //   it("Delegate less amount than minDelegation", async function () {
    //     // const { validatorSet } = await loadFixture(this.fixtures.stakedValidatorsStateFixture);
    //     // const restake = false;
    //     // await expect(validatorSet.delegate(this.signers.validators[0].address, restake, { value: 100 }))
    //     //   .to.be.revertedWithCustomError(validatorSet, "StakeRequirement")
    //     //   .withArgs("delegate", "DELEGATION_TOO_LOW");
    //   });

    //   it("Delegate for the first time", async function () {
    //     // const { validatorSet } = await loadFixture(this.fixtures.stakedValidatorsStateFixture);
    //     // const delegateAmount = this.minDelegation.add(1);
    //     // const restake = false;
    //     // // Register accounts[10] as validator
    //     // await validatorSet.addToWhitelist([this.signers.accounts[10].address]);
    //     // const keyPair = mcl.newKeyPair();
    //     // const signature = mcl.signValidatorMessage(
    //     //   DOMAIN,
    //     //   CHAIN_ID,
    //     //   this.signers.accounts[10].address,
    //     //   keyPair.secret
    //     // ).signature;
    //     // await validatorSet
    //     //   .connect(this.signers.accounts[10])
    //     //   .register(mcl.g1ToHex(signature), mcl.g2ToHex(keyPair.pubkey));
    //     // await validatorSet.connect(this.signers.accounts[10]).stake({ value: this.minStake });
    //     // const tx = await validatorSet
    //     //   .connect(this.signers.accounts[11])
    //     //   .delegate(this.signers.accounts[10].address, restake, {
    //     //     value: delegateAmount,
    //     //   });
    //     // await expect(tx)
    //     //   .to.emit(validatorSet, "Delegated")
    //     //   .withArgs(this.signers.validators[11].address, this.signers.validators[10].address, delegateAmount);
    //     // const delegation = await validatorSet.delegationOf(
    //     //   this.signers.accounts[10].address,
    //     //   this.signers.accounts[11].address
    //     // );
    //     // expect(delegation).to.equal(delegateAmount);
    //   });

    //   it("Delegate again without restake", async function () {
    //     // const { validatorSet } = await loadFixture(this.fixtures.stakedValidatorsStateFixture);
    //     // const delegateAmount = this.minDelegation.add(1);
    //     // const restake = false;
    //     // const tx = await validatorSet
    //     //   .connect(this.signers.accounts[11])
    //     //   .delegate(this.signers.accounts[10].address, restake, {
    //     //     value: delegateAmount,
    //     //   });
    //     // await expect(tx)
    //     //   .to.emit(validatorSet, "Delegated")
    //     //   .withArgs(this.signers.accounts[11].address, this.signers.accounts[10].address, delegateAmount);
    //   });

    //   it("Delegate again with restake", async function () {
    //     // const { validatorSet } = await loadFixture(this.fixtures.stakedValidatorsStateFixture);
    //     // const delegateAmount = hre.ethers.utils.parseEther("1");
    //     // const restake = true;
    //     // const tx = await validatorSet
    //     //   .connect(this.signers.accounts[11])
    //     //   .delegate(this.signers.accounts[10].address, restake, {
    //     //     value: delegateAmount,
    //     //   });
    //     // await expect(tx)
    //     //   .to.emit(validatorSet, "Delegated")
    //     //   .withArgs(this.signers.accounts[11].address, this.signers.accounts[10].address, delegateAmount);
    //   });
    // });

    // describe.skip("Claim", function () {
    //   it("should claim validator reward", async function () {
    //     const { validatorSet, rewardPool } = await loadFixture(this.fixtures.stakedValidatorsStateFixture);

    //     await rewardPool
    //       .connect(this.signers.system)
    //       .distributeRewardsFor(this.epochId, this.epoch, this.uptime, this.epochSize);
    //     const reward = await rewardPool.getValidatorReward(this.signers.validators[0].address);
    //     const tx = await rewardPool["claimValidatorReward()"]();

    //     const receipt = await tx.wait();
    //     const event = receipt.events?.find((log) => log.event === "ValidatorRewardClaimed");
    //     expect(event?.args?.validator).to.equal(this.signers.validators[0].address);
    //     expect(event?.args?.amount).to.equal(reward);

    //     await expect(tx)
    //       .to.emit(validatorSet, "WithdrawalRegistered")
    //       .withArgs(this.signers.validators[0].address, reward);
    //   });

    //   it("Claim delegatorReward with restake", async () => {
    //     let maxReward = await getMaxEpochReward(childValidatorSet);

    //     await expect(
    //       systemChildValidatorSet.commitEpoch(
    //         5,
    //         { startBlock: 257, endBlock: 320, epochRoot: ethers.constants.HashZero },
    //         {
    //           epochId: 5,
    //           uptimeData: [{ validator: accounts[2].address, signedBlocks: 1 }],
    //           totalBlocks: 2,
    //         },
    //         { value: maxReward }
    //       )
    //     ).to.not.be.reverted;

    //     maxReward = await getMaxEpochReward(childValidatorSet);
    //     await expect(
    //       systemChildValidatorSet.commitEpoch(
    //         6,
    //         { startBlock: 321, endBlock: 384, epochRoot: ethers.constants.HashZero },
    //         {
    //           epochId: 6,
    //           uptimeData: [{ validator: accounts[2].address, signedBlocks: 1 }],
    //           totalBlocks: 2,
    //         },
    //         { value: maxReward }
    //       )
    //     ).to.not.be.reverted;

    //     const reward = await childValidatorSet.getDelegatorReward(accounts[2].address, accounts[3].address);

    //     // Claim with restake
    //     const tx = await childValidatorSet.connect(accounts[3]).claimDelegatorReward(accounts[2].address, true);

    //     const receipt = await tx.wait();
    //     const event = receipt.events?.find((log) => log.event === "DelegatorRewardClaimed");
    //     expect(event?.args?.delegator).to.equal(accounts[3].address);
    //     expect(event?.args?.validator).to.equal(accounts[2].address);
    //     expect(event?.args?.restake).to.equal(true);
    //     expect(event?.args?.amount).to.equal(reward);

    //     await expect(tx)
    //       .to.emit(childValidatorSet, "Delegated")
    //       .withArgs(accounts[3].address, accounts[2].address, reward);
    //   });

    //   it("Claim delegatorReward without restake", async () => {
    //     let maxReward = await getMaxEpochReward(childValidatorSet);
    //     await expect(
    //       systemChildValidatorSet.commitEpoch(
    //         7,
    //         { startBlock: 385, endBlock: 448, epochRoot: ethers.constants.HashZero },
    //         {
    //           epochId: 7,
    //           uptimeData: [{ validator: accounts[2].address, signedBlocks: 1 }],
    //           totalBlocks: 2,
    //         },
    //         { value: maxReward }
    //       )
    //     ).to.not.be.reverted;

    //     maxReward = await getMaxEpochReward(childValidatorSet);
    //     await expect(
    //       systemChildValidatorSet.commitEpoch(
    //         8,
    //         { startBlock: 449, endBlock: 512, epochRoot: ethers.constants.HashZero },
    //         {
    //           epochId: 8,
    //           uptimeData: [{ validator: accounts[2].address, signedBlocks: 1 }],
    //           totalBlocks: 2,
    //         },
    //         { value: maxReward }
    //       )
    //     ).to.not.be.reverted;

    //     const reward = await childValidatorSet.getDelegatorReward(accounts[2].address, accounts[3].address);
    //     // Claim without restake
    //     const tx = await childValidatorSet.connect(accounts[3]).claimDelegatorReward(accounts[2].address, false);

    //     const receipt = await tx.wait();
    //     const event = receipt.events?.find((log) => log.event === "DelegatorRewardClaimed");
    //     expect(event?.args?.delegator).to.equal(accounts[3].address);
    //     expect(event?.args?.validator).to.equal(accounts[2].address);
    //     expect(event?.args?.restake).to.equal(false);
    //     expect(event?.args?.amount).to.equal(reward);

    //     await expect(tx).to.emit(childValidatorSet, "WithdrawalRegistered").withArgs(accounts[3].address, reward);
    //   });
    // });

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

    // TODO: finish these when implement the delegation and vesting in the new contracts
    // describe.skip("Delegation Vesting", async () => {
    //   let VestManagerFactory: VestManager__factory;
    //   let vestManager: VestManager;

    //   before(async () => {
    //     VestManagerFactory = await ethers.getContractFactory("VestManager");
    //     await childValidatorSet.connect(accounts[4]).newManager();

    //     const tx = await childValidatorSet.connect(accounts[4]).newManager();
    //     const receipt = await tx.wait();
    //     const event = receipt.events?.find((e) => e.event === "NewClone");
    //     const address = event?.args?.newClone;
    //     vestManager = VestManagerFactory.attach(address);
    //   });

    //   it("Should already create a base implementation", async () => {
    //     const baseImplementation = await childValidatorSet.implementation();

    //     expect(baseImplementation).to.not.equal(ethers.constants.AddressZero);
    //   });

    //   describe("newManager()", async () => {
    //     it("reverts when zero address", async () => {
    //       const zeroAddress = ethers.constants.AddressZero;
    //       await impersonateAccount(zeroAddress);
    //       const zeroAddrSigner = await ethers.getSigner(zeroAddress);

    //       await expect(childValidatorSet.connect(zeroAddrSigner).newManager()).to.be.revertedWith("INVALID_OWNER");
    //     });

    //     it("create manager", async () => {
    //       const tx = await childValidatorSet.connect(accounts[5]).newManager();
    //       const receipt = await tx.wait();
    //       const event = receipt.events?.find((e) => e.event === "NewClone");
    //       const address = event?.args?.newClone;

    //       expect(address).to.not.equal(ethers.constants.AddressZero);
    //     });

    //     describe("Vesting Manager Factory", async () => {
    //       it("initialize manager", async () => {
    //         expect(await vestManager.owner()).to.equal(accounts[4].address);
    //         expect(await vestManager.staking()).to.equal(childValidatorSet.address);
    //       });
    //     });

    //     it("set manager in mappings", async () => {
    //       expect(await childValidatorSet.vestManagers(vestManager.address)).to.equal(accounts[4].address);
    //       expect(await childValidatorSet.userVestManagers(accounts[4].address, 1)).to.equal(vestManager.address);
    //       expect((await childValidatorSet.getUserVestManagers(accounts[4].address)).length).to.equal(2);
    //     });
    //   });

    //   describe("openDelegatorPosition()", async () => {
    //     it("reverts when not manager", async () => {
    //       await expect(
    //         childValidatorSet.connect(accounts[3]).openDelegatorPosition(accounts[3].address, 1)
    //       ).to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement");
    //     });

    //     it("reverts when delegation too low", async () => {
    //       await expect(vestManager.connect(accounts[4]).openDelegatorPosition(accounts[2].address, minStake.sub(1)))
    //         .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
    //         .withArgs("vesting", "DELEGATION_TOO_LOW");
    //     });

    //     it("should properly open vesting position", async () => {
    //       const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
    //       const validator = accounts[2].address;
    //       const vestingDuration = 52; // in weeks

    //       await expect(
    //         await manager.openDelegatorPosition(validator, vestingDuration, {
    //           value: minDelegation,
    //         })
    //       ).to.not.be.reverted;

    //       // Commit epochs so rewards to be distributed
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);
    //     });

    //     it("Should revert when active position", async () => {
    //       const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
    //       const validator = accounts[2].address;
    //       const vestingDuration = 52; // in weeks

    //       await expect(
    //         manager.openDelegatorPosition(validator, vestingDuration, {
    //           value: minDelegation,
    //         })
    //       )
    //         .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
    //         .withArgs("vesting", "POSITION_ACTIVE");
    //     });

    //     it("Should revert when maturing position", async () => {
    //       // enter the reward maturity phase
    //       await time.increase(week * 55);

    //       const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
    //       const validator = accounts[2].address;
    //       const vestingDuration = 52; // in weeks

    //       await expect(
    //         manager.openDelegatorPosition(validator, vestingDuration, {
    //           value: minDelegation,
    //         })
    //       )
    //         .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
    //         .withArgs("vesting", "POSITION_MATURING");
    //     });

    //     it("reverts when reward not claimed", async () => {
    //       // enter the matured phase
    //       await time.increase(week * 55);

    //       const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
    //       const validator = accounts[2].address;
    //       const vestingDuration = 52; // in weeks
    //       const currentReward = await childValidatorSet.getDelegatorReward(accounts[2].address, manager.address);
    //       expect(currentReward).to.gt(0);

    //       await expect(
    //         manager.openDelegatorPosition(validator, vestingDuration, {
    //           value: minDelegation,
    //         })
    //       )
    //         .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
    //         .withArgs("vesting", "REWARDS_NOT_CLAIMED");
    //     });
    //   });

    //   describe("cutPosition", async () => {
    //     it("revert when insufficient balance", async () => {
    //       const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
    //       const validator = accounts[2].address;
    //       const balance = await childValidatorSet.delegationOf(validator, manager.address);

    //       // send one more token so liquid tokens balance is enough
    //       await childValidatorSet.connect(accounts[7]).newManager();
    //       const user2 = accounts[7];
    //       const manager2 = await getUserManager(childValidatorSet, user2, VestManagerFactory);
    //       await manager2.openDelegatorPosition(validator, 1, {
    //         value: minDelegation,
    //       });
    //       await liquidToken.connect(user2).transfer(accounts[4].address, 1);

    //       const balanceToCut = balance.add(1);
    //       await liquidToken.connect(accounts[4]).approve(manager.address, balanceToCut);
    //       await expect(manager.cutPosition(validator, balanceToCut))
    //         .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
    //         .withArgs("vesting", "INSUFFICIENT_BALANCE");
    //     });

    //     it("revert when delegation too low", async () => {
    //       const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
    //       const validator = accounts[2].address;
    //       const balance = await childValidatorSet.delegationOf(validator, manager.address);

    //       const amountToCut = balance.sub(1);
    //       await liquidToken.connect(accounts[4]).approve(manager.address, amountToCut);
    //       await expect(manager.cutPosition(validator, amountToCut))
    //         .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
    //         .withArgs("vesting", "DELEGATION_TOO_LOW");
    //     });

    //     it("slashes the amount when active position", async () => {
    //       const user = accounts[4];
    //       const validator = accounts[2].address;
    //       const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
    //       const vestingDuration = 52; // in weeks

    //       await claimRewards(childValidatorSet, manager, validator);

    //       await manager.openDelegatorPosition(validator, vestingDuration, {
    //         value: minDelegation,
    //       });
    //       const position = await childValidatorSet.vestings(validator, manager.address);

    //       // clear pending withdrawals
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);
    //       await manager.withdraw(user.address);

    //       // ensure position is active
    //       const isActive = await isActivePosition(childValidatorSet, validator, manager);
    //       expect(isActive).to.be.true;

    //       // check is amount properly removed from delegation
    //       const delegatedBalanceBefore = await childValidatorSet.delegationOf(validator, manager.address);
    //       const cutAmount = delegatedBalanceBefore.div(2);
    //       const amountToBeBurned = cutAmount.div(2);

    //       // Hydra TODO: Create table-driven unit tests with precalculated values to test the exact amounts
    //       // check if amount is properly burned
    //       // const end = position.end;
    //       // const rpsValues = await childValidatorSet.getRPSValues(validator);
    //       // const epochNum = findProperRPSIndex(rpsValues, end);
    //       // const topUpIndex = 0;

    //       // let reward = await childValidatorSet.getDelegatorPositionReward(
    //       //   validator,
    //       //   manager.address,
    //       //   epochNum,
    //       //   topUpIndex
    //       // );
    //       // reward = await childValidatorSet.applyMaxReward(reward);
    //       // const decrease = reward.add(amountToBeBurned);
    //       // await expect(manager.cutPosition(validator, cutAmount)).to.changeEtherBalance(
    //       //   childValidatorSet,
    //       //   decrease.mul(-1)
    //       // );

    //       await liquidToken.connect(accounts[4]).approve(manager.address, cutAmount);

    //       // set next block timestamp so half of the vesting period passed
    //       const nextBlockTimestamp = position.duration.div(2).add(position.start);
    //       await time.setNextBlockTimestamp(nextBlockTimestamp);

    //       await manager.cutPosition(validator, cutAmount);

    //       const delegatedBalanceAfter = await childValidatorSet.delegationOf(validator, manager.address);
    //       expect(delegatedBalanceAfter).to.be.eq(delegatedBalanceBefore.sub(cutAmount));

    //       // claimableRewards must be 0
    //       const claimableRewards = await childValidatorSet.getDelegatorReward(validator, manager.address);
    //       expect(claimableRewards).to.be.eq(0);

    //       // check if amount is properly slashed
    //       const balanceBefore = await user.getBalance();
    //       // commit Epoch so reward is available for withdrawal
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);
    //       await manager.withdraw(user.address);

    //       const balanceAfter = await user.getBalance();

    //       // cut half of the requested amount because half of the vesting period is still not passed
    //       expect(balanceAfter.sub(balanceBefore)).to.be.eq(amountToBeBurned);
    //     });

    //     it("should properly cut position", async () => {
    //       const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
    //       const validator = accounts[2].address;

    //       // commit Epoch so reward is made
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);

    //       const reward = await childValidatorSet.getRawDelegatorReward(validator, manager.address);

    //       // Finish the vesting period
    //       await time.increase(week * 27);

    //       // ensure position is inactive
    //       const isActive = await isActivePosition(childValidatorSet, validator, manager);
    //       expect(isActive).to.be.false;

    //       const balanceBefore = await accounts[4].getBalance();
    //       const delegatedAmount = await childValidatorSet.delegationOf(validator, manager.address);
    //       await liquidToken.connect(accounts[4]).approve(manager.address, delegatedAmount);
    //       await manager.cutPosition(accounts[2].address, delegatedAmount);

    //       // Commit one more epoch so withdraw to be available
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);
    //       await manager.withdraw(accounts[4].address);

    //       const balanceAfter = await accounts[4].getBalance();

    //       expect(balanceAfter).to.be.eq(balanceBefore.add(delegatedAmount));

    //       // check is amount properly removed from delegation
    //       expect(await childValidatorSet.delegationOf(validator, manager.address)).to.be.eq(0);

    //       // ensure reward is still available for withdrawal
    //       const rewardAfter = await childValidatorSet.getRawDelegatorReward(validator, manager.address);
    //       expect(rewardAfter).to.be.eq(reward);
    //     });

    //     it("should delete position when closing it", async () => {
    //       const user2 = accounts[5];
    //       const validator = accounts[2].address;
    //       const manager2 = await getUserManager(childValidatorSet, user2, VestManagerFactory);

    //       await manager2.openDelegatorPosition(validator, 1, {
    //         value: minDelegation,
    //       });

    //       // cut position
    //       const delegatedAmount = await childValidatorSet.delegationOf(validator, manager2.address);
    //       await liquidToken.connect(accounts[5]).approve(manager2.address, delegatedAmount);
    //       await manager2.cutPosition(validator, delegatedAmount);
    //       expect((await childValidatorSet.vestings(validator, manager2.address)).start).to.be.eq(0);
    //     });
    //   });

    //   describe("topUpPosition()", async () => {
    //     it("reverts when not manager", async () => {
    //       await expect(
    //         childValidatorSet.connect(accounts[3]).topUpPosition(accounts[3].address, { value: minDelegation })
    //       )
    //         .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
    //         .withArgs("vesting", "NOT_MANAGER");
    //     });

    //     it("reverts when delegation too low", async () => {
    //       const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
    //       const validator = accounts[2].address;

    //       await expect(manager.topUpPosition(validator, { value: minDelegation.sub(1) }))
    //         .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
    //         .withArgs("vesting", "DELEGATION_TOO_LOW");
    //     });

    //     it("reverts when position is not active", async () => {
    //       // enter the reward maturity phase
    //       const week = 60 * 60 * 24 * 7;
    //       await time.increase(week * 55);

    //       const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
    //       const validator = accounts[2].address;

    //       await expect(manager.topUpPosition(validator, { value: minDelegation }))
    //         .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
    //         .withArgs("vesting", "POSITION_NOT_ACTIVE");
    //     });

    //     it("properly top-up position", async () => {
    //       const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
    //       const validator = accounts[2].address;
    //       const duration = 1; // 1 week

    //       // claim rewards to be able to recreate position
    //       await claimRewards(childValidatorSet, manager, validator);

    //       // create position with the same validator and manager, because the old one is finished
    //       await manager.openDelegatorPosition(validator, duration, { value: minDelegation });
    //       const vestingEndBefore = (await childValidatorSet.vestings(validator, manager.address)).end;

    //       // enter the active state
    //       await time.increase(1);
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);

    //       expect(await isActivePosition(childValidatorSet, validator, manager)).to.be.true;

    //       const delegatedAmount = await childValidatorSet.delegationOf(validator, manager.address);
    //       const topUpAmount = minDelegation.div(2);
    //       const totalAmount = delegatedAmount.add(topUpAmount);

    //       await manager.topUpPosition(validator, { value: topUpAmount });

    //       // delegation is increased
    //       expect(await childValidatorSet.delegationOf(validator, manager.address)).to.be.eq(totalAmount);

    //       // balance change data is added
    //       const balanceChange = await childValidatorSet.poolParamsChanges(validator, manager.address, 1);
    //       expect(balanceChange.balance).to.be.eq(totalAmount);
    //       expect(balanceChange.epochNum).to.be.eq(await childValidatorSet.currentEpochId());

    //       // duration increase is proper
    //       const vestingEndAfter = (await childValidatorSet.vestings(validator, manager.address)).end;
    //       expect(vestingEndAfter).to.be.eq(vestingEndBefore.add((duration * week) / 2));
    //     });

    //     it("reverts when top-up already made in the same epoch", async () => {
    //       const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
    //       const validator = accounts[2].address;

    //       await expect(manager.topUpPosition(validator, { value: 1 }))
    //         .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
    //         .withArgs("vesting", "TOPUP_ALREADY_MADE");
    //     });

    //     it("increase duration no more than 100%", async () => {
    //       // otherwise new top up can't be made
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);

    //       const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
    //       const validator = accounts[2].address;

    //       const vestingEndBefore = (await childValidatorSet.vestings(validator, manager.address)).end;
    //       const duration = (await childValidatorSet.vestings(validator, manager.address)).duration;

    //       const topUpAmount = (await childValidatorSet.delegationOf(validator, manager.address)).mul(2);
    //       await manager.topUpPosition(validator, { value: topUpAmount.add(minDelegation) });

    //       const vestingEndAfter = (await childValidatorSet.vestings(validator, manager.address)).end;
    //       expect(vestingEndAfter).to.be.eq(vestingEndBefore.add(duration));
    //     });

    //     it("reverts when top-up closed position", async () => {
    //       const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
    //       const validator = accounts[2].address;

    //       // close position
    //       const delegatedAmount = await childValidatorSet.delegationOf(validator, manager.address);
    //       await liquidToken.connect(accounts[4]).approve(manager.address, delegatedAmount);
    //       await manager.cutPosition(validator, delegatedAmount);
    //       // top-up
    //       await expect(manager.topUpPosition(validator, { value: minDelegation }))
    //         .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
    //         .withArgs("vesting", "POSITION_NOT_ACTIVE");
    //     });
    //   });

    //   describe("claimPositionReward()", async () => {
    //     async function setupManagerFixture() {
    //       await childValidatorSet.connect(accounts[6]).newManager();
    //       const user = accounts[6];
    //       const manager = await getUserManager(childValidatorSet, user, VestManagerFactory);
    //       const validator = accounts[2].address;
    //       const duration = 1; // 1 week
    //       await manager.openDelegatorPosition(validator, duration, { value: minDelegation });
    //       // commit epoch, so reward is mined
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);

    //       return { user, manager, validator };
    //     }

    //     it("reverts when not manager", async () => {
    //       const validator = accounts[2].address;

    //       await expect(childValidatorSet.connect(accounts[3]).claimPositionReward(validator, 0, 0))
    //         .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
    //         .withArgs("vesting", "NOT_MANAGER");
    //     });

    //     it("returns when active position", async () => {
    //       // create position with the same validator and manager, because the old one is finished
    //       const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
    //       const validator = accounts[2].address;
    //       const duration = 1; // 1 week
    //       await manager.openDelegatorPosition(validator, duration, { value: ethers.utils.parseEther("100") });
    //       // enter the active state
    //       await time.increase(1);
    //       // ensure is active position
    //       expect(await isActivePosition(childValidatorSet, validator, manager)).to.be.true;

    //       // reward to be accumulated
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);
    //       // withdraw previous amounts
    //       await manager.withdraw(accounts[4].address);

    //       expect(await childValidatorSet.getRawDelegatorReward(validator, manager.address)).to.be.gt(0);
    //       // claim
    //       await manager.claimPositionReward(validator, 0, 0);
    //       expect(await childValidatorSet.withdrawable(manager.address)).to.be.eq(0);
    //     });

    //     it("returns when unused position", async () => {
    //       const validator = accounts[2].address;
    //       const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
    //       const delegation = await childValidatorSet.delegationOf(accounts[2].address, manager.address);
    //       // is position active
    //       expect(await isActivePosition(childValidatorSet, validator, manager)).to.be.true;
    //       await liquidToken.connect(accounts[4]).approve(manager.address, delegation);
    //       await manager.cutPosition(validator, delegation);
    //       // check reward
    //       expect(await childValidatorSet.getRawDelegatorReward(validator, manager.address)).to.be.eq(0);
    //       expect(await childValidatorSet.withdrawable(manager.address)).to.eq(0);
    //     });

    //     it("reverts when wrong rps index is provided", async () => {
    //       const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
    //       const validator = accounts[2].address;
    //       const duration = 1; // 1 week
    //       await manager.openDelegatorPosition(validator, duration, { value: minDelegation });
    //       // commit epoch
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);
    //       // enter the matured state
    //       await time.increase(2 * week);

    //       const position = await childValidatorSet.vestings(validator, manager.address);
    //       const end = position.end;
    //       const rpsValues = await childValidatorSet.getRPSValues(validator);
    //       const epochNum = findProperRPSIndex(rpsValues, end);
    //       const topUpIndex = 0;

    //       await expect(manager.claimPositionReward(validator, epochNum + 1, topUpIndex))
    //         .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
    //         .withArgs("vesting", "INVALID_EPOCH");

    //       // commit epoch
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);

    //       await expect(manager.claimPositionReward(validator, epochNum + 1, topUpIndex))
    //         .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
    //         .withArgs("vesting", "WRONG_RPS");
    //     });

    //     it("should properly claim reward when no top-ups and not full reward matured", async () => {
    //       const { user, manager, validator } = await loadFixture(setupManagerFixture);
    //       // calculate reward
    //       const baseReward = await childValidatorSet.getRawDelegatorReward(validator, manager.address);
    //       const base = await childValidatorSet.getBase();
    //       const vestBonus = await childValidatorSet.getVestingBonus(1);
    //       const rsi = await childValidatorSet.getRSI();
    //       const expectedReward = base
    //         .add(vestBonus)
    //         .mul(rsi)
    //         .mul(baseReward)
    //         .div(10000 * 10000)
    //         .div(epochsInYear);

    //       // calculate max reward
    //       const maxRSI = await childValidatorSet.getMaxRSI();
    //       const maxVestBonus = await childValidatorSet.getVestingBonus(52);
    //       const maxReward = base
    //         .add(maxVestBonus)
    //         .mul(maxRSI)
    //         .mul(baseReward)
    //         .div(10000 * 10000)
    //         .div(epochsInYear);

    //       // enter the maturing state
    //       await time.increase(1 * week + 1);

    //       // comit epoch, so more reward is added that must not be claimed now
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);

    //       // prepare params for call
    //       const position = await childValidatorSet.vestings(validator, manager.address);
    //       const end = position.end;
    //       const rpsValues = await childValidatorSet.getRPSValues(validator);
    //       const epochNum = findProperRPSIndex(rpsValues, end);
    //       // When there are no top ups, just set 0, because it is not actually checked
    //       const topUpIndex = 0;

    //       await expect(await manager.claimPositionReward(validator, epochNum, topUpIndex)).to.changeEtherBalances(
    //         [childValidatorSet.address, ethers.constants.AddressZero],
    //         [maxReward.sub(expectedReward).mul(-1), maxReward.sub(expectedReward)]
    //       );

    //       // Commit one more epoch so withdraw to be available
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);
    //       await expect(await manager.withdraw(user.address)).to.changeEtherBalances(
    //         [user.address, childValidatorSet.address],
    //         [expectedReward, expectedReward.mul(-1)]
    //       );
    //     });

    //     it("should properly claim reward when no top-ups and full reward matured", async () => {
    //       const { user, manager, validator } = await loadFixture(setupManagerFixture);
    //       // calculate reward
    //       const baseReward = await childValidatorSet.getRawDelegatorReward(validator, manager.address);
    //       const base = await childValidatorSet.getBase();
    //       const vestBonus = await childValidatorSet.getVestingBonus(1);
    //       const rsi = await childValidatorSet.getRSI();
    //       const expectedReward = base
    //         .add(vestBonus)
    //         .mul(rsi)
    //         .mul(baseReward)
    //         .div(10000 * 10000)
    //         .div(epochsInYear);

    //       // calculate max reward
    //       const maxRSI = await childValidatorSet.getMaxRSI();
    //       const maxVestBonus = await childValidatorSet.getVestingBonus(52);
    //       const maxReward = base
    //         .add(maxVestBonus)
    //         .mul(maxRSI)
    //         .mul(baseReward)
    //         .div(10000 * 10000)
    //         .div(epochsInYear);

    //       // enter the maturing state
    //       await time.increase(2 * week + 1);

    //       // comit epoch, so more reward is added that must be without bonus
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);

    //       const additionalReward = (await childValidatorSet.getRawDelegatorReward(validator, manager.address)).sub(
    //         baseReward
    //       );

    //       const expectedAdditionalReward = base.mul(additionalReward).div(10000).div(epochsInYear);

    //       const maxAdditionalReward = base
    //         .add(maxVestBonus)
    //         .mul(maxRSI)
    //         .mul(additionalReward)
    //         .div(10000 * 10000)
    //         .div(epochsInYear);

    //       // prepare params for call
    //       const position = await childValidatorSet.vestings(validator, manager.address);
    //       const end = position.end;
    //       const rpsValues = await childValidatorSet.getRPSValues(validator);
    //       const epochNum = findProperRPSIndex(rpsValues, end);
    //       // When there are no top ups, just set 0, because it is not actually checked
    //       const topUpIndex = 0;

    //       // ensure rewards are matured
    //       const areRewardsMatured = position.end.add(position.duration).lt(await time.latest());
    //       expect(areRewardsMatured).to.be.true;

    //       const expectedFinalReward = expectedReward.add(expectedAdditionalReward);

    //       const maxFinalReward = maxReward.add(maxAdditionalReward);

    //       await expect(await manager.claimPositionReward(validator, epochNum, topUpIndex)).to.changeEtherBalances(
    //         [childValidatorSet.address, ethers.constants.AddressZero],
    //         [maxFinalReward.sub(expectedFinalReward).mul(-1), maxFinalReward.sub(expectedFinalReward)]
    //       );

    //       // Commit one more epoch so withdraw to be available
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);
    //       await expect(await manager.withdraw(user.address)).to.changeEtherBalances(
    //         [user.address, childValidatorSet.address],
    //         [expectedFinalReward, expectedFinalReward.mul(-1)]
    //       );
    //     });

    //     it("should properly claim reward when top-ups and not full reward matured", async () => {
    //       const { user, manager, validator } = await loadFixture(setupManagerFixture);
    //       // calculate reward
    //       const baseReward = await childValidatorSet.getRawDelegatorReward(validator, manager.address);
    //       const base = await childValidatorSet.getBase();
    //       const vestBonus = await childValidatorSet.getVestingBonus(1);
    //       const rsi = await childValidatorSet.getRSI();
    //       const expectedBaseReward = base
    //         .add(vestBonus)
    //         .mul(rsi)
    //         .mul(baseReward)
    //         .div(10000 * 10000)
    //         .div(epochsInYear);

    //       // top-up
    //       await manager.topUpPosition(validator, { value: minDelegation });

    //       // more rewards to be distributed but with the top-up data
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);

    //       const topUpRewardsTimestamp = await time.latest();
    //       const position = await childValidatorSet.vestings(validator, manager.address);
    //       const toBeMatured = ethers.BigNumber.from(topUpRewardsTimestamp).sub(position.start);

    //       const topUpReward = (await childValidatorSet.getRawDelegatorReward(validator, manager.address)).sub(
    //         baseReward
    //       );
    //       // no rsi because top-up is used
    //       const defaultRSI = await childValidatorSet.getDefaultRSI();
    //       const expectedTopUpReward = base
    //         .add(vestBonus)
    //         .mul(defaultRSI)
    //         .mul(topUpReward)
    //         .div(10000 * 10000)
    //         .div(epochsInYear);

    //       const expectedReward = expectedBaseReward.add(expectedTopUpReward);

    //       // calculate max reward
    //       const maxRSI = await childValidatorSet.getMaxRSI();
    //       const maxVestBonus = await childValidatorSet.getVestingBonus(52);
    //       const maxBaseReward = base
    //         .add(maxVestBonus)
    //         .mul(maxRSI)
    //         .mul(baseReward)
    //         .div(10000 * 10000)
    //         .div(epochsInYear);
    //       const maxTopUpReward = base
    //         .add(maxVestBonus)
    //         .mul(maxRSI)
    //         .mul(topUpReward)
    //         .div(10000 * 10000)
    //         .div(epochsInYear);
    //       const maxReward = maxBaseReward.add(maxTopUpReward);

    //       // enter the maturing state
    //       // two week is the duration + the needed time for the top-up to be matured
    //       await time.increase(2 * week + toBeMatured.toNumber() + 1);

    //       // comit epoch, so more reward is added that must not be claimed now
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);

    //       // prepare params for call
    //       const end = position.end;
    //       const rpsValues = await childValidatorSet.getRPSValues(validator);
    //       const epochNum = findProperRPSIndex(rpsValues, end);
    //       // 1 because we have only one top-up
    //       const topUpIndex = 1;
    //       // ensure rewards are maturing
    //       const areRewardsMatured = position.end.add(toBeMatured).lt(await time.latest());
    //       expect(areRewardsMatured).to.be.true;
    //       await expect(await manager.claimPositionReward(validator, epochNum, topUpIndex)).to.changeEtherBalances(
    //         [childValidatorSet.address, ethers.constants.AddressZero],
    //         [maxReward.sub(expectedReward).mul(-1), maxReward.sub(expectedReward)]
    //       );

    //       // Commit one more epoch so withdraw to be available
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);
    //       await expect(await manager.withdraw(user.address)).to.changeEtherBalances(
    //         [user.address, childValidatorSet.address],
    //         [expectedReward, expectedReward.mul(-1)]
    //       );
    //     });

    //     it("should properly claim reward when top-ups and full reward matured", async () => {
    //       const { user, manager, validator } = await loadFixture(setupManagerFixture);
    //       // calculate reward
    //       const baseReward = await childValidatorSet.getRawDelegatorReward(validator, manager.address);
    //       const base = await childValidatorSet.getBase();
    //       const vestBonus = await childValidatorSet.getVestingBonus(1);
    //       const rsi = await childValidatorSet.getRSI();
    //       // Default RSI because we use top-up
    //       const defaultRSI = await childValidatorSet.getDefaultRSI();

    //       // top-up
    //       await manager.topUpPosition(validator, { value: minDelegation });

    //       // more rewards to be distributed but with the top-up data
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);

    //       const topUpReward = (await childValidatorSet.getRawDelegatorReward(validator, manager.address)).sub(
    //         baseReward
    //       );
    //       const expectedBaseReward = base
    //         .add(vestBonus)
    //         .mul(rsi)
    //         .mul(baseReward)
    //         .div(10000 * 10000)
    //         .div(epochsInYear);

    //       const expectedTopUpReward = base
    //         .add(vestBonus)
    //         .mul(defaultRSI)
    //         .mul(topUpReward)
    //         .div(10000 * 10000)
    //         .div(epochsInYear);

    //       const expectedReward = expectedBaseReward.add(expectedTopUpReward);

    //       // calculate max reward
    //       const maxRSI = await childValidatorSet.getMaxRSI();
    //       const maxVestBonus = await childValidatorSet.getVestingBonus(52);
    //       const maxBaseReward = base
    //         .add(maxVestBonus)
    //         .mul(maxRSI)
    //         .mul(baseReward)
    //         .div(10000 * 10000)
    //         .div(epochsInYear);

    //       const maxTopUpReward = base
    //         .add(maxVestBonus)
    //         .mul(maxRSI)
    //         .mul(topUpReward)
    //         .div(10000 * 10000)
    //         .div(epochsInYear);

    //       const maxReward = maxBaseReward.add(maxTopUpReward);
    //       // enter the matured state
    //       await time.increase(4 * week + 1);

    //       // comit epoch, so more reward is added that must be without bonus
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);

    //       const additionalReward = (await childValidatorSet.getRawDelegatorReward(validator, manager.address)).sub(
    //         baseReward.add(topUpReward)
    //       );
    //       const expectedAdditionalReward = base.mul(additionalReward).div(10000).div(epochsInYear);
    //       const maxAdditionalReward = base
    //         .add(maxVestBonus)
    //         .mul(maxRSI)
    //         .mul(additionalReward)
    //         .div(10000 * 10000)
    //         .div(epochsInYear);

    //       // prepare params for call
    //       const position = await childValidatorSet.vestings(validator, manager.address);
    //       const end = position.end;
    //       const rpsValues = await childValidatorSet.getRPSValues(validator);
    //       const epochNum = findProperRPSIndex(rpsValues, end);
    //       // 1 because we have only one top-up, but the first is for the openDelegatorPosition
    //       const topUpIndex = 1;

    //       // ensure rewards are matured
    //       const areRewardsMatured = position.end.add(position.duration).lt(await time.latest());
    //       expect(areRewardsMatured).to.be.true;

    //       const expectedFinalReward = expectedReward.add(expectedAdditionalReward);
    //       const maxFinalReward = maxReward.add(maxAdditionalReward);

    //       await expect(await manager.claimPositionReward(validator, epochNum, topUpIndex)).to.changeEtherBalances(
    //         [childValidatorSet.address, ethers.constants.AddressZero],
    //         [maxFinalReward.sub(expectedFinalReward).mul(-1), maxFinalReward.sub(expectedFinalReward)]
    //       );

    //       // Commit one more epoch so withdraw to be available
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);
    //       await expect(await manager.withdraw(user.address)).to.changeEtherBalances(
    //         [user.address, childValidatorSet.address],
    //         [expectedFinalReward, expectedFinalReward.mul(-1)]
    //       );
    //     });

    //     it("reverts when invalid top-up index", async () => {
    //       const { manager, validator } = await loadFixture(setupManagerFixture);
    //       // top-up
    //       await manager.topUpPosition(validator, { value: minDelegation });

    //       // more rewards to be distributed but with the top-up data
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);

    //       const topUpRewardsTimestamp = await time.latest();
    //       const position = await childValidatorSet.vestings(validator, manager.address);
    //       const toBeMatured = ethers.BigNumber.from(topUpRewardsTimestamp).sub(position.start);

    //       // enter the maturing state
    //       // two week is the duration + the needed time for the top-up to be matured
    //       await time.increase(2 * week + toBeMatured.toNumber() + 1);

    //       // comit epoch, so more reward is added that must not be claimed now
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);

    //       // prepare params for call
    //       const end = position.end;
    //       const rpsValues = await childValidatorSet.getRPSValues(validator);
    //       const epochNum = findProperRPSIndex(rpsValues, end);
    //       // set invalid index
    //       const topUpIndex = 2;

    //       // ensure rewards are maturing
    //       const areRewardsMatured = position.end.add(toBeMatured).lt(await time.latest());
    //       expect(areRewardsMatured).to.be.true;

    //       await expect(manager.claimPositionReward(validator, epochNum, topUpIndex))
    //         .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
    //         .withArgs("vesting", "INVALID_TOP_UP_INDEX");
    //     });

    //     it("reverts when later top-up index", async () => {
    //       const { manager, validator } = await loadFixture(setupManagerFixture);
    //       // top-up
    //       await manager.topUpPosition(validator, { value: minDelegation });

    //       // more rewards to be distributed but with the top-up data
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);

    //       const position = await childValidatorSet.vestings(validator, manager.address);

    //       // add another top-up
    //       await manager.topUpPosition(validator, { value: minDelegation });

    //       // more rewards to be distributed but with the top-up data
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);

    //       // enter the maturing state
    //       // two week is the duration + the needed time for the top-up to be matured
    //       await time.increase(4 * week + 1);

    //       // comit epoch, so more reward is added that must not be claimed now
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);

    //       // prepare params for call
    //       const end = position.end;
    //       const rpsValues = await childValidatorSet.getRPSValues(validator);
    //       const epochNum = findProperRPSIndex(rpsValues, end);

    //       // set later index
    //       const topUpIndex = 2;

    //       await expect(manager.claimPositionReward(validator, epochNum - 1, topUpIndex))
    //         .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
    //         .withArgs("vesting", "LATER_TOP_UP");
    //     });

    //     it("reverts when earlier top-up index", async () => {
    //       const { manager, validator } = await loadFixture(setupManagerFixture);
    //       // top-up
    //       await manager.topUpPosition(validator, { value: minDelegation });

    //       // more rewards to be distributed but with the top-up data
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);

    //       const position = await childValidatorSet.vestings(validator, manager.address);

    //       // comit epoch
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);

    //       // add another top-up
    //       await manager.topUpPosition(validator, { value: minDelegation });

    //       // more rewards to be distributed but with the top-up data
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);

    //       // enter the maturing state
    //       // reward to be matured
    //       await time.increase(8 * week);

    //       // prepare params for call
    //       const end = position.end;
    //       const rpsValues = await childValidatorSet.getRPSValues(validator);
    //       const epochNum = findProperRPSIndex(rpsValues, end);

    //       // set earlier index
    //       const topUpIndex = 0;

    //       await expect(manager.claimPositionReward(validator, epochNum, topUpIndex))
    //         .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
    //         .withArgs("vesting", "EARLIER_TOP_UP");
    //     });

    //     it("claim only reward made before top-up", async () => {
    //       const { user, manager, validator } = await loadFixture(setupManagerFixture);
    //       // calculate reward
    //       const baseReward = await childValidatorSet.getRawDelegatorReward(validator, manager.address);
    //       const base = await childValidatorSet.getBase();
    //       const vestBonus = await childValidatorSet.getVestingBonus(1);
    //       // Not default RSI because we claim rewards made before top-up
    //       const rsi = await childValidatorSet.getRSI();
    //       const reward = base
    //         .add(vestBonus)
    //         .mul(rsi)
    //         .mul(baseReward)
    //         .div(10000 * 10000)
    //         .div(epochsInYear);

    //       const rewardDistributionTime = await time.latest();
    //       let position = await childValidatorSet.vestings(validator, manager.address);
    //       const toBeMatured = ethers.BigNumber.from(rewardDistributionTime).sub(position.start);
    //       time.increase(50);

    //       // top-up
    //       await manager.topUpPosition(validator, { value: minDelegation });
    //       // more rewards to be distributed but with the top-up data
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);
    //       // comit epoch, so more reward is added that must be without bonus
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);

    //       // prepare params for call
    //       position = await childValidatorSet.vestings(validator, manager.address);
    //       // enter the maturing state
    //       await time.increaseTo(position.end.toNumber() + toBeMatured.toNumber() + 1);

    //       const rpsValues = await childValidatorSet.getRPSValues(validator);
    //       const epochNum = findProperRPSIndex(rpsValues, position.start.add(toBeMatured));
    //       const topUpIndex = 0;
    //       // ensure rewards are maturing
    //       const areRewardsMaturing = position.end.add(toBeMatured).lt(await time.latest());
    //       expect(areRewardsMaturing).to.be.true;

    //       await manager.claimPositionReward(validator, epochNum, topUpIndex);

    //       // Commit one more epoch so withdraw to be available
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);
    //       await expect(await manager.withdraw(user.address)).to.changeEtherBalances(
    //         [user.address, childValidatorSet.address],
    //         [reward, reward.mul(-1)]
    //       );
    //     });

    //     it("claim rewards multiple times", async () => {
    //       const { user, manager, validator } = await loadFixture(setupManagerFixture);
    //       // calculate reward
    //       const baseReward = await childValidatorSet.getRawDelegatorReward(validator, manager.address);
    //       const base = await childValidatorSet.getBase();
    //       const vestBonus = await childValidatorSet.getVestingBonus(1);
    //       // Not default RSI because we claim rewards made before top-up
    //       const rsi = await childValidatorSet.getRSI();
    //       const reward = base
    //         .add(vestBonus)
    //         .mul(rsi)
    //         .mul(baseReward)
    //         .div(10000 * 10000)
    //         .div(epochsInYear);

    //       const rewardDistributionTime = await time.latest();
    //       let position = await childValidatorSet.vestings(validator, manager.address);
    //       const toBeMatured = ethers.BigNumber.from(rewardDistributionTime).sub(position.start);
    //       time.increase(50);

    //       // top-up
    //       await manager.topUpPosition(validator, { value: minDelegation });
    //       // more rewards to be distributed but with the top-up data
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);
    //       // comit epoch, so more reward is added that must be without bonus
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);

    //       // prepare params for call
    //       position = await childValidatorSet.vestings(validator, manager.address);
    //       // enter the maturing state
    //       await time.increaseTo(position.end.toNumber() + toBeMatured.toNumber() + 1);

    //       const rpsValues = await childValidatorSet.getRPSValues(validator);
    //       const epochNum = findProperRPSIndex(rpsValues, position.start.add(toBeMatured));
    //       const topUpIndex = 0;
    //       // ensure rewards are maturing
    //       const areRewardsMaturing = position.end.add(toBeMatured).lt(await time.latest());
    //       expect(areRewardsMaturing).to.be.true;

    //       await manager.claimPositionReward(validator, epochNum, topUpIndex);

    //       // Commit one more epoch so withdraw to be available
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);
    //       await expect(await manager.withdraw(user.address)).to.changeEtherBalances(
    //         [user.address, childValidatorSet.address],
    //         [reward, reward.mul(-1)]
    //       );

    //       time.increase(2 * week);

    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);
    //       expect(await manager.claimPositionReward(validator, epochNum + 1, topUpIndex + 1)).to.not.be.reverted;

    //       time.increase(2 * week);
    //       await commitEpoch(systemChildValidatorSet, [accounts[0], accounts[2], accounts[9]]);

    //       expect(await manager.claimPositionReward(validator, epochNum + 1, topUpIndex + 1)).to.not.be.reverted;
    //     });
    //   });
    // });
  });
});
