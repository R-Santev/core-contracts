/* eslint-disable node/no-extraneous-import */
import { loadFixture, impersonateAccount, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import * as hre from "hardhat";

// eslint-disable-next-line camelcase
import { VestManager__factory } from "../../../typechain-types";
import { WEEK } from "../constants";
import { calculatePenalty, claimPositionRewards, commitEpoch, commitEpochs, getUserManager } from "../helper";
import { RunDelegateClaimTests, RunVestedDelegateClaimTests } from "../RewardPool/RewardPool.test";

export function RunDelegationTests(): void {
  describe("Delegate", function () {
    it("should revert when delegating zero amount", async function () {
      const { validatorSet } = await loadFixture(this.fixtures.withdrawableFixture);

      await expect(validatorSet.delegate(this.signers.validators[0].address, { value: 0 }))
        .to.be.revertedWithCustomError(validatorSet, "DelegateRequirement")
        .withArgs("delegate", "DELEGATING_AMOUNT_ZERO");
    });

    it("should not be able to delegate to missing or inactive validator", async function () {
      const { validatorSet } = await loadFixture(this.fixtures.withdrawableFixture);

      await expect(validatorSet.delegate(this.signers.validators[3].address, { value: this.minDelegation }))
        .to.be.revertedWithCustomError(validatorSet, "Unauthorized")
        .withArgs("INVALID_VALIDATOR");
    });

    it("should not be able to delegate less than minDelegation", async function () {
      const { validatorSet } = await loadFixture(this.fixtures.withdrawableFixture);

      await expect(
        validatorSet.delegate(this.signers.validators[0].address, {
          value: this.minDelegation.div(2),
        })
      )
        .to.be.revertedWithCustomError(validatorSet, "DelegateRequirement")
        .withArgs("delegate", "DELEGATION_TOO_LOW");
    });

    it("should delegate for the first time", async function () {
      const { validatorSet, rewardPool } = await loadFixture(this.fixtures.withdrawableFixture);
      const delegateAmount = this.minDelegation.mul(2);

      const tx = await validatorSet.connect(this.signers.delegator).delegate(this.signers.validators[0].address, {
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

      const tx = await validatorSet.connect(this.signers.delegator).delegate(this.signers.validators[0].address, {
        value: delegateAmount,
      });

      await expect(tx, "DelegatorRewardClaimed")
        .to.emit(rewardPool, "DelegatorRewardClaimed")
        .withArgs(this.signers.validators[0].address, this.signers.delegator.address, delegatorReward);

      await expect(tx, "WithdrawalFinished")
        .to.emit(rewardPool, "WithdrawalFinished")
        .withArgs(rewardPool.address, this.signers.delegator.address, delegatorReward);

      await expect(tx, "Delegated")
        .to.emit(validatorSet, "Delegated")
        .withArgs(this.signers.validators[0].address, this.signers.delegator.address, delegateAmount);
    });
  });

  describe("Reward Pool - Delegate claim", function () {
    RunDelegateClaimTests();
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
        .withArgs(this.signers.delegator.address, undelegateAmount);

      await expect(tx, "WithdrawalFinished")
        .to.emit(rewardPool, "WithdrawalFinished")
        .withArgs(rewardPool.address, this.signers.delegator.address, expectedReward);

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
        .withArgs(this.signers.delegator.address, delegatedAmount);

      await expect(tx, "WithdrawalFinished")
        .to.emit(rewardPool, "WithdrawalFinished")
        .withArgs(rewardPool.address, this.signers.delegator.address, expectedReward);

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
    before(async function () {
      // validator[2] delegates minDelegation and validator[1] delegates minDelegation.mul(2)
      // put them into the context in order to use it in the reward pool tests
      this.delegatedValidators = [this.signers.validators[2].address, this.signers.validators[1].address];
      this.vestManagerOwners = [this.signers.accounts[4], this.signers.accounts[5]];
    });

    it("should have created a base implementation", async function () {
      const { validatorSet } = await loadFixture(this.fixtures.vestManagerFixture);

      const baseImplementation = await validatorSet.implementation();
      expect(baseImplementation).to.not.equal(hre.ethers.constants.AddressZero);
    });

    describe("newManager()", async function () {
      it("should revert when zero address", async function () {
        const { validatorSet, rewardPool } = await loadFixture(this.fixtures.vestManagerFixture);

        const zeroAddress = hre.ethers.constants.AddressZero;
        await impersonateAccount(zeroAddress);
        const zeroAddrSigner = await hre.ethers.getSigner(zeroAddress);
        await expect(validatorSet.connect(zeroAddrSigner).newManager(rewardPool.address)).to.be.revertedWith(
          "INVALID_OWNER"
        );
      });

      it("should successfully create new manager", async function () {
        const { validatorSet, rewardPool } = await loadFixture(this.fixtures.vestManagerFixture);

        const tx = await validatorSet.connect(this.signers.accounts[5]).newManager(rewardPool.address);
        const receipt = await tx.wait();
        const event = receipt.events?.find((e: any) => e.event === "NewClone");
        const address = event?.args?.newClone;

        expect(address).to.not.equal(hre.ethers.constants.AddressZero);
      });

      it("should have initialized the manager", async function () {
        const { validatorSet, vestManager } = await loadFixture(this.fixtures.vestManagerFixture);

        expect(await vestManager.owner(), "owner").to.equal(this.vestManagerOwners[0].address);
        expect(await vestManager.delegation(), "delegation").to.equal(validatorSet.address);
      });

      it("should set manager in mappings", async function () {
        const { validatorSet, vestManager } = await loadFixture(this.fixtures.vestManagerFixture);

        expect(await validatorSet.vestManagers(vestManager.address), "vestManagers").to.equal(
          this.vestManagerOwners[0].address
        );
        expect(await validatorSet.userVestManagers(this.vestManagerOwners[0].address, 0), "userVestManagers").to.equal(
          vestManager.address
        );
        expect(
          (await validatorSet.getUserVestManagers(this.vestManagerOwners[0].address)).length,
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
          vestManager
            .connect(this.vestManagerOwners[0])
            .openVestedDelegatePosition(this.signers.accounts[10].address, 1, {
              value: this.minDelegation,
            })
        )
          .to.be.revertedWithCustomError(validatorSet, "Unauthorized")
          .withArgs("INVALID_VALIDATOR");
      });

      it("should revert when delegation too low", async function () {
        const { validatorSet, vestManager } = await loadFixture(this.fixtures.vestManagerFixture);

        await expect(
          vestManager
            .connect(this.vestManagerOwners[0])
            .openVestedDelegatePosition(this.signers.validators[2].address, 1, {
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
          await vestManager.openVestedDelegatePosition(this.delegatedValidators[0], vestingDuration, {
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
          vestManager.openVestedDelegatePosition(this.delegatedValidators[0], vestingDuration, {
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
          vestManager.openVestedDelegatePosition(this.delegatedValidators[0], vestingDuration, {
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
          vestManager.openVestedDelegatePosition(this.delegatedValidators[0], vestingDuration, {
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

        await claimPositionRewards(validatorSet, rewardPool, vestManager, this.delegatedValidators[0]);

        currentReward = await rewardPool.getDelegatorReward(this.signers.validators[2].address, vestManager.address);
        expect(currentReward, "currentReward").to.be.equal(0);

        const delegatedAmount = await rewardPool.delegationOf(this.delegatedValidators[0], vestManager.address);
        const amountToDelegate = this.minDelegation.mul(2);
        const tx = await vestManager.openVestedDelegatePosition(this.delegatedValidators[0], vestingDuration, {
          value: amountToDelegate,
        });

        await expect(tx)
          .to.emit(validatorSet, "PositionOpened")
          .withArgs(vestManager.address, this.delegatedValidators[0], vestingDuration, amountToDelegate);

        expect(await rewardPool.delegationOf(this.delegatedValidators[0], vestManager.address)).to.be.equal(
          delegatedAmount.add(amountToDelegate)
        );
      });
    });

    describe("cutVestedDelegatePosition()", async function () {
      it("should revert when insufficient balance", async function () {
        const { validatorSet, rewardPool, vestManager, liquidToken } = await loadFixture(
          this.fixtures.vestedDelegationFixture
        );

        const balance = await rewardPool.delegationOf(this.delegatedValidators[0], vestManager.address);

        // send one more token so liquid tokens balance is enough
        const user2 = this.signers.accounts[7];
        await validatorSet.connect(user2).newManager(rewardPool.address);
        const VestManagerFactory = new VestManager__factory(this.vestManagerOwners[0]);
        const manager2 = await getUserManager(validatorSet, user2, VestManagerFactory);

        await manager2.openVestedDelegatePosition(this.delegatedValidators[0], 1, {
          value: this.minDelegation.mul(2),
        });

        await liquidToken.connect(user2).transfer(this.vestManagerOwners[0].address, 1);
        const balanceToCut = balance.add(1);
        await liquidToken.connect(this.vestManagerOwners[0]).approve(vestManager.address, balanceToCut);
        await expect(vestManager.cutVestedDelegatePosition(this.delegatedValidators[0], balanceToCut))
          .to.be.revertedWithCustomError(validatorSet, "DelegateRequirement")
          .withArgs("vesting", "INSUFFICIENT_BALANCE");
      });

      it("should revert when delegation too low", async function () {
        const { validatorSet, rewardPool, vestManager, liquidToken } = await loadFixture(
          this.fixtures.vestedDelegationFixture
        );

        const balance = await rewardPool.delegationOf(this.delegatedValidators[0], vestManager.address);
        const balanceToCut = balance.sub(1);
        await liquidToken.connect(this.vestManagerOwners[0]).approve(vestManager.address, balanceToCut);
        await expect(vestManager.cutVestedDelegatePosition(this.delegatedValidators[0], balanceToCut))
          .to.be.revertedWithCustomError(validatorSet, "DelegateRequirement")
          .withArgs("vesting", "DELEGATION_TOO_LOW");
      });

      it("should slash the amount when in active position", async function () {
        const { systemValidatorSet, rewardPool, vestManagers, liquidToken } = await loadFixture(
          this.fixtures.multipleVestedDelegationsFixture
        );

        // ensure position is active
        const isActive = await rewardPool.isActiveDelegatePosition(
          this.delegatedValidators[1],
          vestManagers[1].address
        );
        expect(isActive, "isActive").to.be.true;

        // check is amount properly removed from delegation
        const delegatedBalanceBefore = await rewardPool.delegationOf(
          this.delegatedValidators[1],
          vestManagers[1].address
        );
        const cutAmount = delegatedBalanceBefore.div(2);
        const position = await rewardPool.delegationPositions(this.delegatedValidators[1], vestManagers[1].address);

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
        // await expect(manager.cutVestedDelegatePosition(validator, cutAmount)).to.changeEtherBalance(
        //   childValidatorSet,
        //   decrease.mul(-1)
        // );

        await liquidToken.connect(this.vestManagerOwners[1]).approve(vestManagers[1].address, cutAmount);

        const penalty = await calculatePenalty(position, cutAmount);
        await vestManagers[1].cutVestedDelegatePosition(this.delegatedValidators[1], cutAmount);

        const delegatedBalanceAfter = await rewardPool.delegationOf(
          this.delegatedValidators[1],
          vestManagers[1].address
        );
        expect(delegatedBalanceAfter, "delegatedBalanceAfter").to.be.eq(delegatedBalanceBefore.sub(cutAmount));

        // claimableRewards must be 0
        const claimableRewards = await rewardPool.getDelegatorReward(
          this.delegatedValidators[1],
          vestManagers[1].address
        );
        expect(claimableRewards, "claimableRewards").to.be.eq(0);

        // check if amount is properly slashed
        const balanceBefore = await this.vestManagerOwners[1].getBalance();

        // commit Epoch so reward is available for withdrawal
        await commitEpoch(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          this.epochSize
        );
        await vestManagers[1].withdraw(this.vestManagerOwners[1].address);

        const balanceAfter = await this.vestManagerOwners[1].getBalance();

        // cut half of the requested amount because half of the vesting period is still not passed
        expect(balanceAfter.sub(balanceBefore)).to.be.eq(cutAmount.sub(penalty));
        expect(balanceAfter).to.be.eq(balanceBefore.add(cutAmount.sub(penalty)));
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

        const reward = await rewardPool.getDelegatorReward(this.delegatedValidators[0], vestManagers[0].address);
        expect(reward, "reward").to.not.be.eq(0);

        // Finish the vesting period
        await time.increase(WEEK * 60);

        const balanceBefore = await this.vestManagerOwners[0].getBalance();
        const delegatedBalance = await rewardPool.delegationOf(this.delegatedValidators[0], vestManagers[0].address);
        expect(delegatedBalance, "delegatedBalance").to.not.be.eq(0);

        await liquidToken.connect(this.vestManagerOwners[0]).approve(vestManagers[0].address, delegatedBalance);
        await vestManagers[0].cutVestedDelegatePosition(this.delegatedValidators[0], delegatedBalance);

        // commit one more epoch so withdraw to be available
        await commitEpochs(
          systemValidatorSet,
          rewardPool,
          [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
          3,
          this.epochSize
        );
        await vestManagers[0].withdraw(this.vestManagerOwners[0].address);

        const balanceAfter = await this.vestManagerOwners[0].getBalance();

        expect(balanceAfter, "balanceAfter").to.be.eq(balanceBefore.add(delegatedBalance));

        // check is amount properly removed from delegation
        expect(await rewardPool.delegationOf(this.delegatedValidators[0], vestManagers[0].address)).to.be.eq(0);

        // ensure reward is still available for withdrawal
        const rewardAfter = await rewardPool.getDelegatorReward(this.delegatedValidators[0], vestManagers[0].address);
        expect(rewardAfter).to.be.eq(reward);
      });

      it("should delete position when closing it", async function () {
        const { rewardPool, vestManagers, liquidToken } = await loadFixture(
          this.fixtures.multipleVestedDelegationsFixture
        );

        // cut position
        const delegatedAmount = await rewardPool.delegationOf(this.delegatedValidators[0], vestManagers[0].address);
        await liquidToken.connect(this.vestManagerOwners[0]).approve(vestManagers[0].address, delegatedAmount);
        await vestManagers[0].cutVestedDelegatePosition(this.delegatedValidators[0], delegatedAmount);
        expect(
          (await rewardPool.delegationPositions(this.delegatedValidators[0], vestManagers[0].address)).start
        ).to.be.eq(0);
      });
    });

    describe("topUpVestedDelegatePosition()", async function () {
      it("should revert when not owner of the vest manager", async function () {
        const { vestManagers } = await loadFixture(this.fixtures.multipleVestedDelegationsFixture);

        await expect(
          vestManagers[0]
            .connect(this.signers.accounts[10])
            .topUpVestedDelegatePosition(this.signers.accounts[10].address, { value: this.minDelegation })
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
          vestManagers[0].topUpVestedDelegatePosition(this.signers.validators[0].address, {
            value: this.minDelegation.sub(1),
          })
        )
          .to.be.revertedWithCustomError(validatorSet, "DelegateRequirement")
          .withArgs("vesting", "DELEGATION_TOO_LOW");
      });

      it("should revert when position is not active", async function () {
        const { validatorSet, vestManagers } = await loadFixture(this.fixtures.multipleVestedDelegationsFixture);

        // enter the reward maturity phase
        await time.increase(WEEK * 55);
        await expect(
          vestManagers[0].topUpVestedDelegatePosition(this.delegatedValidators[0], { value: this.minDelegation })
        )
          .to.be.revertedWithCustomError(validatorSet, "DelegateRequirement")
          .withArgs("vesting", "POSITION_NOT_ACTIVE");
      });

      it("should properly top-up position", async function () {
        const { validatorSet, rewardPool, vestManagers } = await loadFixture(
          this.fixtures.multipleVestedDelegationsFixture
        );

        const delegatedBalanceBefore = await rewardPool.delegationOf(
          this.delegatedValidators[0],
          vestManagers[0].address
        );
        const totalAmount = delegatedBalanceBefore.add(this.minDelegation);
        const positionEndBefore = (
          await rewardPool.delegationPositions(this.delegatedValidators[0], vestManagers[0].address)
        ).end;

        await vestManagers[0].topUpVestedDelegatePosition(this.delegatedValidators[0], { value: this.minDelegation });

        // delegation is increased
        const delegatedBalanceAfter = await rewardPool.delegationOf(
          this.delegatedValidators[0],
          vestManagers[0].address
        );
        expect(delegatedBalanceAfter, "delegatedBalanceAfter").to.be.eq(totalAmount);

        // balance change data is added
        const balanceChange = await rewardPool.delegationPoolParamsHistory(
          this.delegatedValidators[0],
          vestManagers[0].address,
          1
        );
        expect(balanceChange.balance, "balance change").to.be.eq(totalAmount);
        expect(balanceChange.epochNum, "epochNum").to.be.eq(await validatorSet.currentEpochId());

        // duration increase is proper
        const position = await rewardPool.delegationPositions(this.delegatedValidators[0], vestManagers[0].address);
        expect(position.end).to.be.eq(positionEndBefore.add(WEEK * 52));
      });

      it("should revert when too many top-ups are made", async function () {
        const { systemValidatorSet, validatorSet, rewardPool, vestManagers } = await loadFixture(
          this.fixtures.multipleVestedDelegationsFixture
        );

        const maxTopUps = 52; // one cannot top-up more than 52 times
        for (let i = 0; i < maxTopUps; i++) {
          const delegatingAmount = this.minDelegation.mul(i + 1).div(5);
          await vestManagers[0].topUpVestedDelegatePosition(this.delegatedValidators[0], { value: delegatingAmount });

          // commit epoch cause only 1 top-up can be made per epoch
          await commitEpoch(
            systemValidatorSet,
            rewardPool,
            [this.signers.validators[0], this.signers.validators[1], this.signers.validators[2]],
            this.epochSize
          );
        }

        await expect(
          vestManagers[0].topUpVestedDelegatePosition(this.delegatedValidators[0], { value: this.minDelegation })
        )
          .to.be.revertedWithCustomError(validatorSet, "DelegateRequirement")
          .withArgs("vesting", "TOO_MANY_TOP_UPS");
      });

      it("should revert when top-up already made in the same epoch", async function () {
        const { validatorSet, vestManagers } = await loadFixture(this.fixtures.multipleVestedDelegationsFixture);

        await vestManagers[0].topUpVestedDelegatePosition(this.delegatedValidators[0], { value: this.minDelegation });

        await expect(
          vestManagers[0].topUpVestedDelegatePosition(this.delegatedValidators[0], { value: this.minDelegation })
        )
          .to.be.revertedWithCustomError(validatorSet, "DelegateRequirement")
          .withArgs("vesting", "TOPUP_ALREADY_MADE");
      });

      it("should increase duration no more than 100%", async function () {
        const { rewardPool, vestManagers } = await loadFixture(this.fixtures.multipleVestedDelegationsFixture);

        const positionBeforeTopUp = await rewardPool.delegationPositions(
          this.delegatedValidators[0],
          vestManagers[0].address
        );

        const topUpAmount = (await rewardPool.delegationOf(this.delegatedValidators[0], vestManagers[0].address)).mul(
          2
        );
        await vestManagers[0].topUpVestedDelegatePosition(this.delegatedValidators[0], {
          value: topUpAmount.add(this.minDelegation),
        });

        const vestingEndAfter = (
          await rewardPool.delegationPositions(this.delegatedValidators[0], vestManagers[0].address)
        ).end;
        expect(vestingEndAfter, "vestingEndAfter").to.be.eq(positionBeforeTopUp.end.add(positionBeforeTopUp.duration));
      });

      it("should revert when top-up closed position", async function () {
        const { validatorSet, rewardPool, vestManagers, liquidToken } = await loadFixture(
          this.fixtures.multipleVestedDelegationsFixture
        );

        // close position
        const delegatedAmount = await rewardPool.delegationOf(this.delegatedValidators[0], vestManagers[0].address);
        await liquidToken.connect(this.vestManagerOwners[0]).approve(vestManagers[0].address, delegatedAmount);
        await vestManagers[0].cutVestedDelegatePosition(this.delegatedValidators[0], delegatedAmount);

        // top-up
        await expect(
          vestManagers[0].topUpVestedDelegatePosition(this.delegatedValidators[0], { value: this.minDelegation })
        )
          .to.be.revertedWithCustomError(validatorSet, "DelegateRequirement")
          .withArgs("vesting", "POSITION_NOT_ACTIVE");
      });
    });

    describe("Reward Pool - Vested delegate claim", async function () {
      RunVestedDelegateClaimTests();
    });
  });
}
