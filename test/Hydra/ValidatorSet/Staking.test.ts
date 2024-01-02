/* eslint-disable node/no-extraneous-import */
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import * as hre from "hardhat";

import * as mcl from "../../../ts/mcl";
import { DOMAIN, CHAIN_ID } from "../constants";

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

    it("should get 0 sorted validator", async function () {
      const { validatorSet } = await loadFixture(this.fixtures.stakedValidatorsStateFixture);

      const validatorAddresses = await validatorSet.sortedValidators(0);
      expect(validatorAddresses).to.deep.equal([]);
    });

    it("should get 2 sorted validators", async function () {
      const { validatorSet } = await loadFixture(this.fixtures.stakedValidatorsStateFixture);

      const validatorAddresses = await validatorSet.sortedValidators(2);

      expect(validatorAddresses).to.deep.equal([
        this.signers.validators[2].address,
        this.signers.validators[1].address,
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
}
