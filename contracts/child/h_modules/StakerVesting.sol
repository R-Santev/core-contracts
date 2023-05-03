// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "./APR.sol";
import "./Vesting.sol";

import "./../modules/CVSStorage.sol";
import "./../modules/CVSStaking.sol";

abstract contract StakerVesting is CVSStorage, APR, Vesting, CVSStaking {
    using ValidatorStorageLib for ValidatorTree;
    using ValidatorQueueLib for ValidatorQueue;
    using SafeMathUint for uint256;

    struct ValReward {
        uint256 totalReward;
        uint256 epoch;
        uint256 timestamp;
    }

    mapping(address => uint256) public takenRewards;
    mapping(address => ValReward[]) public valRewards;

    function openPosition(uint256 durationWeeks) external payable {
        stake();
        _openPosition(durationWeeks);
    }

    function topUpPosition() external {
        stake();
        _topUpPosition(msg.sender, _validators.stakeOf(msg.sender));
    }

    function cutPosition(uint256 amount) external {
        int256 totalValidatorStake = int256(_validators.stakeOf(msg.sender)) + _queue.pendingStake(msg.sender);
        int256 amountInt = amount.toInt256Safe();
        if (amountInt > totalValidatorStake) revert StakeRequirement({src: "unstake", msg: "INSUFFICIENT_BALANCE"});

        int256 amountAfterUnstake = totalValidatorStake - amountInt;
        if (amountAfterUnstake < int256(minStake) && amountAfterUnstake != 0)
            revert StakeRequirement({src: "unstake", msg: "STAKE_TOO_LOW"});

        Validator storage validator = _validators.get(msg.sender);
        amount = _cutPosition(msg.sender, validator, amount, uint256(amountAfterUnstake));
        amountInt = amount.toInt256Safe();

        _queue.insert(msg.sender, amountInt * -1, 0);
        if (amountAfterUnstake == 0) {
            validator.active = false;
        }

        _registerWithdrawal(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    function claimPositionReward(uint256 epochNum) external {
        VestData memory vesting = vestings[msg.sender][msg.sender];
        // If still unused position, there is no reward
        if (vesting.start == 0) {
            return;
        }

        // if the position is still active, there is no matured reward
        if (isActivePosition(msg.sender, msg.sender)) {
            return;
        }

        Validator storage validator = _validators.get(msg.sender);
        uint256 reward = _calculateRewards(epochNum);
        if (reward == 0) return;
        validator.takenRewards += reward;
        _registerWithdrawal(msg.sender, reward);
        emit ValidatorRewardClaimed(msg.sender, reward);
    }

    function _calculateRewards(uint256 epoch) internal returns (uint256) {
        VestData memory position = vestings[msg.sender][msg.sender];
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

        return rewardData.totalReward - takenRewards[msg.sender];
    }

    function _openPosition(uint256 durationWeeks) internal {
        if (isMaturingPosition(msg.sender)) {
            revert StakeRequirement({src: "vesting", msg: "POSITION_MATURING"});
        }

        if (isActivePosition(msg.sender, msg.sender)) {
            revert StakeRequirement({src: "vesting", msg: "POSITION_ACTIVE"});
        }

        uint256 duration = durationWeeks * 1 weeks;

        vestings[msg.sender][msg.sender] = VestData({
            duration: duration,
            start: block.timestamp,
            end: block.timestamp + duration,
            base: getBase(),
            vestBonus: getVestingBonus(durationWeeks),
            rsiBonus: uint248(getRSI())
        });

        delete valRewards[msg.sender];
    }

    function _cutPosition(
        address valAddress,
        Validator storage validator,
        uint256 amount,
        uint256 delegatedAmount
    ) internal returns (uint256) {
        if (isActivePosition(valAddress, msg.sender)) {
            uint256 penalty = _calcSlashing(valAddress, amount);
            // apply the max Vesting bonus, because the full reward must be burned
            validator.takenRewards = validator.totalRewards;

            amount -= penalty;

            // if position is closed when active, top-up must not be available as well as reward must not be available
            // so we delete the vesting data
            if (delegatedAmount == 0) {
                delete vestings[valAddress][msg.sender];
            }
        }

        return amount;
    }

    function _topUpPosition(address valAddress, uint256 balance) internal {
        if (!isActivePosition(valAddress, msg.sender)) {
            revert StakeRequirement({src: "vesting", msg: "POSITION_NOT_ACTIVE"});
        }

        // Modify end period of position, decrease RSI bonus
        // balance / old balance = increase coefficient
        // apply increase coefficient to the vesting period to find the increase in the period
        // TODO: Optimize gas costs
        uint256 timeIncrease;

        uint256 oldBalance = balance - msg.value;
        uint256 duration = vestings[valAddress][msg.sender].duration;
        if (msg.value >= oldBalance) {
            timeIncrease = duration;
        } else {
            timeIncrease = (msg.value * duration) / oldBalance;
        }

        vestings[valAddress][msg.sender].duration = duration + timeIncrease;
        vestings[valAddress][msg.sender].end = vestings[valAddress][msg.sender].end + timeIncrease;
    }

    function _saveValRewardData(address validator) internal {}
}
