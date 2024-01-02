// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

// import "./../../ValidatorSet/IValidatorSet.sol";
import "./../IRewardPool.sol";
import "./APR.sol";
import "./../libs/VestingPositionLib.sol";
import "./../../common/CommonStructs.sol";

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

struct ValReward {
    uint256 taken;
    uint256 total;
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

abstract contract VestingData is IRewardPool, APR {
    using VestingPositionLib for VestingPosition;

    mapping(address => VestingPosition) public positions;
    mapping(address => mapping(address => VestingPosition)) public delegationPositions;

    mapping(address => mapping(uint256 => RPS)) public historyRPS;
    mapping(address => ValRewardHistory[]) public valRewardHistory;
    // Historical Validator Delegation Pool's Params per delegator
    // validator => delegator => top-up data
    mapping(address => mapping(address => DelegationPoolParams[])) public delegationPoolParamsHistory;
    // keep the account parameters before the top-up, so we can separately calculate the rewards made before  a top-up is made
    // This is because we need to apply the RSI bonus to the rewards made before the top-up
    // and not apply the RSI bonus to the rewards made after the top-up
    mapping(address => mapping(address => RewardParams)) public beforeTopUpParams;

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

    function isStakerInVestingCycle(address staker) public view returns (bool) {
        return positions[staker].isStakerInVestingCycle();
    }

    // function getValRewardsValues(address validator) external view returns (ValReward[] memory) {
    //     return valRewards[validator];
    // }

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

    /**
     * Handles the logic to be executed when a validator in vesting position stakes
     */
    function _handleStake(address staker, uint256 oldBalance) internal {
        uint256 duration = positions[staker].duration;
        uint256 durationIncrease = _calculateDurationIncrease(oldBalance, duration);
        positions[staker].duration = duration + durationIncrease;
        positions[staker].end = positions[staker].end + durationIncrease;
        positions[staker].rsiBonus = 0;
    }

    function _calculateDurationIncrease(uint256 oldBalance, uint256 duration) private returns (uint256) {
        // duration increase must not be bigger than double
        if (msg.value >= oldBalance) {
            return duration;
        } else {
            return (msg.value * duration) / oldBalance;
        }
    }

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

    function _saveEpochRPS(address validator, uint256 rewardPerShare, uint256 epochNumber) internal {
        require(rewardPerShare > 0, "rewardPerShare must be greater than 0");

        RPS memory validatorRPSes = historyRPS[validator][epochNumber];
        require(validatorRPSes.value == 0, "RPS already saved");

        historyRPS[validator][epochNumber] = RPS({value: uint192(rewardPerShare), timestamp: uint64(block.timestamp)});
    }
}
