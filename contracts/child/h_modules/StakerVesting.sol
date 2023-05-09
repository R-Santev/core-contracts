// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "hardhat/console.sol";
import "./APR.sol";

import "./../modules/CVSStorage.sol";
import "./../modules/CVSStaking.sol";

abstract contract StakerVesting is Vesting, CVSStorage {
    using ValidatorStorageLib for ValidatorTree;
    using ValidatorQueueLib for ValidatorQueue;
    using SafeMathUint for uint256;

    struct ValReward {
        uint256 totalReward;
        uint256 epoch;
        uint256 timestamp;
    }

    mapping(address => VestData) public stakePositions;
    mapping(address => uint256) public takenRewards;
    mapping(address => ValReward[]) public valRewards;

    function _calculateRewards(uint256 epoch) internal view returns (uint256) {
        VestData memory position = stakePositions[msg.sender];
        uint256 matureEnd = position.end + position.duration;
        uint256 alreadyMatured;
        // If full mature period is finished, the full reward up to the end of the vesting must be matured
        if (matureEnd < block.timestamp) {
            alreadyMatured = position.end;
        } else {
            // rewardPerShare must be fetched from the history records
            uint256 maturedPeriod = block.timestamp - position.end;
            alreadyMatured = position.start + maturedPeriod;
        }

        ValReward memory rewardData = valRewards[msg.sender][epoch];
        if (rewardData.timestamp == 0) {
            revert StakeRequirement({src: "vesting", msg: "INVALID_EPOCH"});
        }
        // If the given RPS is for future time - it is wrong, so revert
        if (rewardData.timestamp > alreadyMatured) {
            revert StakeRequirement({src: "vesting", msg: "WRONG_RPS"});
        }

        if (rewardData.totalReward > takenRewards[msg.sender]) {
            return rewardData.totalReward - takenRewards[msg.sender];
        }

        return 0;
    }

    function _openPosition(uint256 durationWeeks) internal {
        uint256 duration = durationWeeks * 1 weeks;

        stakePositions[msg.sender] = VestData({
            duration: duration,
            start: block.timestamp,
            end: block.timestamp + duration,
            base: getBase(),
            vestBonus: getVestingBonus(durationWeeks),
            rsiBonus: uint248(getRSI())
        });

        delete valRewards[msg.sender];
    }

    function _handleCut(
        Validator storage validator,
        uint256 amount,
        uint256 delegatedAmount
    ) internal returns (uint256) {
        VestData memory position = stakePositions[msg.sender];
        uint256 penalty = _calcSlashing(position, amount);
        amount -= penalty;

        uint256 reward = validator.totalRewards - validator.takenRewards;
        validator.takenRewards = validator.totalRewards;

        // burn penalty and reward
        console.log("penalty", penalty);
        console.log("reward", reward);
        _burnAmount(penalty + reward);

        // if position is closed when active, top-up must not be available as well as reward must not be available
        // so we delete the vesting data
        if (delegatedAmount == 0) {
            delete stakePositions[msg.sender];
        }

        return amount;
    }

    function _handleTopUp(uint256 balance) internal {
        uint256 duration = stakePositions[msg.sender].duration;
        uint256 durationIncrease = _calculateDurationIncrease(balance, duration);
        stakePositions[msg.sender].duration = duration + durationIncrease;
        stakePositions[msg.sender].end = stakePositions[msg.sender].end + durationIncrease;
        stakePositions[msg.sender].rsiBonus = 0;
    }

    function _calculateDurationIncrease(uint256 balance, uint256 duration) private returns (uint256) {
        uint256 oldBalance = balance - msg.value;
        // duration increase must not be bigger than double
        if (msg.value >= oldBalance) {
            return duration;
        } else {
            return (msg.value * duration) / oldBalance;
        }
    }

    function _saveValRewardData(address validator, uint256 epoch) internal {
        ValReward memory rewardData = ValReward({
            totalReward: _validators.get(validator).totalRewards,
            epoch: epoch,
            timestamp: block.timestamp
        });

        valRewards[validator].push(rewardData);
    }

    /**
     * Returns true if the staker is an active vesting position or not all rewards from the latest
     *  active position are matured yet
     * @param staker Address of the staker
     */
    function isStakerInVestingCycle(address staker) public view returns (bool) {
        uint256 matureEnd = stakePositions[staker].end + stakePositions[staker].duration;
        return stakePositions[staker].start < block.timestamp && block.timestamp < matureEnd;
    }

    // function topUpPosition() external {
    //     if (!isActivePosition(msg.sender, msg.sender)) {
    //         revert StakeRequirement({src: "vesting", msg: "POSITION_NOT_ACTIVE"});
    //     }

    //     stake();
    //     _topUpPosition(msg.sender, _validators.stakeOf(msg.sender));
    // }

    // function unstake(uint256 amount) public override {
    //     int256 totalValidatorStake = int256(_validators.stakeOf(msg.sender)) + _queue.pendingStake(msg.sender);
    //     int256 amountInt = amount.toInt256Safe();
    //     if (amountInt > totalValidatorStake) revert StakeRequirement({src: "unstake", msg: "INSUFFICIENT_BALANCE"});

    //     int256 amountAfterUnstake = totalValidatorStake - amountInt;
    //     if (amountAfterUnstake < int256(minStake) && amountAfterUnstake != 0)
    //         revert StakeRequirement({src: "unstake", msg: "STAKE_TOO_LOW"});

    //     // modified part starts
    //     if (isActivePosition(msg.sender, msg.sender)) {
    //         Validator storage validator = _validators.get(msg.sender);
    //         amount = _cutPosition(msg.sender, validator, amount, uint256(amountAfterUnstake));
    //         amountInt = amount.toInt256Safe();
    //     }

    //     if (!isInVesting(msg.sender, msg.sender)) {
    //         claimValidatorReward();
    //     }
    //     // modified part ends

    //     _queue.insert(msg.sender, amountInt * -1, 0);
    //     if (amountAfterUnstake == 0) {
    //         _validators.get(msg.sender).active = false;
    //     }

    //     _registerWithdrawal(msg.sender, amount);
    //     emit Unstaked(msg.sender, amount);
    // }

    // function claimDelegatorReward(uint256 epochNum) public {
    //     if (!isMaturingPosition(msg.sender)) {
    //         revert StakeRequirement({src: "vesting", msg: "NOT_MATURING"});
    //     }

    //     // If still unused position, there is no reward
    //     // if (vesting.start == 0) {
    //     //     return;
    //     // }

    //     Validator storage validator = _validators.get(msg.sender);
    //     uint256 reward = _calculateRewards(epochNum);
    //     if (reward == 0) return;

    //     validator.takenRewards += reward;
    //     _registerWithdrawal(msg.sender, reward);
    //     emit ValidatorRewardClaimed(msg.sender, reward);
    // }
}
