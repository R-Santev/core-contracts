// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./../modules/CVSStaking.sol";

import "../../libs/ValidatorStorage.sol";
import "../../libs/ValidatorQueue.sol";
import "../../libs/SafeMathInt.sol";

import "./StakerVesting.sol";

abstract contract ExtendedStaking is StakerVesting, CVSStaking {
    using ValidatorStorageLib for ValidatorTree;
    using ValidatorQueueLib for ValidatorQueue;
    using SafeMathUint for uint256;

    function openStakingPosition(uint256 durationWeeks) external payable {
        _requireNotInVestingCycle();

        stake();
        _openPosition(durationWeeks);
    }

    /**
     * @inheritdoc ICVSStaking
     */
    function stake() public payable override onlyValidator {
        super.stake();

        VestData memory position = stakePositions[msg.sender];
        if (isActivePosition(position)) {
            _handleTopUp(_validators.stakeOf(msg.sender));
        }
    }

    function unstake(uint256 amount) public override {
        int256 totalValidatorStake = int256(_validators.stakeOf(msg.sender)) + _queue.pendingStake(msg.sender);

        int256 amountInt = amount.toInt256Safe();
        if (amountInt > totalValidatorStake) revert StakeRequirement({src: "unstake", msg: "INSUFFICIENT_BALANCE"});

        int256 amountAfterUnstake = totalValidatorStake - amountInt;
        if (amountAfterUnstake < int256(minStake) && amountAfterUnstake != 0)
            revert StakeRequirement({src: "unstake", msg: "STAKE_TOO_LOW"});

        claimValidatorReward();

        _queue.insert(msg.sender, amountInt * -1, 0);
        if (amountAfterUnstake == 0) {
            _validators.get(msg.sender).active = false;
        }

        // modified part starts
        VestData memory position = stakePositions[msg.sender];
        if (isActivePosition(position)) {
            Validator storage validator = _validators.get(msg.sender);
            amount = _handleCut(validator, amount, uint256(amountAfterUnstake));
            amountInt = amount.toInt256Safe();
        }
        // modified part ends

        _registerWithdrawal(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    function claimValidatorReward() public override {
        if (isStakerInVestingCycle(msg.sender)) {
            return;
        }

        super.claimValidatorReward();
    }

    function claimValidatorReward(uint256 rewardHistoryIndex) public {
        VestData memory position = stakePositions[msg.sender];
        if (!isMaturingPosition(position)) {
            revert StakeRequirement({src: "vesting", msg: "NOT_MATURING"});
        }

        Validator storage validator = _validators.get(msg.sender);
        uint256 reward = _calculateRewards(rewardHistoryIndex);
        if (reward == 0) return;

        validator.takenRewards += reward;
        _registerWithdrawal(msg.sender, reward);
        emit ValidatorRewardClaimed(msg.sender, reward);
    }

    function _distributeValidatorReward(address validator, uint256 reward) internal override {
        console.log("validator", validator);
        console.log("reward", reward);
        VestData memory position = stakePositions[msg.sender];
        uint256 maxPotentialReward = applyMaxReward(reward);
        console.log("maxPotentialReward", maxPotentialReward);
        if (isActivePosition(position)) {
            reward = _applyCustomReward(position, reward, true);
        } else {
            reward = _applyCustomReward(reward);
        }

        console.log("reward custom", reward);

        uint256 remainder = maxPotentialReward - reward;
        console.log("remainder", remainder);
        if (remainder > 0) {
            // TODO: Configure burn whenever the mechanism of the reward entering the contract is available
            _burnAmount(remainder);
        }

        super._distributeValidatorReward(validator, reward);
    }

    function _requireNotInVestingCycle() internal view {
        if (isStakerInVestingCycle(msg.sender)) {
            revert StakeRequirement({src: "veting", msg: "ALREADY_IN_VESTING"});
        }
    }
}
