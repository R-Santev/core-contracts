// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./APR.sol";
import "./../../common/CommonStructs.sol";
import "./../libs/VestingPositionLib.sol";

struct VestingPosition {
    uint256 duration;
    uint256 start;
    uint256 end;
    uint256 base;
    uint256 vestBonus;
    uint256 rsiBonus;
}

// Reward Per Share
struct RPS {
    uint192 value;
    uint64 timestamp;
}

struct ValRewardHistory {
    uint256 totalReward;
    uint256 epoch;
    uint256 timestamp;
}

struct RewardParams {
    uint256 rewardPerShare;
    uint256 balance;
    int256 correction;
}

error NotVestingManager();

abstract contract Vesting is APR {
    using VestingPositionLib for VestingPosition;

    /// @notice The vesting positions for every validator
    mapping(address => VestingPosition) public positions;

    /// @notice The vesting positions for every delegator.
    /// @dev Validator => Delegator => VestingPosition
    mapping(address => mapping(address => VestingPosition)) public delegationPositions;

    /// @notice Keeps the history of the RPS for the validators
    /// @dev This is used to keep the history RPS in order to calculate properly the rewards
    mapping(address => mapping(uint256 => RPS)) public historyRPS;

    /// @notice Keeps the rewards history of the validators
    mapping(address => ValRewardHistory[]) public valRewardHistory;

    /// @notice Historical Validator Delegation Pool's Params per delegator
    /// @dev Validator => Delegator => Top-up data
    mapping(address => mapping(address => DelegationPoolParams[])) public delegationPoolParamsHistory;

    /// @dev Keep the account parameters before the top-up, so we can separately calculate the rewards made before a top-up is made
    /// @dev This is because we need to apply the RSI bonus to the rewards made before the top-up
    /// @dev and not apply the RSI bonus to the rewards made after the top-up
    mapping(address => mapping(address => RewardParams)) public beforeTopUpParams;

    // _______________ External functions _______________

    // External functions that are view
    // function getValRewardsValues(address validator) external view returns (ValReward[] memory) {
    //     return valRewards[validator];
    // }

    function getValRewardsHistoryValues(address validator) external view returns (ValRewardHistory[] memory) {
        return valRewardHistory[validator];
    }

    function getRPSValues(address validator, uint256 currentEpochId) external view returns (RPS[] memory) {
        RPS[] memory values = new RPS[](currentEpochId);
        for (uint256 i = 0; i < currentEpochId; i++) {
            if (historyRPS[validator][i].value != 0) {
                values[i] = (historyRPS[validator][i]);
            }
        }

        return values;
    }

    // _______________ Public functions _______________

    function isActivePosition(address staker) public view returns (bool) {
        VestingPosition memory position = positions[staker];
        return position.isActive();
    }

    function isActiveDelegatePosition(address validator, address delegator) public view returns (bool) {
        VestingPosition memory position = delegationPositions[validator][delegator];
        return position.isActive();
    }

    function isMaturingPosition(address staker) public view returns (bool) {
        VestingPosition memory position = positions[staker];
        return position.isMaturing();
    }

    function isMaturingDelegatePosition(address validator, address delegator) public view returns (bool) {
        VestingPosition memory position = delegationPositions[validator][delegator];
        return position.isMaturing();
    }

    function isStakerInVestingCycle(address staker) public view returns (bool) {
        return positions[staker].isStakerInVestingCycle();
    }

    // _______________ Internal functions _______________

    /**
     * Handles the logic to be executed when a validator in vesting position stakes
     */
    function _handleStake(address staker, uint256 amount, uint256 oldBalance) internal {
        uint256 duration = positions[staker].duration;
        uint256 durationIncrease = _calculateDurationIncrease(amount, oldBalance, duration);
        positions[staker].duration = duration + durationIncrease;
        positions[staker].end = positions[staker].end + durationIncrease;
        positions[staker].rsiBonus = 0;
    }

    // Internal functions that are view
    /** @param amount Amount of tokens to be slashed
     * @dev Invoke only when position is active, otherwise - underflow
     */
    function _calcSlashing(VestingPosition memory position, uint256 amount) internal view returns (uint256) {
        // Calculate what part of the balance to be slashed
        uint256 leftPeriod = position.end - block.timestamp;
        uint256 fullPeriod = position.duration;
        uint256 slash = (amount * leftPeriod) / fullPeriod;

        return slash;
    }

    // Internal functions that are pure
    function _applyCustomReward(
        VestingPosition memory position,
        uint256 reward,
        bool rsi
    ) internal pure returns (uint256) {
        uint256 bonus = (position.base + position.vestBonus);
        uint256 divider = 10000;
        if (rsi) {
            bonus = bonus * position.rsiBonus;
            divider *= 10000;
        }

        return (reward * bonus) / divider / EPOCHS_YEAR;
    }

    // _______________ Private functions _______________

    // Private functions that are view
    function _calculateDurationIncrease(
        uint256 amount,
        uint256 oldBalance,
        uint256 duration
    ) private pure returns (uint256) {
        // duration increase must not be bigger than double
        if (amount >= oldBalance) {
            return duration;
        } else {
            return (amount * duration) / oldBalance;
        }
    }

    function _saveEpochRPS(address validator, uint256 rewardPerShare, uint256 epochNumber) internal {
        require(rewardPerShare > 0, "rewardPerShare must be greater than 0");

        RPS memory validatorRPSes = historyRPS[validator][epochNumber];
        require(validatorRPSes.value == 0, "RPS already saved");

        historyRPS[validator][epochNumber] = RPS({value: uint192(rewardPerShare), timestamp: uint64(block.timestamp)});
    }
}
