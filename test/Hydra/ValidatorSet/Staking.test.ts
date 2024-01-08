/* eslint-disable node/no-extraneous-import */
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import * as hre from "hardhat";
import { BigNumber } from "ethers";

import * as mcl from "../../../ts/mcl";
import { RewardPool } from "../../../typechain-types";
import { DOMAIN, CHAIN_ID, WEEK, VESTING_DURATION_WEEKS } from "../constants";
import { commitEpochs, findProperRPSIndex, getValidatorReward, registerValidator } from "../helper";

export function RunStakingTests(): void {
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

      expect((await validatorSet.validators(this.signers.validators[0].address)).whitelisted, "whitelisted = false").to
        .be.false;
      const validator = await validatorSet.getValidator(this.signers.validators[0].address);

      expect(validator.stake, "stake").to.equal(0);
      expect(validator.totalStake, "total stake").to.equal(0);
      expect(validator.commission).to.equal(0);
      expect(validator.active).to.equal(true);
      expect(validator.blsKey.map((x) => x.toHexString())).to.deep.equal(mcl.g2ToHex(keyPair.pubkey));
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
        validatorSet.connect(this.signers.validators[0]).register(mcl.g1ToHex(signature), mcl.g2ToHex(keyPair.pubkey)),
        "register"
      )
        .to.be.revertedWithCustomError(validatorSet, "AlreadyRegistered")
        .withArgs(this.signers.validators[0].address);
    });
  });

  describe("Stake", function () {
    it("should allow only registered validators to stake", async function () {
      // * Only the first three validators are being registered
      const { validatorSet } = await loadFixture(this.fixtures.registeredValidatorsStateFixture);

      await expect(validatorSet.connect(this.signers.validators[3]).stake({ value: this.minStake }))
        .to.be.revertedWithCustomError(validatorSet, "Unauthorized")
        .withArgs("VALIDATOR");
    });

    it("should revert if min amount not reached", async function () {
      const { validatorSet } = await loadFixture(this.fixtures.registeredValidatorsStateFixture);

      await expect(validatorSet.connect(this.signers.validators[0]).stake({ value: this.minStake.div(2) }))
        .to.be.revertedWithCustomError(validatorSet, "StakeRequirement")
        .withArgs("stake", "STAKE_TOO_LOW");
    });

    it("should be able to stake", async function () {
      const { validatorSet } = await loadFixture(this.fixtures.registeredValidatorsStateFixture);

      const tx = await validatorSet.connect(this.signers.validators[0]).stake({ value: this.minStake });

      await expect(tx, "Staked emitted")
        .to.emit(validatorSet, "Staked")
        .withArgs(this.signers.validators[0].address, this.minStake);

      const validator = await validatorSet.getValidator(this.signers.validators[0].address);
      expect(validator.stake, "staked amount").to.equal(this.minStake);
      expect(validator.totalStake, "total stake").to.equal(this.minStake.mul(2));
    });

    it("should get all active validators", async function () {
      const { validatorSet } = await loadFixture(this.fixtures.stakedValidatorsStateFixture);

      const validatorAddresses = await validatorSet.getValidators();

      expect(validatorAddresses).to.deep.equal([
        this.signers.admin.address,
        this.signers.validators[0].address,
        this.signers.validators[1].address,
        this.signers.validators[2].address,
      ]);
    });
  });

  describe("Unstake", function () {
    it("should not be able to unstake if there is insufficient staked balance", async function () {
      const { validatorSet } = await loadFixture(this.fixtures.stakedValidatorsStateFixture);

      const unstakeInsufficientAmount = this.minStake.add(hre.ethers.utils.parseEther("5"));
      await expect(validatorSet.connect(this.signers.validators[0]).unstake(unstakeInsufficientAmount))
        .to.be.revertedWithCustomError(validatorSet, "StakeRequirement")
        .withArgs("unstake", "INSUFFICIENT_BALANCE");
    });

    it("should not be able to exploit int overflow", async function () {
      const { validatorSet } = await loadFixture(this.fixtures.stakedValidatorsStateFixture);

      await expect(validatorSet.connect(this.signers.validators[0]).unstake(hre.ethers.constants.MaxInt256.add(1))).to
        .be.reverted;
    });

    it("should not be able to unstake so that less than minStake is left", async function () {
      const { validatorSet } = await loadFixture(this.fixtures.stakedValidatorsStateFixture);

      const amountToUnstake = this.minStake.add(hre.ethers.utils.parseEther("0.2"));
      await expect(validatorSet.unstake(amountToUnstake))
        .to.be.revertedWithCustomError(validatorSet, "StakeRequirement")
        .withArgs("unstake", "STAKE_TOO_LOW");
    });

    it("should be able to partially unstake", async function () {
      const { validatorSet } = await loadFixture(this.fixtures.stakedValidatorsStateFixture);

      const amountToUnstake = hre.ethers.utils.parseEther("0.2");
      const tx = await validatorSet.connect(this.signers.validators[0]).unstake(amountToUnstake);
      await expect(tx).to.emit(validatorSet, "Unstaked").withArgs(this.signers.validators[0].address, amountToUnstake);
    });

    it("should take pending unstakes into account", async function () {
      const { validatorSet } = await loadFixture(this.fixtures.stakedValidatorsStateFixture);

      const unstakeInsufficientAmount = hre.ethers.utils.parseEther("2.5");
      const stakeTooLowAmount = hre.ethers.utils.parseEther("1.5");
      await expect(validatorSet.connect(this.signers.validators[0]).unstake(unstakeInsufficientAmount))
        .to.be.revertedWithCustomError(validatorSet, "StakeRequirement")
        .withArgs("unstake", "INSUFFICIENT_BALANCE");
      await expect(validatorSet.connect(this.signers.validators[0]).unstake(stakeTooLowAmount))
        .to.be.revertedWithCustomError(validatorSet, "StakeRequirement")
        .withArgs("unstake", "STAKE_TOO_LOW");
    });

    it("should be able to completely unstake", async function () {
      const { validatorSet } = await loadFixture(this.fixtures.stakedValidatorsStateFixture);

      const tx = validatorSet.connect(this.signers.validators[0]).unstake(this.minStake.mul(2));
      await expect(tx)
        .to.emit(validatorSet, "Unstaked")
        .withArgs(this.signers.validators[0].address, this.minStake.mul(2));
    });

    it("should place in withdrawal queue", async function () {
      const { validatorSet } = await loadFixture(this.fixtures.stakedValidatorsStateFixture);
      await validatorSet.connect(this.signers.validators[0]).unstake(this.minStake.mul(2));

      expect(await validatorSet.pendingWithdrawals(this.signers.validators[0].address)).to.equal(this.minStake.mul(2));
      expect(await validatorSet.withdrawable(this.signers.validators[0].address)).to.equal(0);
    });
  });

  describe("Staking Vesting", function () {
    const vestingDuration = VESTING_DURATION_WEEKS * WEEK;
    let staker: SignerWithAddress;

    before(async function () {
      staker = this.signers.accounts[9];
    });

    describe("openVestedPosition()", function () {
      it("should open vested position", async function () {
        const { validatorSet, systemValidatorSet, rewardPool } = await loadFixture(
          this.fixtures.stakedValidatorsStateFixture
        );

        await registerValidator(validatorSet, this.signers.governance, staker);
        const stakerValidatorSet = validatorSet.connect(staker);
        const tx = await stakerValidatorSet.openVestedPosition(VESTING_DURATION_WEEKS, {
          value: this.minStake,
        });

        const vestingData = await rewardPool.positions(staker.address);
        if (!tx) {
          throw new Error("block number is undefined");
        }

        expect(vestingData.duration, "duration").to.be.equal(vestingDuration);
        const start = await time.latest();
        expect(vestingData.start, "start").to.be.equal(start);
        expect(vestingData.end, "end").to.be.equal(start + vestingDuration);
        expect(vestingData.base, "base").to.be.equal(await rewardPool.getBase());
        expect(vestingData.vestBonus, "vestBonus").to.be.equal(await rewardPool.getVestingBonus(10));
        expect(vestingData.rsiBonus, "rsiBonus").to.be.equal(await rewardPool.getRSI());

        await commitEpochs(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], staker],
          1, // number of epochs to commit
          this.epochSize
        );

        const validator = await stakerValidatorSet.getValidator(staker.address);

        // check is stake = min stake
        expect(validator.stake, "stake").to.be.equal(this.minStake);
      });

      it("should not be in vesting cycle", async function () {
        const { stakerValidatorSet } = await loadFixture(this.fixtures.newVestingValidatorFixture);

        await expect(stakerValidatorSet.openVestedPosition(vestingDuration))
          .to.be.revertedWithCustomError(stakerValidatorSet, "StakeRequirement")
          .withArgs("vesting", "ALREADY_IN_VESTING");
      });
    });

    describe("Top-up staking position with stake()", function () {
      it("should top-up staking position", async function () {
        const { stakerValidatorSet, systemValidatorSet, rewardPool } = await loadFixture(
          this.fixtures.newVestingValidatorFixture
        );

        await stakerValidatorSet.connect(staker).stake({ value: this.minStake });
        const vestingData = await rewardPool.positions(staker.address);

        expect(vestingData.duration, "duration").to.be.equal(vestingDuration * 2);
        expect(vestingData.end, "end").to.be.equal(vestingData.start.add(vestingDuration * 2));
        expect(vestingData.rsiBonus, "rsiBonus").to.be.equal(0);

        await commitEpochs(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], staker],
          1, // number of epochs to commit
          this.epochSize
        );

        const validator = await stakerValidatorSet.getValidator(staker.address);

        // check is stake = min stake * 2 because we increased position
        expect(validator.stake, "stake").to.be.equal(this.minStake.mul(2));
      });
    });

    describe("decrease staking position with unstake()", function () {
      async function calculatePenalty(rewardPool: RewardPool, unstakeAmount: BigNumber) {
        const position = await rewardPool.positions(staker.address);
        const latestTimestamp = await time.latest();
        const nextTimestamp = latestTimestamp + 2;
        await time.setNextBlockTimestamp(nextTimestamp);
        const duration = position.duration;
        const leftDuration = position.end.sub(nextTimestamp);
        const penalty = unstakeAmount.mul(leftDuration).div(duration);
        return penalty;
      }

      it("should decrease staking position", async function () {
        const { stakerValidatorSet, systemValidatorSet, rewardPool } = await loadFixture(
          this.fixtures.newVestingValidatorFixture
        );

        await stakerValidatorSet.stake({ value: this.minStake });

        await commitEpochs(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], staker],
          1, // number of epochs to commit
          this.epochSize
        );

        const unstakeAmount = this.minStake.div(2);
        const penalty = await calculatePenalty(rewardPool, unstakeAmount);
        await stakerValidatorSet.unstake(unstakeAmount);

        const withdrawalAmount = await stakerValidatorSet.pendingWithdrawals(staker.address);
        expect(withdrawalAmount, "withdrawal amount = calculated amount").to.equal(unstakeAmount.sub(penalty));

        // commit epoch after unstake, because it is required to wait 1 epoch to withdraw
        await commitEpochs(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], staker],
          1, // number of epochs to commit
          this.epochSize
        );

        await expect(stakerValidatorSet.withdraw(staker.address), "withdraw").to.changeEtherBalance(
          stakerValidatorSet,
          unstakeAmount.sub(penalty).mul(-1)
        );
      });

      it("should delete position data when full amount removed", async function () {
        const { stakerValidatorSet, rewardPool } = await loadFixture(this.fixtures.newVestingValidatorFixture);

        const validator = await stakerValidatorSet.getValidator(staker.address);

        await stakerValidatorSet.unstake(validator.stake);

        const position = await rewardPool.positions(staker.address);

        expect(position.start, "start").to.be.equal(0);
        expect(position.end, "end").to.be.equal(0);
        expect(position.duration, "duration").to.be.equal(0);
      });

      it("should withdraw and validate there are no pending withdrawals", async function () {
        const { stakerValidatorSet, systemValidatorSet, rewardPool } = await loadFixture(
          this.fixtures.newVestingValidatorFixture
        );

        const validator = await stakerValidatorSet.getValidator(staker.address);

        await stakerValidatorSet.unstake(validator.stake);

        await commitEpochs(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], staker],
          1, // number of epochs to commit
          this.epochSize
        );

        await stakerValidatorSet.withdraw(staker.address);

        expect(await stakerValidatorSet.pendingWithdrawals(staker.address)).to.equal(0);
      });
    });

    describe("claim position reward", function () {
      it("should not be able to claim when active", async function () {
        const { stakerValidatorSet, systemValidatorSet, rewardPool } = await loadFixture(
          this.fixtures.newVestingValidatorFixture
        );

        await commitEpochs(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], staker],
          1, // number of epochs to commit
          this.epochSize
        );

        await stakerValidatorSet.stake({ value: this.minStake });

        await commitEpochs(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], staker],
          1, // number of epochs to commit
          this.epochSize
        );

        const reward = await getValidatorReward(stakerValidatorSet, staker.address);
        expect(reward).to.be.gt(0);
      });

      it("should be able to claim with claimValidatorReward(epoch) when maturing", async function () {
        const { systemValidatorSet, rewardPool } = await loadFixture(this.fixtures.vestingRewardsFixture);

        // add reward exactly before maturing (second to the last block)
        const position = await rewardPool.positions(staker.address);
        const penultimate = position.end.sub(1);
        await time.setNextBlockTimestamp(penultimate.toNumber());
        await commitEpochs(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], staker],
          1, // number of epochs to commit
          this.epochSize
        );

        // enter maturing state
        const nextTimestampMaturing = position.end.add(position.duration.div(2));
        await time.setNextBlockTimestamp(nextTimestampMaturing.toNumber());

        // calculate up to which epoch rewards are matured
        const valRewardsHistoryRecords = await rewardPool.getValRewardsHistoryValues(staker.address);
        const valRewardHistoryRecordIndex = findProperRPSIndex(
          valRewardsHistoryRecords,
          position.end.sub(position.duration.div(2))
        );

        // claim reward
        await expect(rewardPool.connect(staker)["claimValidatorReward(uint256)"](valRewardHistoryRecordIndex)).to.emit(
          rewardPool,
          "ValidatorRewardClaimed"
        );
      });

      it("should be able to claim whole reward when not in position", async function () {
        const { stakerValidatorSet, systemValidatorSet, rewardPool } = await loadFixture(
          this.fixtures.vestingRewardsFixture
        );

        // add reward exactly before maturing (second to the last block)
        const position = await rewardPool.positions(staker.address);
        const penultimate = position.end.sub(1);
        await time.setNextBlockTimestamp(penultimate.toNumber());
        await commitEpochs(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], staker],
          1, // number of epochs to commit
          this.epochSize
        );

        // enter matured state
        const nextTimestampMaturing = position.end.add(position.duration);
        await time.setNextBlockTimestamp(nextTimestampMaturing.toNumber());

        // check reward amount
        const reward = await getValidatorReward(stakerValidatorSet, staker.address);

        // reward must be bigger than 0
        expect(reward).to.be.gt(0);

        // claim reward
        await expect(rewardPool.connect(staker)["claimValidatorReward()"]())
          .to.emit(rewardPool, "ValidatorRewardClaimed")
          .withArgs(staker.address, reward);
      });
    });
  });
}
