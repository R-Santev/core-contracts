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

        // modified part starts
        VestData memory position = stakePositions[msg.sender];
        if (isActivePosition(position)) {
            Validator storage validator = _validators.get(msg.sender);
            amount = _handleCut(validator, amount, uint256(amountAfterUnstake));
            amountInt = amount.toInt256Safe();
        }
        // modified part ends

        claimValidatorReward();

        _queue.insert(msg.sender, amountInt * -1, 0);
        if (amountAfterUnstake == 0) {
            _validators.get(msg.sender).active = false;
        }

        _registerWithdrawal(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    function claimValidatorReward() public override {
        if (isStakerInVestingCycle(msg.sender)) {
            return;
        }

        super.claimValidatorReward();
    }

    function claimValidatorReward(uint256 epochNum) public {
        if (!isMaturingPosition(msg.sender)) {
            revert StakeRequirement({src: "vesting", msg: "NOT_MATURING"});
        }

        // If still unused position, there is no reward
        // if (vesting.start == 0) {
        //     return;
        // }

        Validator storage validator = _validators.get(msg.sender);
        uint256 reward = _calculateRewards(epochNum);
        if (reward == 0) return;

        validator.takenRewards += reward;
        _registerWithdrawal(msg.sender, reward);
        emit ValidatorRewardClaimed(msg.sender, reward);
    }

    function _requireNotInVestingCycle() internal view {
        if (isStakerInVestingCycle(msg.sender)) {
            revert StakeRequirement({src: "veting", msg: "ALREADY_IN_VESTING"});
        }
    }
}
