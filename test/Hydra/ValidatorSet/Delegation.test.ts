/* eslint-disable node/no-extraneous-import */
import { loadFixture, impersonateAccount, time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import * as hre from "hardhat";

// eslint-disable-next-line camelcase
import { VestManager__factory } from "../../../typechain-types";
import { WEEK } from "../constants";
import {
  calculatePenalty,
  claimPositionRewards,
  commitEpoch,
  commitEpochs,
  findProperRPSIndex,
  getUserManager,
} from "../helper";

export function RunDelegationTests(): void {
  describe("Delegate", function () {
    it("should revert when delegating zero amount", async function () {
      const { validatorSet } = await loadFixture(this.fixtures.withdrawableFixture);

      await expect(validatorSet.delegateToValidator(this.signers.validators[0].address, { value: 0 }))
        .to.be.revertedWithCustomError(validatorSet, "DelegateRequirement")
        .withArgs("delegate", "DELEGATING_AMOUNT_ZERO");
    });

    it("should not be able to delegate to missing or inactive validator", async function () {
      const { validatorSet } = await loadFixture(this.fixtures.withdrawableFixture);

      await expect(validatorSet.delegateToValidator(this.signers.validators[3].address, { value: this.minDelegation }))
        .to.be.revertedWithCustomError(validatorSet, "Unauthorized")
        .withArgs("INVALID_VALIDATOR");
    });

    it("should not be able to delegate less than minDelegation", async function () {
      const { validatorSet } = await loadFixture(this.fixtures.withdrawableFixture);

      await expect(
        validatorSet.delegateToValidator(this.signers.validators[0].address, {
          value: this.minDelegation.div(2),
        })
      )
        .to.be.revertedWithCustomError(validatorSet, "DelegateRequirement")
        .withArgs("delegate", "DELEGATION_TOO_LOW");
    });

    it("should delegate for the first time", async function () {
      const { validatorSet, rewardPool } = await loadFixture(this.fixtures.withdrawableFixture);
      const delegateAmount = this.minDelegation.mul(2);

      const tx = await validatorSet
        .connect(this.signers.delegator)
        .delegateToValidator(this.signers.validators[0].address, {
          value: delegateAmount,
        });

      await expect(tx)
        .to.emit(validatorSet, "Delegated")
        .withArgs(this.signers.validators[0].address, this.signers.delegator.address, delegateAmount);

      const delegatedAmount = await rewardPool.delegationOf(
        this.signers.validators[0].address,
        this.signers.delegator.address
      );

      expect(delegatedAmount).to.equal(delegateAmount);
    });

    it("should delegate again and register a withdrawal for the claimed rewards automatically", async function () {
      const { validatorSet, rewardPool } = await loadFixture(this.fixtures.delegatedFixture);

      const delegateAmount = this.minDelegation.div(2);
      const delegatorReward = await rewardPool.getDelegatorReward(
        this.signers.validators[0].address,
        this.signers.delegator.address
      );

      const tx = await validatorSet
        .connect(this.signers.delegator)
        .delegateToValidator(this.signers.validators[0].address, {
          value: delegateAmount,
        });

      await expect(tx, "DelegatorRewardClaimed")
        .to.emit(rewardPool, "DelegatorRewardClaimed")
        .withArgs(this.signers.validators[0].address, this.signers.delegator.address, delegatorReward);

      await expect(tx, "WithdrawalRegistered")
        .to.emit(validatorSet, "WithdrawalRegistered")
        .withArgs(this.signers.delegator.address, delegatorReward);

      await expect(tx, "Delegated")
        .to.emit(validatorSet, "Delegated")
        .withArgs(this.signers.validators[0].address, this.signers.delegator.address, delegateAmount);
    });
  });

  // TODO: vito: move into rewardPool tests
  describe("Claim", function () {
    it("should claim validator reward", async function () {
      const { systemValidatorSet, validatorSet, rewardPool } = await loadFixture(this.fixtures.delegatedFixture);

      await commitEpoch(
        systemValidatorSet,
        rewardPool,
        [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
        this.epochSize
      );

      const reward = await rewardPool.getValidatorReward(this.signers.validators[0].address);
      const tx = await rewardPool.connect(this.signers.validators[0])["claimValidatorReward()"]();
      const receipt = await tx.wait();

      const event = receipt.events?.find((log) => log.event === "ValidatorRewardClaimed");
      expect(event?.args?.validator, "event.arg.validator").to.equal(this.signers.validators[0].address);
      expect(event?.args?.amount, "event.arg.amount").to.equal(reward);

      await expect(tx, "WithdrawalRegistered")
        .to.emit(validatorSet, "WithdrawalRegistered")
        .withArgs(this.signers.validators[0].address, reward);
    });

    it("should claim delegator reward", async function () {
      const { systemValidatorSet, rewardPool } = await loadFixture(this.fixtures.delegatedFixture);

      await commitEpochs(
        systemValidatorSet,
        rewardPool,
        [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
        2, // number of epochs to commit
        this.epochSize
      );

      const reward = await rewardPool.getDelegatorReward(
        this.signers.validators[0].address,
        this.signers.delegator.address
      );

      const tx = await rewardPool.claimDelegatorReward(
        this.signers.validators[0].address,
        this.signers.delegator.address
      );
      const receipt = await tx.wait();
      const event = receipt.events?.find((log) => log.event === "DelegatorRewardClaimed");
      expect(event?.args?.validator, "event.arg.validator").to.equal(this.signers.validators[0].address);
      expect(event?.args?.delegator, "event.arg.delegator").to.equal(this.signers.delegator.address);
      expect(event?.args?.amount, "event.arg.amount").to.equal(reward);
    });
  });

  describe("Undelegate", async function () {
    it("should not be able to undelegate more than the delegated amount", async function () {
      const { validatorSet, rewardPool } = await loadFixture(this.fixtures.delegatedFixture);
      const delegatedAmount = await rewardPool.delegationOf(
        this.signers.validators[0].address,
        this.signers.delegator.address
      );

      await expect(
        validatorSet
          .connect(this.signers.delegator)
          .undelegate(this.signers.validators[0].address, delegatedAmount.add(1))
      )
        .to.be.revertedWithCustomError(validatorSet, "DelegateRequirement")
        .withArgs("undelegate", "INSUFFICIENT_BALANCE");
    });

    it("should not be able to undelegate such amount, so the left delegation is lower than minDelegation", async function () {
      const { validatorSet, rewardPool } = await loadFixture(this.fixtures.delegatedFixture);
      const delegatedAmount = await rewardPool.delegationOf(
        this.signers.validators[0].address,
        this.signers.delegator.address
      );

      await expect(
        validatorSet
          .connect(this.signers.delegator)
          .undelegate(this.signers.validators[0].address, delegatedAmount.sub(1))
      )
        .to.be.revertedWithCustomError(validatorSet, "DelegateRequirement")
        .withArgs("undelegate", "DELEGATION_TOO_LOW");
    });

    it("should not be able to exploit int overflow", async function () {
      const { validatorSet } = await loadFixture(this.fixtures.delegatedFixture);

      await expect(
        validatorSet
          .connect(this.signers.delegator)
          .undelegate(this.signers.validators[0].address, hre.ethers.constants.MaxInt256.add(1))
      ).to.be.reverted;
    });

    it("should partially undelegate", async function () {
      const { validatorSet, rewardPool } = await loadFixture(this.fixtures.delegatedFixture);

      const delegatedAmount = await rewardPool.delegationOf(
        this.signers.validators[0].address,
        this.signers.delegator.address
      );
      const expectedReward = await rewardPool.getDelegatorReward(
        this.signers.validators[0].address,
        this.signers.delegator.address
      );
      const undelegateAmount = this.minDelegation.div(2);
      const tx = await validatorSet
        .connect(this.signers.delegator)
        .undelegate(this.signers.validators[0].address, undelegateAmount);

      await expect(tx, "WithdrawalRegistered")
        .to.emit(validatorSet, "WithdrawalRegistered")
        .withArgs(this.signers.delegator.address, undelegateAmount.add(expectedReward));

      await expect(tx, "Undelegated")
        .to.emit(validatorSet, "Undelegated")
        .withArgs(this.signers.validators[0].address, this.signers.delegator.address, undelegateAmount);

      const delegatedAmountLeft = await rewardPool.delegationOf(
        this.signers.validators[0].address,
        this.signers.delegator.address
      );
      expect(delegatedAmountLeft, "delegatedAmountLeft").to.equal(delegatedAmount.sub(undelegateAmount));
    });

    it("should completely undelegate", async function () {
      const { validatorSet, rewardPool } = await loadFixture(this.fixtures.delegatedFixture);

      const delegatedAmount = await rewardPool.delegationOf(
        this.signers.validators[0].address,
        this.signers.delegator.address
      );
      const expectedReward = await rewardPool.getDelegatorReward(
        this.signers.validators[0].address,
        this.signers.delegator.address
      );
      const tx = await validatorSet
        .connect(this.signers.delegator)
        .undelegate(this.signers.validators[0].address, delegatedAmount);

      await expect(tx, "WithdrawalRegistered")
        .to.emit(validatorSet, "WithdrawalRegistered")
        .withArgs(this.signers.delegator.address, delegatedAmount.add(expectedReward));

      await expect(tx, "Undelegated")
        .to.emit(validatorSet, "Undelegated")
        .withArgs(this.signers.validators[0].address, this.signers.delegator.address, delegatedAmount);

      const delegatedAmountLeft = await rewardPool.delegationOf(
        this.signers.validators[0].address,
        this.signers.delegator.address
      );
      expect(delegatedAmountLeft, "delegatedAmountLeft").to.equal(0);
    });
  });

  describe("Delegation Vesting", async function () {
    let delegatedValidators: string[];
    let vestManagerOwners: SignerWithAddress[];

    before(async function () {
      // validator[2] delegates minDelegation and validator[1] delegates minDelegation.mul(2)
      delegatedValidators = [this.signers.validators[2].address, this.signers.validators[1].address];
      vestManagerOwners = [this.signers.accounts[4], this.signers.accounts[5]];
      console.log("=== hit before ===");
    });

    it("should have created a base implementation", async function () {
      const { validatorSet } = await loadFixture(this.fixtures.vestManagerFixture);

      const baseImplementation = await validatorSet.implementation();
      expect(baseImplementation).to.not.equal(hre.ethers.constants.AddressZero);
    });

    describe("newManager()", async function () {
      it("should revert when zero address", async function () {
        const { validatorSet } = await loadFixture(this.fixtures.vestManagerFixture);

        const zeroAddress = hre.ethers.constants.AddressZero;
        await impersonateAccount(zeroAddress);
        const zeroAddrSigner = await hre.ethers.getSigner(zeroAddress);
        await expect(validatorSet.connect(zeroAddrSigner).newManager()).to.be.revertedWith("INVALID_OWNER");
      });

      it("should successfully create new manager", async function () {
        const { validatorSet } = await loadFixture(this.fixtures.vestManagerFixture);

        const tx = await validatorSet.connect(this.signers.accounts[5]).newManager();
        const receipt = await tx.wait();
        const event = receipt.events?.find((e) => e.event === "NewClone");
        const address = event?.args?.newClone;

        expect(address).to.not.equal(hre.ethers.constants.AddressZero);
      });

      it("should have initialized the manager", async function () {
        const { validatorSet, vestManager } = await loadFixture(this.fixtures.vestManagerFixture);

        expect(await vestManager.owner(), "owner").to.equal(vestManagerOwners[0].address);
        expect(await vestManager.staking(), "staking").to.equal(validatorSet.address);
      });

      it("should set manager in mappings", async function () {
        const { validatorSet, vestManager } = await loadFixture(this.fixtures.vestManagerFixture);

        expect(await validatorSet.vestManagers(vestManager.address), "vestManagers").to.equal(
          vestManagerOwners[0].address
        );
        expect(await validatorSet.userVestManagers(vestManagerOwners[0].address, 0), "userVestManagers").to.equal(
          vestManager.address
        );
        expect(
          (await validatorSet.getUserVestManagers(vestManagerOwners[0].address)).length,
          "getUserVestManagers"
        ).to.equal(1);
      });
    });

    describe("openVestedDelegatePosition()", async function () {
      it("should revert when not manager", async function () {
        const { validatorSet } = await loadFixture(this.fixtures.vestManagerFixture);

        await expect(
          validatorSet.connect(this.signers.accounts[3]).openVestedDelegatePosition(this.signers.accounts[3].address, 1)
        ).to.be.revertedWithCustomError(validatorSet, "NotVestingManager");
      });

      it("should revert when validator is inactive", async function () {
        const { validatorSet, vestManager } = await loadFixture(this.fixtures.vestManagerFixture);

        await expect(
          vestManager.connect(vestManagerOwners[0]).openDelegatorPosition(this.signers.accounts[10].address, 1, {
            value: this.minDelegation,
          })
        )
          .to.be.revertedWithCustomError(validatorSet, "Unauthorized")
          .withArgs("INVALID_VALIDATOR");
      });

      it("should revert when delegation too low", async function () {
        const { validatorSet, vestManager } = await loadFixture(this.fixtures.vestManagerFixture);

        await expect(
          vestManager.connect(vestManagerOwners[0]).openDelegatorPosition(this.signers.validators[2].address, 1, {
            value: this.minDelegation.div(2),
          })
        )
          .to.be.revertedWithCustomError(validatorSet, "DelegateRequirement")
          .withArgs("vesting", "DELEGATION_TOO_LOW");
      });

      it("should properly open vesting position", async function () {
        const { vestManager } = await loadFixture(this.fixtures.vestManagerFixture);

        const vestingDuration = 52; // in weeks
        await expect(
          await vestManager.openDelegatorPosition(delegatedValidators[0], vestingDuration, {
            value: this.minDelegation,
          })
        ).to.not.be.reverted;
      });

      it("should revert when maturing position", async function () {
        const { validatorSet, vestManager } = await loadFixture(this.fixtures.vestedDelegationFixture);

        // enter the reward maturity phase
        await time.increase(WEEK * 55);

        const vestingDuration = 52; // in weeks
        await expect(
          vestManager.openDelegatorPosition(delegatedValidators[0], vestingDuration, {
            value: this.minDelegation,
          })
        )
          .to.be.revertedWithCustomError(validatorSet, "DelegateRequirement")
          .withArgs("vesting", "POSITION_MATURING");
      });

      it("should revert when active position", async function () {
        const { validatorSet, vestManager } = await loadFixture(this.fixtures.vestedDelegationFixture);

        const vestingDuration = 52; // in weeks
        await expect(
          vestManager.openDelegatorPosition(delegatedValidators[0], vestingDuration, {
            value: this.minDelegation,
          })
        )
          .to.be.revertedWithCustomError(validatorSet, "DelegateRequirement")
          .withArgs("vesting", "POSITION_ACTIVE");
      });

      it("should revert when reward not claimed", async function () {
        const { validatorSet, rewardPool, vestManager } = await loadFixture(this.fixtures.vestedDelegationFixture);

        // go beyond vesting period and maturing phases
        await time.increase(WEEK * 110);

        const vestingDuration = 52; // in weeks
        const currentReward = await rewardPool.getDelegatorReward(
          this.signers.validators[2].address,
          vestManager.address
        );

        expect(currentReward, "currentReward").to.be.gt(0);
        await expect(
          vestManager.openDelegatorPosition(delegatedValidators[0], vestingDuration, {
            value: this.minDelegation,
          })
        )
          .to.be.revertedWithCustomError(validatorSet, "DelegateRequirement")
          .withArgs("vesting", "REWARDS_NOT_CLAIMED");
      });

      it("should successfully open vesting position again", async function () {
        const { validatorSet, rewardPool, vestManager } = await loadFixture(this.fixtures.vestedDelegationFixture);

        // go beyond vesting period and maturing phases
        await time.increase(WEEK * 110);

        const vestingDuration = 52; // in weeks
        let currentReward = await rewardPool.getDelegatorReward(
          this.signers.validators[2].address,
          vestManager.address
        );

        await claimPositionRewards(validatorSet, rewardPool, vestManager, delegatedValidators[0]);

        currentReward = await rewardPool.getDelegatorReward(this.signers.validators[2].address, vestManager.address);
        expect(currentReward, "currentReward").to.be.equal(0);

        const delegatedAmount = await rewardPool.delegationOf(delegatedValidators[0], vestManager.address);
        const amountToDelegate = this.minDelegation.mul(2);
        const tx = await vestManager.openDelegatorPosition(delegatedValidators[0], vestingDuration, {
          value: amountToDelegate,
        });

        await expect(tx)
          .to.emit(validatorSet, "PositionOpened")
          .withArgs(vestManager.address, delegatedValidators[0], vestingDuration, amountToDelegate);

        expect(await rewardPool.delegationOf(delegatedValidators[0], vestManager.address)).to.be.equal(
          delegatedAmount.add(amountToDelegate)
        );
      });
    });

    describe("cutDelegatePosition()", async function () {
      it("should revert when insufficient balance", async function () {
        const { validatorSet, rewardPool, vestManager, liquidToken } = await loadFixture(
          this.fixtures.vestedDelegationFixture
        );

        const balance = await rewardPool.delegationOf(delegatedValidators[0], vestManager.address);

        // send one more token so liquid tokens balance is enough
        const user2 = this.signers.accounts[7];
        await validatorSet.connect(user2).newManager();
        const VestManagerFactory = new VestManager__factory(vestManagerOwners[0]);
        const manager2 = await getUserManager(validatorSet, user2, VestManagerFactory);

        await manager2.openDelegatorPosition(delegatedValidators[0], 1, {
          value: this.minDelegation.mul(2),
        });

        await liquidToken.connect(user2).transfer(vestManagerOwners[0].address, 1);
        const balanceToCut = balance.add(1);
        await liquidToken.connect(vestManagerOwners[0]).approve(vestManager.address, balanceToCut);
        await expect(vestManager.cutPosition(delegatedValidators[0], balanceToCut))
          .to.be.revertedWithCustomError(validatorSet, "DelegateRequirement")
          .withArgs("vesting", "INSUFFICIENT_BALANCE");
      });

      it("should revert when delegation too low", async function () {
        const { validatorSet, rewardPool, vestManager, liquidToken } = await loadFixture(
          this.fixtures.vestedDelegationFixture
        );

        const balance = await rewardPool.delegationOf(delegatedValidators[0], vestManager.address);
        const balanceToCut = balance.sub(1);
        await liquidToken.connect(vestManagerOwners[0]).approve(vestManager.address, balanceToCut);
        await expect(vestManager.cutPosition(delegatedValidators[0], balanceToCut))
          .to.be.revertedWithCustomError(validatorSet, "DelegateRequirement")
          .withArgs("vesting", "DELEGATION_TOO_LOW");
      });

      it("should slash the amount when in active position", async function () {
        const { systemValidatorSet, validatorSet, rewardPool, vestManagers, liquidToken } = await loadFixture(
          this.fixtures.multipleVestedDelegationsFixture
        );

        // const user = vestManagerOwners[0];
        // const validator = this.signers.accounts[2].address;
        // const VestManagerFactory = new VestManager__factory(vestManagerOwners[0]);
        // const manager = await getUserManager(validatorSet, user, VestManagerFactory);
        // const vestingDuration = 52; // in weeks

        await claimPositionRewards(validatorSet, rewardPool, vestManagers[0], delegatedValidators[0]);
        await claimPositionRewards(validatorSet, rewardPool, vestManagers[1], delegatedValidators[1]);

        // await vestManager.openDelegatorPosition(delegatedValidators[0], vestingDuration, {
        //   value: this.minDelegation.mul(2),
        // });
        const position = await rewardPool.delegationPositions(delegatedValidators[1], vestManagers[1].address);

        // clear pending withdrawals
        await commitEpoch(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          this.epochSize
        );
        await vestManagers[0].withdraw(vestManagerOwners[0].address);
        await vestManagers[1].withdraw(vestManagerOwners[1].address);

        // ensure position is active
        const isActive = await rewardPool.isActiveDelegatePosition(delegatedValidators[1], vestManagers[1].address);
        expect(isActive, "isActive").to.be.true;

        // check is amount properly removed from delegation
        const delegatedBalanceBefore = await rewardPool.delegationOf(delegatedValidators[1], vestManagers[1].address);
        const cutAmount = delegatedBalanceBefore.div(2);
        // const position = await rewardPool.delegationPositions(delegatedValidators[1], vestManagers[1].address);
        const penalty = await calculatePenalty(position, cutAmount);
        // fullReward = applyMaxReward(delegation.claimRewards(delegator));
        const delegatorReward = await rewardPool.getDelegatorReward(delegatedValidators[1], vestManagers[1].address);
        const fullReward = await rewardPool.applyMaxReward(delegatorReward);
        const amountToBeBurned = penalty.add(fullReward);
        console.log(
          `=== cutAmount: ${cutAmount}, penalty: ${penalty}, delegatorReward: ${delegatorReward}, fullReward: ${fullReward}, amountToBeBurned: ${amountToBeBurned}`
        );

        // Hydra TODO: Create table-driven unit tests with precalculated values to test the exact amounts
        // check if amount is properly burned
        // const end = position.end;
        // const rpsValues = await childValidatorSet.getRPSValues(validator);
        // const epochNum = findProperRPSIndex(rpsValues, end);
        // const topUpIndex = 0;
        // let reward = await childValidatorSet.getDelegatorPositionReward(
        //   validator,
        //   manager.address,
        //   epochNum,
        //   topUpIndex
        // );
        // reward = await childValidatorSet.applyMaxReward(reward);
        // const decrease = reward.add(amountToBeBurned);
        // await expect(manager.cutPosition(validator, cutAmount)).to.changeEtherBalance(
        //   childValidatorSet,
        //   decrease.mul(-1)
        // );

        await liquidToken.connect(vestManagerOwners[1]).approve(vestManagers[1].address, cutAmount);

        // set next block timestamp so half of the vesting period passed
        const nextBlockTimestamp = position.duration.div(2).add(position.start);
        await time.setNextBlockTimestamp(nextBlockTimestamp);

        await vestManagers[1].cutPosition(delegatedValidators[1], cutAmount);

        const delegatedBalanceAfter = await rewardPool.delegationOf(delegatedValidators[1], vestManagers[1].address);
        expect(delegatedBalanceAfter, "delegatedBalanceAfter").to.be.eq(delegatedBalanceBefore.sub(cutAmount));

        // claimableRewards must be 0
        const claimableRewards = await rewardPool.getDelegatorReward(delegatedValidators[1], vestManagers[1].address);
        expect(claimableRewards, "claimableRewards").to.be.eq(0);

        // check if amount is properly slashed
        const balanceBefore = await vestManagerOwners[1].getBalance();
        console.log("=== balanceBefore: ", balanceBefore);

        // commit Epoch so reward is available for withdrawal
        await commitEpoch(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          this.epochSize
        );
        await vestManagers[1].withdraw(vestManagerOwners[1].address);

        // 9998000000000000000000
        // 9998500000000000000000
        //     500000000000000000
        //     999999427655677655
        //               30133928

        // const balanceAfter = await vestManagerOwners[1].getBalance();
        // console.log("=== balanceAfter: ", balanceAfter);
        // // cut half of the requested amount because half of the vesting period is still not passed
        // expect(balanceAfter.sub(balanceBefore)).to.be.eq(amountToBeBurned);
      });

      it("should properly cut position", async function () {
        const { systemValidatorSet, rewardPool, vestManagers, liquidToken } = await loadFixture(
          this.fixtures.multipleVestedDelegationsFixture
        );

        // commit Epoch so reward is made
        await commitEpochs(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          3,
          this.epochSize
        );

        const reward = await rewardPool.getDelegatorReward(delegatedValidators[0], vestManagers[0].address);
        expect(reward, "reward").to.not.be.eq(0);

        // Finish the vesting period
        await time.increase(WEEK * 60);

        const balanceBefore = await vestManagerOwners[0].getBalance();
        const delegatedBalance = await rewardPool.delegationOf(delegatedValidators[0], vestManagers[0].address);
        expect(delegatedBalance, "delegatedBalance").to.not.be.eq(0);

        await liquidToken.connect(vestManagerOwners[0]).approve(vestManagers[0].address, delegatedBalance);
        await vestManagers[0].cutPosition(delegatedValidators[0], delegatedBalance);

        // commit one more epoch so withdraw to be available
        await commitEpochs(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          3,
          this.epochSize
        );
        await vestManagers[0].withdraw(vestManagerOwners[0].address);

        const balanceAfter = await vestManagerOwners[0].getBalance();

        expect(balanceAfter, "balanceAfter").to.be.eq(balanceBefore.add(delegatedBalance));

        // check is amount properly removed from delegation
        expect(await rewardPool.delegationOf(delegatedValidators[0], vestManagers[0].address)).to.be.eq(0);

        // ensure reward is still available for withdrawal
        const rewardAfter = await rewardPool.getDelegatorReward(delegatedValidators[0], vestManagers[0].address);
        expect(rewardAfter).to.be.eq(reward);
      });

      it("should delete position when closing it", async function () {
        const { rewardPool, vestManagers, liquidToken } = await loadFixture(
          this.fixtures.multipleVestedDelegationsFixture
        );

        // cut position
        const delegatedAmount = await rewardPool.delegationOf(delegatedValidators[0], vestManagers[0].address);
        await liquidToken.connect(vestManagerOwners[0]).approve(vestManagers[0].address, delegatedAmount);
        await vestManagers[0].cutPosition(delegatedValidators[0], delegatedAmount);
        expect((await rewardPool.delegationPositions(delegatedValidators[0], vestManagers[0].address)).start).to.be.eq(
          0
        );
      });
    });

    describe("topUpPosition()", async function () {
      it("should revert when not owner of the vest manager", async function () {
        const { vestManagers } = await loadFixture(this.fixtures.multipleVestedDelegationsFixture);

        await expect(
          vestManagers[0]
            .connect(this.signers.accounts[10])
            .topUpPosition(this.signers.accounts[10].address, { value: this.minDelegation })
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("should revert when not manager", async function () {
        const { validatorSet } = await loadFixture(this.fixtures.multipleVestedDelegationsFixture);

        await expect(
          validatorSet
            .connect(this.signers.accounts[10])
            .topUpDelegatePosition(this.signers.accounts[10].address, { value: this.minDelegation })
        ).to.be.revertedWithCustomError(validatorSet, "NotVestingManager");
      });

      it("should revert when delegation too low", async function () {
        const { validatorSet, vestManagers } = await loadFixture(this.fixtures.multipleVestedDelegationsFixture);

        await expect(
          vestManagers[0].topUpPosition(this.signers.validators[0].address, { value: this.minDelegation.sub(1) })
        )
          .to.be.revertedWithCustomError(validatorSet, "DelegateRequirement")
          .withArgs("vesting", "DELEGATION_TOO_LOW");
      });

      it("should revert when position is not active", async function () {
        const { validatorSet, vestManagers } = await loadFixture(this.fixtures.multipleVestedDelegationsFixture);

        // enter the reward maturity phase
        await time.increase(WEEK * 55);
        await expect(vestManagers[0].topUpPosition(delegatedValidators[0], { value: this.minDelegation }))
          .to.be.revertedWithCustomError(validatorSet, "DelegateRequirement")
          .withArgs("vesting", "POSITION_NOT_ACTIVE");
      });

      it("should properly top-up position", async function () {
        const { validatorSet, rewardPool, vestManagers } = await loadFixture(
          this.fixtures.multipleVestedDelegationsFixture
        );

        const delegatedBalanceBefore = await rewardPool.delegationOf(delegatedValidators[0], vestManagers[0].address);
        const totalAmount = delegatedBalanceBefore.add(this.minDelegation);
        const positionEndBefore = (
          await rewardPool.delegationPositions(delegatedValidators[0], vestManagers[0].address)
        ).end;

        await vestManagers[0].topUpPosition(delegatedValidators[0], { value: this.minDelegation });

        // delegation is increased
        const delegatedBalanceAfter = await rewardPool.delegationOf(delegatedValidators[0], vestManagers[0].address);
        expect(delegatedBalanceAfter, "delegatedBalanceAfter").to.be.eq(totalAmount);

        // balance change data is added
        const balanceChange = await rewardPool.delegationPoolParamsHistory(
          delegatedValidators[0],
          vestManagers[0].address,
          1
        );
        expect(balanceChange.balance, "balance change").to.be.eq(totalAmount);
        expect(balanceChange.epochNum, "epochNum").to.be.eq(await validatorSet.currentEpochId());

        // duration increase is proper
        const position = await rewardPool.delegationPositions(delegatedValidators[0], vestManagers[0].address);
        expect(position.end).to.be.eq(positionEndBefore.add(WEEK * 52));
      });

      it("should revert when too many top-ups are made", async function () {
        const { systemValidatorSet, validatorSet, rewardPool, vestManagers } = await loadFixture(
          this.fixtures.multipleVestedDelegationsFixture
        );

        const maxTopUps = 52; // one cannot top-up more than 52 times
        for (let i = 0; i < maxTopUps; i++) {
          const delegatingAmount = this.minDelegation.mul(i + 1).div(5);
          await vestManagers[0].topUpPosition(delegatedValidators[0], { value: delegatingAmount });

          // commit epoch cause only 1 top-up can be made per epoch
          await commitEpoch(
            systemValidatorSet,
            rewardPool,
            [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
            this.epochSize
          );
        }

        await expect(vestManagers[0].topUpPosition(delegatedValidators[0], { value: this.minDelegation }))
          .to.be.revertedWithCustomError(validatorSet, "DelegateRequirement")
          .withArgs("vesting", "TOO_MANY_TOP_UPS");
      });

      it("should revert when top-up already made in the same epoch", async function () {
        const { validatorSet, vestManagers } = await loadFixture(this.fixtures.multipleVestedDelegationsFixture);

        await vestManagers[0].topUpPosition(delegatedValidators[0], { value: this.minDelegation });

        await expect(vestManagers[0].topUpPosition(delegatedValidators[0], { value: this.minDelegation }))
          .to.be.revertedWithCustomError(validatorSet, "DelegateRequirement")
          .withArgs("vesting", "TOPUP_ALREADY_MADE");
      });

      it("should increase duration no more than 100%", async function () {
        const { rewardPool, vestManagers } = await loadFixture(this.fixtures.multipleVestedDelegationsFixture);

        const positionBeforeTopUp = await rewardPool.delegationPositions(
          delegatedValidators[0],
          vestManagers[0].address
        );

        const topUpAmount = (await rewardPool.delegationOf(delegatedValidators[0], vestManagers[0].address)).mul(2);
        await vestManagers[0].topUpPosition(delegatedValidators[0], { value: topUpAmount.add(this.minDelegation) });

        const vestingEndAfter = (await rewardPool.delegationPositions(delegatedValidators[0], vestManagers[0].address))
          .end;
        expect(vestingEndAfter, "vestingEndAfter").to.be.eq(positionBeforeTopUp.end.add(positionBeforeTopUp.duration));
      });

      it("should revert when top-up closed position", async function () {
        const { validatorSet, rewardPool, vestManagers, liquidToken } = await loadFixture(
          this.fixtures.multipleVestedDelegationsFixture
        );

        // close position
        const delegatedAmount = await rewardPool.delegationOf(delegatedValidators[0], vestManagers[0].address);
        await liquidToken.connect(vestManagerOwners[0]).approve(vestManagers[0].address, delegatedAmount);
        await vestManagers[0].cutPosition(delegatedValidators[0], delegatedAmount);

        // top-up
        await expect(vestManagers[0].topUpPosition(delegatedValidators[0], { value: this.minDelegation }))
          .to.be.revertedWithCustomError(validatorSet, "DelegateRequirement")
          .withArgs("vesting", "POSITION_NOT_ACTIVE");
      });
    });

    // TODO: vito: move into rewardPool tests
    describe("claimPositionReward()", async function () {
      it("should revert when not manager", async function () {
        const { validatorSet } = await loadFixture(this.fixtures.multipleVestedDelegationsFixture);

        await expect(
          validatorSet.connect(this.signers.accounts[10]).claimPositionReward(delegatedValidators[0], 0, 0)
        ).to.be.revertedWithCustomError(validatorSet, "NotVestingManager");
      });

      it("should return when active position", async function () {
        const { systemValidatorSet, validatorSet, rewardPool, vestManagers } = await loadFixture(
          this.fixtures.multipleVestedDelegationsFixture
        );

        // ensure is active position
        expect(await rewardPool.isActiveDelegatePosition(delegatedValidators[1], vestManagers[1].address), "isActive")
          .to.be.true;

        // reward to be accumulated
        await commitEpoch(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          this.epochSize
        );
        // withdraw previous amounts
        await vestManagers[1].withdraw(vestManagerOwners[1].address);

        expect(
          await rewardPool.getDelegatorReward(delegatedValidators[1], vestManagers[1].address),
          "getDelegatorReward"
        ).to.be.gt(0);

        // claim
        await vestManagers[1].claimPositionReward(delegatedValidators[1], 0, 0);
        expect(await validatorSet.withdrawable(vestManagers[1].address), "withdrawable").to.be.eq(0);
      });

      it("should return when unused position", async function () {
        const { validatorSet, rewardPool, liquidToken, vestManagers } = await loadFixture(
          this.fixtures.multipleVestedDelegationsFixture
        );

        const delegatedAmount = await rewardPool.delegationOf(delegatedValidators[1], vestManagers[1].address);
        // ensure is active position
        expect(await rewardPool.isActiveDelegatePosition(delegatedValidators[1], vestManagers[1].address), "isActive")
          .to.be.true;

        await liquidToken.connect(vestManagerOwners[1]).approve(vestManagers[1].address, delegatedAmount);
        await vestManagers[1].cutPosition(delegatedValidators[1], delegatedAmount);

        // check reward
        expect(
          await rewardPool.getDelegatorReward(delegatedValidators[1], vestManagers[1].address),
          "getDelegatorReward"
        ).to.be.eq(0);
        expect(await validatorSet.withdrawable(vestManagers[1].address), "withdrawable").to.eq(0);
      });

      it("should revert when wrong rps index is provided", async function () {
        const { systemValidatorSet, validatorSet, rewardPool, vestManagers } = await loadFixture(
          this.fixtures.multipleVestedDelegationsFixture
        );

        // Finish the vesting period
        await time.increase(WEEK * 52);

        const position = await rewardPool.delegationPositions(delegatedValidators[1], vestManagers[1].address);
        const end = position.end;
        const currentEpochId = await validatorSet.currentEpochId();
        const rpsValues = await rewardPool.getRPSValues(delegatedValidators[1], currentEpochId);
        const epochNum = findProperRPSIndex(rpsValues, end);
        const topUpIndex = 0;

        await expect(
          vestManagers[1].claimPositionReward(delegatedValidators[1], epochNum + 1, topUpIndex),
          "claimPositionReward"
        )
          .to.be.revertedWithCustomError(validatorSet, "DelegateRequirement")
          .withArgs("vesting", "INVALID_EPOCH");

        // commit epoch
        await commitEpoch(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          this.epochSize
        );

        await expect(
          vestManagers[1].claimPositionReward(delegatedValidators[1], epochNum + 1, topUpIndex),
          "claimPositionReward2"
        )
          .to.be.revertedWithCustomError(validatorSet, "DelegateRequirement")
          .withArgs("vesting", "WRONG_RPS");
      });

      it("should properly claim reward when no top-ups and not full reward matured", async function () {
        const { systemValidatorSet, validatorSet, rewardPool, vestManagers } = await loadFixture(
          this.fixtures.multipleVestedDelegationsFixture
        );

        // calculate base reward
        const baseReward = await rewardPool.getRawDelegatorReward(delegatedValidators[1], vestManagers[1].address);
        const base = await rewardPool.getBase();
        const vestBonus = await rewardPool.getVestingBonus(1);
        const rsi = await rewardPool.getRSI();
        const expectedReward = base
          .add(vestBonus)
          .mul(rsi)
          .mul(baseReward)
          .div(10000 * 10000)
          .div(this.epochsInYear);

        // calculate max reward
        const maxRSI = await rewardPool.getMaxRSI();
        const maxVestBonus = await rewardPool.getVestingBonus(52);
        const maxReward = base
          .add(maxVestBonus)
          .mul(maxRSI)
          .mul(baseReward)
          .div(10000 * 10000)
          .div(this.epochsInYear);

        // enter the maturing state
        await time.increase(WEEK * 52 + 1);

        // commit epoch, so more reward is added that must not be claimed now
        await commitEpoch(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          this.epochSize
        );

        // prepare params for call
        const position = await rewardPool.delegationPositions(delegatedValidators[1], vestManagers[1].address);
        const end = position.end;
        const currentEpochId = await validatorSet.currentEpochId();
        const rpsValues = await rewardPool.getRPSValues(delegatedValidators[1], currentEpochId);
        const epochNum = findProperRPSIndex(rpsValues, end);
        // when there are no top ups, just set 0, because it is not actually checked
        const topUpIndex = 0;

        await expect(
          await vestManagers[1].claimPositionReward(delegatedValidators[1], epochNum, topUpIndex),
          "claimPositionReward"
        ).to.changeEtherBalances(
          [validatorSet.address, hre.ethers.constants.AddressZero],
          [maxReward.sub(expectedReward).mul(-1), maxReward.sub(expectedReward)]
        );

        // Commit one more epoch so withdraw to be available
        await commitEpoch(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          this.epochSize
        );
        await expect(await vestManagers[1].withdraw(vestManagerOwners[1].address), "withdraw").to.changeEtherBalances(
          [vestManagerOwners[1].address, validatorSet.address],
          [expectedReward, expectedReward.mul(-1)]
        );
      });

      it("should properly claim reward when no top-ups and full reward matured", async function () {
        const { systemValidatorSet, validatorSet, rewardPool, vestManagers } = await loadFixture(
          this.fixtures.multipleVestedDelegationsFixture
        );

        // calculate reward
        const baseReward = await rewardPool.getRawDelegatorReward(delegatedValidators[1], vestManagers[1].address);
        const base = await rewardPool.getBase();
        const vestBonus = await rewardPool.getVestingBonus(1);
        const rsi = await rewardPool.getRSI();
        const expectedReward = base
          .add(vestBonus)
          .mul(rsi)
          .mul(baseReward)
          .div(10000 * 10000)
          .div(this.epochsInYear);

        // calculate max reward
        const maxRSI = await rewardPool.getMaxRSI();
        const maxVestBonus = await rewardPool.getVestingBonus(52);
        const maxReward = base
          .add(maxVestBonus)
          .mul(maxRSI)
          .mul(baseReward)
          .div(10000 * 10000)
          .div(this.epochsInYear);

        // ensure maturing has finished
        await time.increase(WEEK * 52 * 10 + 1);

        // more rewards to be distributed but with the top-up data
        await commitEpoch(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          this.epochSize
        );

        const additionalReward = (
          await rewardPool.getRawDelegatorReward(delegatedValidators[1], vestManagers[1].address)
        ).sub(baseReward);

        const expectedAdditionalReward = base.mul(additionalReward).div(10000).div(this.epochsInYear);

        const maxAdditionalReward = base
          .add(maxVestBonus)
          .mul(maxRSI)
          .mul(additionalReward)
          .div(10000 * 10000)
          .div(this.epochsInYear);

        // prepare params for call
        const position = await rewardPool.delegationPositions(delegatedValidators[1], vestManagers[1].address);
        const end = position.end;
        const currentEpochId = await validatorSet.currentEpochId();
        const rpsValues = await rewardPool.getRPSValues(delegatedValidators[1], currentEpochId);
        const epochNum = findProperRPSIndex(rpsValues, end);
        // When there are no top ups, just set 0, because it is not actually checked
        const topUpIndex = 0;

        // ensure rewards are matured
        const areRewardsMatured = position.end.add(position.duration).lt(await time.latest());
        expect(areRewardsMatured, "areRewardsMatured").to.be.true;

        const expectedFinalReward = expectedReward.add(expectedAdditionalReward);

        const maxFinalReward = maxReward.add(maxAdditionalReward);

        await expect(
          await vestManagers[1].claimPositionReward(delegatedValidators[1], epochNum, topUpIndex),
          "claimPositionReward"
        ).to.changeEtherBalances(
          [validatorSet.address, hre.ethers.constants.AddressZero],
          [maxFinalReward.sub(expectedFinalReward).mul(-1), maxFinalReward.sub(expectedFinalReward)]
        );

        // commit one more epoch so withdraw to be available
        await commitEpoch(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          this.epochSize
        );

        await expect(await vestManagers[1].withdraw(vestManagerOwners[1].address), "withdraw").to.changeEtherBalances(
          [vestManagerOwners[1].address, validatorSet.address],
          [expectedFinalReward, expectedFinalReward.mul(-1)]
        );
      });

      it("should properly claim reward when top-ups and not full reward matured", async function () {
        const { systemValidatorSet, validatorSet, rewardPool, vestManagers } = await loadFixture(
          this.fixtures.multipleVestedDelegationsFixture
        );

        // calculate reward
        const baseReward = await rewardPool.getRawDelegatorReward(delegatedValidators[1], vestManagers[1].address);
        const base = await rewardPool.getBase();
        const vestBonus = await rewardPool.getVestingBonus(1);
        const rsi = await rewardPool.getRSI();
        const expectedBaseReward = base
          .add(vestBonus)
          .mul(rsi)
          .mul(baseReward)
          .div(10000 * 10000)
          .div(this.epochsInYear);

        // top-up
        await vestManagers[1].topUpPosition(delegatedValidators[1], { value: this.minDelegation });

        // more rewards to be distributed but with the top-up data
        await commitEpoch(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          this.epochSize
        );

        const topUpRewardsTimestamp = await time.latest();
        const position = await rewardPool.delegationPositions(delegatedValidators[1], vestManagers[1].address);
        const toBeMatured = hre.ethers.BigNumber.from(topUpRewardsTimestamp).sub(position.start);

        const topUpReward = (
          await rewardPool.getRawDelegatorReward(delegatedValidators[1], vestManagers[1].address)
        ).sub(baseReward);
        // no rsi because top-up is used
        const defaultRSI = await rewardPool.getDefaultRSI();
        const expectedTopUpReward = base
          .add(vestBonus)
          .mul(defaultRSI)
          .mul(topUpReward)
          .div(10000 * 10000)
          .div(this.epochsInYear);

        const expectedReward = expectedBaseReward.add(expectedTopUpReward);

        // calculate max reward
        const maxRSI = await rewardPool.getMaxRSI();
        const maxVestBonus = await rewardPool.getVestingBonus(52);
        const maxBaseReward = base
          .add(maxVestBonus)
          .mul(maxRSI)
          .mul(baseReward)
          .div(10000 * 10000)
          .div(this.epochsInYear);
        const maxTopUpReward = base
          .add(maxVestBonus)
          .mul(maxRSI)
          .mul(topUpReward)
          .div(10000 * 10000)
          .div(this.epochsInYear);
        const maxReward = maxBaseReward.add(maxTopUpReward);

        // enter the maturing state
        // two week is the duration + the needed time for the top-up to be matured
        await time.increase(WEEK * 104 + toBeMatured.toNumber() + 1);

        // commit epoch, so more reward is added that must not be claimed now
        await commitEpoch(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          this.epochSize
        );

        // prepare params for call
        const end = position.end;
        const currentEpochId = await validatorSet.currentEpochId();
        const rpsValues = await rewardPool.getRPSValues(delegatedValidators[1], currentEpochId);
        const epochNum = findProperRPSIndex(rpsValues, end);
        // 1 because we have only one top-up
        const topUpIndex = 1;

        // ensure rewards are maturing
        const areRewardsMatured = position.end.add(toBeMatured).lt(await time.latest());
        expect(areRewardsMatured, "areRewardsMatured").to.be.true;

        await expect(
          await vestManagers[1].claimPositionReward(delegatedValidators[1], epochNum, topUpIndex),
          "claimPositionReward"
        ).to.changeEtherBalances(
          [validatorSet.address, hre.ethers.constants.AddressZero],
          [maxReward.sub(expectedReward).mul(-1), maxReward.sub(expectedReward)]
        );

        // commit one more epoch so withdraw to be available
        await commitEpoch(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          this.epochSize
        );
        await expect(await vestManagers[1].withdraw(vestManagerOwners[1].address), "withdraw").to.changeEtherBalances(
          [vestManagerOwners[1].address, validatorSet.address],
          [expectedReward, expectedReward.mul(-1)]
        );
      });

      it("should properly claim reward when top-ups and full reward matured", async function () {
        const { systemValidatorSet, validatorSet, rewardPool, vestManagers } = await loadFixture(
          this.fixtures.multipleVestedDelegationsFixture
        );

        // calculate reward
        const baseReward = await rewardPool.getRawDelegatorReward(delegatedValidators[1], vestManagers[1].address);
        const base = await rewardPool.getBase();
        const vestBonus = await rewardPool.getVestingBonus(1);
        const rsi = await rewardPool.getRSI();
        // Default RSI because we use top-up
        const defaultRSI = await rewardPool.getDefaultRSI();

        // top-up
        await vestManagers[1].topUpPosition(delegatedValidators[1], { value: this.minDelegation });

        // more rewards to be distributed but with the top-up data
        await commitEpoch(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          this.epochSize
        );

        const topUpReward = (
          await rewardPool.getRawDelegatorReward(delegatedValidators[1], vestManagers[1].address)
        ).sub(baseReward);
        const expectedBaseReward = base
          .add(vestBonus)
          .mul(rsi)
          .mul(baseReward)
          .div(10000 * 10000)
          .div(this.epochsInYear);

        const expectedTopUpReward = base
          .add(vestBonus)
          .mul(defaultRSI)
          .mul(topUpReward)
          .div(10000 * 10000)
          .div(this.epochsInYear);

        const expectedReward = expectedBaseReward.add(expectedTopUpReward);

        // calculate max reward
        const maxRSI = await rewardPool.getMaxRSI();
        const maxVestBonus = await rewardPool.getVestingBonus(52);
        const maxBaseReward = base
          .add(maxVestBonus)
          .mul(maxRSI)
          .mul(baseReward)
          .div(10000 * 10000)
          .div(this.epochsInYear);

        const maxTopUpReward = base
          .add(maxVestBonus)
          .mul(maxRSI)
          .mul(topUpReward)
          .div(10000 * 10000)
          .div(this.epochsInYear);

        const maxReward = maxBaseReward.add(maxTopUpReward);
        // enter the maturing state
        // 52 weeks is the duration + the needed time for the top-up to be matured
        await time.increase(WEEK * 104 * 5 + 1);

        // comit epoch, so more reward is added that must be without bonus
        await commitEpoch(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          this.epochSize
        );

        const additionalReward = (
          await rewardPool.getRawDelegatorReward(delegatedValidators[1], vestManagers[1].address)
        ).sub(baseReward.add(topUpReward));
        const expectedAdditionalReward = base.mul(additionalReward).div(10000).div(this.epochsInYear);
        const maxAdditionalReward = base
          .add(maxVestBonus)
          .mul(maxRSI)
          .mul(additionalReward)
          .div(10000 * 10000)
          .div(this.epochsInYear);

        // prepare params for call
        const position = await rewardPool.delegationPositions(delegatedValidators[1], vestManagers[1].address);
        const end = position.end;
        const currentEpochId = await validatorSet.currentEpochId();
        const rpsValues = await rewardPool.getRPSValues(delegatedValidators[1], currentEpochId);
        const epochNum = findProperRPSIndex(rpsValues, end);
        // 1 because we have only one top-up, but the first is for the openDelegatorPosition
        const topUpIndex = 1;

        // ensure rewards are matured
        const areRewardsMatured = position.end.add(position.duration).lt(await time.latest());
        expect(areRewardsMatured, "areRewardsMatured").to.be.true;

        const expectedFinalReward = expectedReward.add(expectedAdditionalReward);
        const maxFinalReward = maxReward.add(maxAdditionalReward);

        await expect(
          await vestManagers[1].claimPositionReward(delegatedValidators[1], epochNum, topUpIndex),
          "claimPositionReward"
        ).to.changeEtherBalances(
          [validatorSet.address, hre.ethers.constants.AddressZero],
          [maxFinalReward.sub(expectedFinalReward).mul(-1), maxFinalReward.sub(expectedFinalReward)]
        );

        // commit one more epoch so withdraw to be available
        await commitEpoch(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          this.epochSize
        );
        await expect(await vestManagers[1].withdraw(vestManagerOwners[1].address), "withdraw").to.changeEtherBalances(
          [vestManagerOwners[1].address, validatorSet.address],
          [expectedFinalReward, expectedFinalReward.mul(-1)]
        );
      });

      it("should revert when invalid top-up index", async function () {
        const { systemValidatorSet, validatorSet, rewardPool, vestManagers } = await loadFixture(
          this.fixtures.multipleVestedDelegationsFixture
        );

        // top-up
        await vestManagers[1].topUpPosition(delegatedValidators[1], { value: this.minDelegation });

        // more rewards to be distributed but with the top-up data
        await commitEpoch(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          this.epochSize
        );

        const topUpRewardsTimestamp = await time.latest();
        const position = await rewardPool.delegationPositions(delegatedValidators[1], vestManagers[1].address);
        const toBeMatured = hre.ethers.BigNumber.from(topUpRewardsTimestamp).sub(position.start);

        // enter the maturing state
        // two week is the duration + the needed time for the top-up to be matured
        await time.increase(WEEK * 104 + toBeMatured.toNumber() + 1);

        // comit epoch, so more reward is added that must not be claimed now
        await commitEpoch(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          this.epochSize
        );

        // prepare params for call
        const end = position.end;
        const currentEpochId = await validatorSet.currentEpochId();
        const rpsValues = await rewardPool.getRPSValues(delegatedValidators[1], currentEpochId);
        const epochNum = findProperRPSIndex(rpsValues, end);
        // set invalid index
        const topUpIndex = 2;

        // ensure rewards are maturing
        const areRewardsMatured = position.end.add(toBeMatured).lt(await time.latest());
        expect(areRewardsMatured).to.be.true;

        await expect(vestManagers[1].claimPositionReward(delegatedValidators[1], epochNum, topUpIndex))
          .to.be.revertedWithCustomError(validatorSet, "DelegateRequirement")
          .withArgs("vesting", "INVALID_TOP_UP_INDEX");
      });

      it("should revert when later top-up index", async function () {
        const { systemValidatorSet, validatorSet, rewardPool, vestManagers } = await loadFixture(
          this.fixtures.multipleVestedDelegationsFixture
        );

        // top-up
        await vestManagers[1].topUpPosition(delegatedValidators[1], { value: this.minDelegation });

        // more rewards to be distributed but with the top-up data
        await commitEpoch(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          this.epochSize
        );

        const position = await rewardPool.delegationPositions(delegatedValidators[1], vestManagers[1].address);

        // add another top-up
        await vestManagers[1].topUpPosition(delegatedValidators[1], { value: this.minDelegation });

        // more rewards to be distributed but with the top-up data
        await commitEpoch(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          this.epochSize
        );

        // enter the maturing state
        // 52 weeks is the duration + the needed time for the top-up to be matured
        await time.increase(WEEK * 104 + 1);

        // commit epoch, so more reward is added that must not be claimed now
        await commitEpoch(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          this.epochSize
        );

        // prepare params for call
        const end = position.end;
        const currentEpochId = await validatorSet.currentEpochId();
        const rpsValues = await rewardPool.getRPSValues(delegatedValidators[1], currentEpochId);
        const epochNum = findProperRPSIndex(rpsValues, end);

        // set later index
        const topUpIndex = 2;

        await expect(vestManagers[1].claimPositionReward(delegatedValidators[1], epochNum - 1, topUpIndex))
          .to.be.revertedWithCustomError(validatorSet, "DelegateRequirement")
          .withArgs("vesting", "LATER_TOP_UP");
      });

      it("should revert when earlier top-up index", async function () {
        const { systemValidatorSet, validatorSet, rewardPool, vestManagers } = await loadFixture(
          this.fixtures.multipleVestedDelegationsFixture
        );

        // top-up
        await vestManagers[1].topUpPosition(delegatedValidators[1], { value: this.minDelegation });

        // more rewards to be distributed but with the top-up data
        await commitEpoch(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          this.epochSize
        );

        const position = await rewardPool.delegationPositions(delegatedValidators[1], vestManagers[1].address);

        await commitEpoch(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          this.epochSize
        );

        await vestManagers[1].topUpPosition(delegatedValidators[1], { value: this.minDelegation });

        await commitEpoch(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          this.epochSize
        );

        // enter the maturing state
        // reward to be matured
        await time.increase(WEEK * 104);

        // prepare params for call
        const end = position.end;
        const currentEpochId = await validatorSet.currentEpochId();
        const rpsValues = await rewardPool.getRPSValues(delegatedValidators[1], currentEpochId);
        const epochNum = findProperRPSIndex(rpsValues, end);

        // set earlier index
        const topUpIndex = 0;

        await expect(vestManagers[1].claimPositionReward(delegatedValidators[1], epochNum, topUpIndex))
          .to.be.revertedWithCustomError(validatorSet, "DelegateRequirement")
          .withArgs("vesting", "EARLIER_TOP_UP");
      });

      it("should claim only reward made before top-up", async function () {
        const { systemValidatorSet, validatorSet, rewardPool, vestManagers } = await loadFixture(
          this.fixtures.multipleVestedDelegationsFixture
        );

        // calculate reward
        const baseReward = await rewardPool.getRawDelegatorReward(delegatedValidators[1], vestManagers[1].address);
        const base = await rewardPool.getBase();
        const vestBonus = await rewardPool.getVestingBonus(1);
        // Not default RSI because we claim rewards made before top-up
        const rsi = await rewardPool.getRSI();
        const reward = base
          .add(vestBonus)
          .mul(rsi)
          .mul(baseReward)
          .div(10000 * 10000)
          .div(this.epochsInYear);

        const rewardDistributionTime = await time.latest();
        let position = await rewardPool.delegationPositions(delegatedValidators[1], vestManagers[1].address);
        const toBeMatured = hre.ethers.BigNumber.from(rewardDistributionTime).sub(position.start);
        time.increase(50);

        // top-up
        await vestManagers[1].topUpPosition(delegatedValidators[1], { value: this.minDelegation });

        // more rewards to be distributed but with the top-up data
        await commitEpoch(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          this.epochSize
        );
        // comit epoch, so more reward is added that must be without bonus
        await commitEpoch(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          this.epochSize
        );

        position = await rewardPool.delegationPositions(delegatedValidators[1], vestManagers[1].address);
        // enter the maturing state
        await time.increaseTo(position.end.toNumber() + toBeMatured.toNumber() + 1);

        const currentEpochId = await validatorSet.currentEpochId();
        const rpsValues = await rewardPool.getRPSValues(delegatedValidators[1], currentEpochId);
        const epochNum = findProperRPSIndex(rpsValues, position.start.add(toBeMatured));
        const topUpIndex = 0;
        // ensure rewards are maturing
        const areRewardsMaturing = position.end.add(toBeMatured).lt(await time.latest());
        expect(areRewardsMaturing).to.be.true;

        await vestManagers[1].claimPositionReward(delegatedValidators[1], epochNum, topUpIndex);

        // commit one more epoch so withdraw to be available
        await commitEpoch(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          this.epochSize
        );

        await expect(await vestManagers[1].withdraw(vestManagerOwners[1].address)).to.changeEtherBalances(
          [vestManagerOwners[1].address, validatorSet.address],
          [reward, reward.mul(-1)]
        );
      });

      it("should claim rewards multiple times", async function () {
        const { systemValidatorSet, validatorSet, rewardPool, vestManagers } = await loadFixture(
          this.fixtures.multipleVestedDelegationsFixture
        );

        // calculate reward
        const baseReward = await rewardPool.getRawDelegatorReward(delegatedValidators[1], vestManagers[1].address);
        const base = await rewardPool.getBase();
        const vestBonus = await rewardPool.getVestingBonus(1);
        // Not default RSI because we claim rewards made before top-up
        const rsi = await rewardPool.getRSI();
        const reward = base
          .add(vestBonus)
          .mul(rsi)
          .mul(baseReward)
          .div(10000 * 10000)
          .div(this.epochsInYear);

        const rewardDistributionTime = await time.latest();
        let position = await rewardPool.delegationPositions(delegatedValidators[1], vestManagers[1].address);
        const toBeMatured = hre.ethers.BigNumber.from(rewardDistributionTime).sub(position.start);
        time.increase(50);

        // top-up
        await vestManagers[1].topUpPosition(delegatedValidators[1], { value: this.minDelegation });

        // more rewards to be distributed but with the top-up data
        await commitEpoch(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          this.epochSize
        );
        // comit epoch, so more reward is added that must be without bonus
        await commitEpoch(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          this.epochSize
        );

        // prepare params for call
        position = await rewardPool.delegationPositions(delegatedValidators[1], vestManagers[1].address);
        // enter the maturing state
        await time.increaseTo(position.end.toNumber() + toBeMatured.toNumber() + 1);

        const currentEpochId = await validatorSet.currentEpochId();
        const rpsValues = await rewardPool.getRPSValues(delegatedValidators[1], currentEpochId);
        const epochNum = findProperRPSIndex(rpsValues, position.start.add(toBeMatured));
        const topUpIndex = 0;
        // ensure rewards are maturing
        const areRewardsMaturing = position.end.add(toBeMatured).lt(await time.latest());
        expect(areRewardsMaturing).to.be.true;

        await vestManagers[1].claimPositionReward(delegatedValidators[1], epochNum, topUpIndex);

        // commit one more epoch so withdraw to be available
        await commitEpoch(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          this.epochSize
        );
        await expect(await vestManagers[1].withdraw(vestManagerOwners[1].address)).to.changeEtherBalances(
          [vestManagerOwners[1].address, validatorSet.address],
          [reward, reward.mul(-1)]
        );

        time.increase(WEEK * 52);

        await commitEpoch(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          this.epochSize
        );
        expect(await vestManagers[1].claimPositionReward(delegatedValidators[1], epochNum + 1, topUpIndex + 1)).to.not
          .be.reverted;

        time.increase(WEEK * 52);
        await commitEpoch(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          this.epochSize
        );

        expect(await vestManagers[1].claimPositionReward(delegatedValidators[1], epochNum + 1, topUpIndex + 1)).to.not
          .be.reverted;
      });
    });
  });
}
