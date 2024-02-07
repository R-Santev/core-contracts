/* eslint-disable node/no-extraneous-import */
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import * as hre from "hardhat";

import { WEEK, VESTING_DURATION_WEEKS } from "../constants";
import { calculatePenalty, commitEpochs, registerValidator } from "../helper";
import { RunStakingClaimTests } from "../RewardPool/RewardPool.test";

export function RunStakingTests(): void {
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
      expect(validator.totalStake, "total stake").to.equal(this.minStake);
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

    before(async function () {
      this.staker = this.signers.accounts[9];
    });

    describe("openVestedPosition()", function () {
      it("should open vested position", async function () {
        const { validatorSet, systemValidatorSet, rewardPool } = await loadFixture(
          this.fixtures.stakedValidatorsStateFixture
        );

        await registerValidator(validatorSet, this.signers.governance, this.staker);
        const stakerValidatorSet = validatorSet.connect(this.staker);
        const tx = await stakerValidatorSet.stakeWithVesting(VESTING_DURATION_WEEKS, {
          value: this.minStake,
        });

        const vestingData = await rewardPool.positions(this.staker.address);
        if (!tx) {
          throw new Error("block number is undefined");
        }

        expect(vestingData.duration, "duration").to.be.equal(vestingDuration);
        const start = await time.latest();
        expect(vestingData.start, "start").to.be.equal(start);
        expect(vestingData.end, "end").to.be.equal(start + vestingDuration);
        expect(vestingData.base, "base").to.be.equal(await rewardPool.base());
        expect(vestingData.vestBonus, "vestBonus").to.be.equal(await rewardPool.getVestingBonus(10));
        expect(vestingData.rsiBonus, "rsiBonus").to.be.equal(await rewardPool.rsi());

        await commitEpochs(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.staker],
          1, // number of epochs to commit
          this.epochSize
        );

        const validator = await stakerValidatorSet.getValidator(this.staker.address);

        // check is stake = min stake
        expect(validator.stake, "stake").to.be.equal(this.minStake);
      });

      it("should not be in vesting cycle", async function () {
        const { stakerValidatorSet } = await loadFixture(this.fixtures.newVestingValidatorFixture);

        await expect(stakerValidatorSet.stakeWithVesting(vestingDuration))
          .to.be.revertedWithCustomError(stakerValidatorSet, "StakeRequirement")
          .withArgs("vesting", "ALREADY_IN_VESTING");
      });
    });

    describe("Top-up staking position with stake()", function () {
      it("should top-up staking position", async function () {
        const { stakerValidatorSet, systemValidatorSet, rewardPool } = await loadFixture(
          this.fixtures.newVestingValidatorFixture
        );

        await stakerValidatorSet.connect(this.staker).stake({ value: this.minStake });
        const vestingData = await rewardPool.positions(this.staker.address);

        expect(vestingData.duration, "duration").to.be.equal(vestingDuration * 2);
        expect(vestingData.end, "end").to.be.equal(vestingData.start.add(vestingDuration * 2));
        expect(vestingData.rsiBonus, "rsiBonus").to.be.equal(0);

        await commitEpochs(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.staker],
          1, // number of epochs to commit
          this.epochSize
        );

        const validator = await stakerValidatorSet.getValidator(this.staker.address);

        // check is stake = min stake * 2 because we increased position
        expect(validator.stake, "stake").to.be.equal(this.minStake.mul(2));
      });
    });

    describe("decrease staking position with unstake()", function () {
      it("should decrease staking position and apply slashing penalty", async function () {
        const { stakerValidatorSet, systemValidatorSet, rewardPool } = await loadFixture(
          this.fixtures.newVestingValidatorFixture
        );

        await stakerValidatorSet.stake({ value: this.minStake });

        await commitEpochs(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.staker],
          1, // number of epochs to commit
          this.epochSize
        );

        const unstakeAmount = this.minStake.div(2);
        const position = await rewardPool.positions(this.staker.address);
        const penalty = await calculatePenalty(position, unstakeAmount);
        await stakerValidatorSet.unstake(unstakeAmount);

        const withdrawalAmount = await stakerValidatorSet.pendingWithdrawals(this.staker.address);
        expect(withdrawalAmount, "withdrawal amount = calculated amount").to.equal(unstakeAmount.sub(penalty));

        // commit epoch after unstake, because it is required to wait 1 epoch to withdraw
        await commitEpochs(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.staker],
          1, // number of epochs to commit
          this.epochSize
        );

        await expect(stakerValidatorSet.withdraw(this.staker.address), "withdraw").to.changeEtherBalance(
          stakerValidatorSet,
          unstakeAmount.sub(penalty).mul(-1)
        );
      });

      it("should delete position data when full amount removed", async function () {
        const { stakerValidatorSet, rewardPool } = await loadFixture(this.fixtures.newVestingValidatorFixture);

        const validator = await stakerValidatorSet.getValidator(this.staker.address);

        await stakerValidatorSet.unstake(validator.stake);

        const position = await rewardPool.positions(this.staker.address);

        expect(position.start, "start").to.be.equal(0);
        expect(position.end, "end").to.be.equal(0);
        expect(position.duration, "duration").to.be.equal(0);
      });

      it("should withdraw and validate there are no pending withdrawals", async function () {
        const { stakerValidatorSet, systemValidatorSet, rewardPool } = await loadFixture(
          this.fixtures.newVestingValidatorFixture
        );

        const validator = await stakerValidatorSet.getValidator(this.staker.address);

        await stakerValidatorSet.unstake(validator.stake);

        await commitEpochs(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.staker],
          1, // number of epochs to commit
          this.epochSize
        );

        await stakerValidatorSet.withdraw(this.staker.address);

        expect(await stakerValidatorSet.pendingWithdrawals(this.staker.address)).to.equal(0);
      });
    });

    describe("Reward Pool - Staking claim", function () {
      RunStakingClaimTests();
    });
  });
}
