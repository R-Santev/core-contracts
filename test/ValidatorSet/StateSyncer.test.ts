/* eslint-disable node/no-extraneous-import */
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

import { commitEpoch, initializeContext } from "./../helper";
import { generateFixtures } from "../fixtures";

describe("ValidatorSet StakeSyncer", function () {
  before(async function () {
    // * Initialize the this context of mocha
    await initializeContext(this);

    /** Generate and initialize the context fixtures */
    await generateFixtures(this);
  });

  describe("Stake", function () {
    it("should emit StakeChanged event on stake", async function () {
      const { validatorSet } = await loadFixture(this.fixtures.registeredValidatorsStateFixture);
      const validatorValidatorSet = validatorSet.connect(this.signers.validators[0]);

      await expect(validatorValidatorSet.stake({ value: this.minStake }), "emit StakeChanged")
        .to.emit(validatorSet, "StakeChanged")
        .withArgs(this.signers.validators[0].address, this.minStake);

      // ensure proper staked amount is fetched
      const validatorData = await validatorSet.getValidator(this.signers.validators[0].address);
      expect(validatorData.totalStake, "totalStake").to.equal(this.minStake);
    });

    it("should emit StakeChanged event on opening a vested position", async function () {
      const { validatorSet } = await loadFixture(this.fixtures.registeredValidatorsStateFixture);

      const validator = this.signers.validators[1];
      const validatorValidatorSet = validatorSet.connect(validator);
      const vestingDuration = 12; // weeks
      await expect(
        validatorValidatorSet.stakeWithVesting(vestingDuration, { value: this.minStake }),
        "emit StakeChanged"
      )
        .to.emit(validatorSet, "StakeChanged")
        .withArgs(validator.address, this.minStake);

      // ensure proper staked amount is fetched
      const validatorData = await validatorSet.getValidator(validator.address);
      expect(validatorData.totalStake, "totalStake").to.equal(this.minStake);
    });

    it("should emit StakeChanged event on top-up vested position", async function () {
      const { validatorSet, systemValidatorSet, rewardPool } = await loadFixture(
        this.fixtures.registeredValidatorsStateFixture
      );

      const validator = this.signers.validators[2];
      const validatorValidatorSet = validatorSet.connect(validator);
      const vestingDuration = 12; // weeks
      await validatorValidatorSet.stakeWithVesting(vestingDuration, { value: this.minStake });
      await commitEpoch(
        systemValidatorSet,
        rewardPool,
        [this.signers.validators[0], this.signers.validators[1], validator],
        this.epochSize
      );

      await expect(validatorValidatorSet.stake({ value: this.minStake.mul(2) }), "emit StakeChanged")
        .to.emit(validatorSet, "StakeChanged")
        .withArgs(validator.address, this.minStake.mul(2).add(this.minStake));

      // ensure proper staked amount is fetched
      const validatorData = await validatorSet.getValidator(validator.address);
      expect(validatorData.totalStake, "totalStake").to.equal(this.minStake.mul(3));
    });

    it("should emit StakeChanged event on unstake", async function () {
      const { validatorSet, systemValidatorSet, rewardPool } = await loadFixture(
        this.fixtures.registeredValidatorsStateFixture
      );

      const validator = this.signers.validators[0];
      const validatorValidatorSet = validatorSet.connect(validator);
      await validatorValidatorSet.stake({ value: this.minStake });
      await commitEpoch(
        systemValidatorSet,
        rewardPool,
        [validator, this.signers.validators[1], this.signers.validators[2]],
        this.epochSize
      );

      await expect(validatorValidatorSet.unstake(this.minStake), "emit StakeChanged")
        .to.emit(validatorSet, "StakeChanged")
        .withArgs(validator.address, 0);

      // ensure that the amount is properly unstaked
      const validatorData = await validatorSet.getValidator(validator.address);
      expect(validatorData.totalStake, "totalStake").to.equal(0);
    });

    it("should emit StakeChanged event on unstake from vested position", async function () {
      const { validatorSet, systemValidatorSet, rewardPool } = await loadFixture(
        this.fixtures.registeredValidatorsStateFixture
      );

      const validator = this.signers.validators[0];
      const validatorValidatorSet = validatorSet.connect(validator);
      const vestingDuration = 12; // weeks
      const stakeAmount = this.minStake.mul(2);
      await validatorValidatorSet.stakeWithVesting(vestingDuration, { value: stakeAmount });
      await commitEpoch(
        systemValidatorSet,
        rewardPool,
        [validator, this.signers.validators[1], this.signers.validators[2]],
        this.epochSize
      );

      const unstakeAmount = this.minStake.div(3);
      await expect(validatorValidatorSet.unstake(unstakeAmount), "emit StakeChanged")
        .to.emit(validatorSet, "StakeChanged")
        .withArgs(validator.address, stakeAmount.sub(unstakeAmount));

      // ensure proper staked amount is fetched
      const validatorData = await validatorSet.getValidator(validator.address);
      expect(validatorData.totalStake, "totalStake").to.equal(stakeAmount.sub(unstakeAmount));
    });
  });

  describe("Delegation", () => {
    it("should emit StakeChanged event on delegate", async function () {
      const { validatorSet } = await loadFixture(this.fixtures.registeredValidatorsStateFixture);

      const validator = this.signers.validators[0];
      const { totalStake } = await validatorSet.getValidator(validator.address);

      const delegatorChildValidatorSet = validatorSet.connect(this.signers.delegator);
      await expect(
        delegatorChildValidatorSet.delegate(validator.address, { value: this.minStake }),
        "emit StakeChanged"
      )
        .to.emit(validatorSet, "StakeChanged")
        .withArgs(validator.address, this.minStake);

      // to ensure that delegate is immediately applied on the validator stake
      expect((await validatorSet.getValidator(validator.address)).totalStake).to.equal(
        totalStake.add(this.minStake),
        "totalStake"
      );
    });

    it("should emit StakeChanged event on open vested position", async function () {
      const { validatorSet, vestManager } = await loadFixture(this.fixtures.vestManagerFixture);

      const validator = this.signers.validators[0];
      const { totalStake } = await validatorSet.getValidator(validator.address);

      const vestingDuration = 12; // weeks

      await expect(
        vestManager.openVestedDelegatePosition(validator.address, vestingDuration, { value: this.minStake }),
        "emit StakeChanged"
      )
        .to.emit(validatorSet, "StakeChanged")
        .withArgs(validator.address, totalStake.add(this.minStake));

      // to ensure that delegate is immediately applied on the validator stake
      expect((await validatorSet.getValidator(validator.address)).totalStake, "totalStake").to.equal(
        totalStake.add(this.minStake)
      );
    });

    it("should emit StakeChanged event on top-up vested position", async function () {
      const { validatorSet, systemValidatorSet, rewardPool, vestManager } = await loadFixture(
        this.fixtures.vestManagerFixture
      );

      const validator = this.signers.validators[0];
      const vestingDuration = 12; // weeks
      await vestManager.openVestedDelegatePosition(validator.address, vestingDuration, { value: this.minStake });
      // because balance change can be made only once per epoch when vested delegation position
      await commitEpoch(
        systemValidatorSet,
        rewardPool,
        [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
        this.epochSize
      );
      const { totalStake } = await validatorSet.getValidator(validator.address);

      await expect(
        vestManager.topUpVestedDelegatePosition(validator.address, { value: this.minStake }),
        "emit StakeChanged"
      )
        .to.emit(validatorSet, "StakeChanged")
        .withArgs(validator.address, totalStake.add(this.minStake));
      // to ensure that delegate is immediately applied on the validator stake
      expect((await validatorSet.getValidator(validator.address)).totalStake, "totalStake").to.equal(
        totalStake.add(this.minStake)
      );
    });

    it("should emit StakeChanged event on undelegate", async function () {
      const { validatorSet } = await loadFixture(this.fixtures.vestManagerFixture);

      const validator = this.signers.validators[0];
      const delegatorValidatorSet = validatorSet.connect(this.signers.delegator);
      await delegatorValidatorSet.delegate(validator.address, { value: this.minStake });
      const { totalStake } = await validatorSet.getValidator(validator.address);

      await expect(await delegatorValidatorSet.undelegate(validator.address, this.minStake), "emit StakeChanged")
        .to.emit(validatorSet, "StakeChanged")
        .withArgs(validator.address, totalStake.sub(this.minStake));

      // to ensure that undelegate is immediately applied on the validator stake
      expect((await validatorSet.getValidator(validator.address)).totalStake, "totalStake").to.equal(
        totalStake.sub(this.minStake)
      );
    });

    it("should emit StakeChanged event on cut vested position", async function () {
      const { validatorSet, systemValidatorSet, rewardPool, liquidToken, vestManager, vestManagerOwner } =
        await loadFixture(this.fixtures.vestManagerFixture);

      const validator = this.signers.validators[0];
      const vestingDuration = 12; // weeks
      await vestManager.openVestedDelegatePosition(validator.address, vestingDuration, { value: this.minStake });
      // because balance change can be made only once per epoch when vested delegation position
      await commitEpoch(
        systemValidatorSet,
        rewardPool,
        [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
        this.epochSize
      );
      const { totalStake } = await validatorSet.getValidator(validator.address);

      await liquidToken.connect(vestManagerOwner).approve(vestManager.address, this.minStake);
      await expect(vestManager.cutVestedDelegatePosition(validator.address, this.minStake), "emit StakeChanged")
        .to.emit(validatorSet, "StakeChanged")
        .withArgs(validator.address, totalStake.sub(this.minStake));
      // to ensure that undelegate is immediately applied on the validator stake
      expect((await validatorSet.getValidator(validator.address)).totalStake, "totalStake").to.equal(
        totalStake.sub(this.minStake)
      );
    });
  });
});
