// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./../../../common/Vesting/Vesting.sol";
import "./../../libs/ValidatorStorage.sol";
import "./../../../../libs/SafeMathInt.sol";

abstract contract StakerVesting is Vesting {
    using ValidatorStorageLib for ValidatorTree;
    using SafeMathUint for uint256;

    struct ValReward {
        uint256 totalReward;
        uint256 epoch;
        uint256 timestamp;
    }

    mapping(address => ValReward[]) public valRewards;

    function getValRewardsValues(address validator) external view returns (ValReward[] memory) {
        return valRewards[validator];
    }

    /**
     * Handles the logic to be executed when a validator opens a vesting position
     */
    function _setPosition(uint256 durationWeeks) internal {
        rewardPool.setPosition(msg.sender, durationWeeks);
    }

    function _updatePositionOnUnstake(
        uint256 amountUnstaked,
        uint256 amountLeft
    ) internal returns (uint256 amountToWithdraw) {
        VestData memory position = stakePositions[msg.sender];
        if (isActivePosition(position)) {
            Validator storage validator = validators[msg.sender];
            amountToWithdraw = _handleUnstake(validator, amountUnstaked, uint256(amountLeft));
        } else {
            amountToWithdraw = amountUnstaked;
        }

        return amountToWithdraw;
    }

    function _updatePositionOnUnstakeTwo(
        uint256 amountUnstaked,
        uint256 amountLeft
    ) internal returns (uint256 amountToWithdraw) {
        amountToWithdraw
        VestData memory position = stakePositions[msg.sender];
        if (isActivePosition(position)) {
            uint256 penalty = _calcSlashing(position, amountUnstaked);
            amountUnstaked -= penalty;

            // if position is closed when active, top-up must not be available as well as reward must not be available
            // so we delete the vesting data
            if (amountLeft == 0) {
                delete stakePositions[msg.sender];
            }

            uint256 reward = validator.totalRewards - validator.takenRewards;
            // burn penalty and reward
            validator.takenRewards = validator.totalRewards;
            _burnAmount(penalty + reward);

            return amountUnstaked;
        } else {
            amountToWithdraw = amountUnstaked;
        }
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
        // ValReward memory rewardData = ValReward({
        //     // totalReward: _validators.get(validator).totalRewards,
        //     epoch: epoch,
        //     timestamp: block.timestamp
        // });
        // valRewards[validator].push(rewardData);
    }
}
