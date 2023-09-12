// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./CVSStaking.sol";

abstract contract StakerVesting is Vesting {
    using ValidatorStorageLib for ValidatorTree;
    using ValidatorQueueLib for ValidatorQueue;
    using SafeMathUint for uint256;

    struct ValReward {
        uint256 totalReward;
        uint256 epoch;
        uint256 timestamp;
    }

    mapping(address => VestData) public stakePositions;
    mapping(address => ValReward[]) public valRewards;

    function getValRewardsValues(address validator) external view returns (ValReward[] memory) {
        return valRewards[validator];
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

    /**
     * @dev Ensure the function is executed for maturing positions only
     */
    function _calcValidatorReward(
        Validator memory validator,
        uint256 rewardHistoryIndex
    ) internal view returns (uint256) {
        VestData memory position = stakePositions[msg.sender];
        uint256 maturedPeriod = block.timestamp - position.end;
        uint256 alreadyMatured = position.start + maturedPeriod;
        ValReward memory rewardData = valRewards[msg.sender][rewardHistoryIndex];
        // If the given data is for still not matured period - it is wrong, so revert
        if (rewardData.timestamp > alreadyMatured) {
            revert StakeRequirement({src: "stakerVesting", msg: "WRONG_DATA"});
        }

        if (rewardData.totalReward > validator.takenRewards) {
            return rewardData.totalReward - validator.takenRewards;
        }

        return 0;
    }

    /**
     * Handles the logic to be executed when a validator opens a vesting position
     */
    function _handleOpenPosition(uint256 durationWeeks) internal {
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

    /**
     * Handles the logic to be executed when a validator in vesting position stakes
     */
    function _handleStake(uint256 oldBalance) internal {
        uint256 duration = stakePositions[msg.sender].duration;
        uint256 durationIncrease = _calculateDurationIncrease(oldBalance, duration);
        stakePositions[msg.sender].duration = duration + durationIncrease;
        stakePositions[msg.sender].end = stakePositions[msg.sender].end + durationIncrease;
        stakePositions[msg.sender].rsiBonus = 0;
    }

    /**
     * Handles the logic to be executed when a validator in vesting position unstakes
     * @return the actual amount that would be unstaked, the other part is burned
     */
    function _handleUnstake(
        Validator storage validator,
        uint256 amountUnstaked,
        uint256 amountLeft
    ) internal returns (uint256) {
        VestData memory position = stakePositions[msg.sender];
        uint256 penalty = _calcSlashing(position, amountUnstaked);
        amountUnstaked -= penalty;

        uint256 reward = validator.totalRewards - validator.takenRewards;
        // burn penalty and reward
        validator.takenRewards = validator.totalRewards;
        _burnAmount(penalty + reward);

        // if position is closed when active, top-up must not be available as well as reward must not be available
        // so we delete the vesting data
        if (amountLeft == 0) {
            delete stakePositions[msg.sender];
        }

        return amountUnstaked;
    }

    function _saveValRewardData(address validator, uint256 epoch) internal {
        ValReward memory rewardData = ValReward({
            totalReward: _validators.get(validator).totalRewards,
            epoch: epoch,
            timestamp: block.timestamp
        });

        valRewards[validator].push(rewardData);
    }

    function _calculateDurationIncrease(uint256 oldBalance, uint256 duration) private returns (uint256) {
        // duration increase must not be bigger than double
        if (msg.value >= oldBalance) {
            return duration;
        } else {
            return (msg.value * duration) / oldBalance;
        }
    }
}
