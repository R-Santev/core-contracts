// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

// import "./../../ValidatorSet/IValidatorSet.sol";
import "./APR.sol";
import "./../libs/VestingLib.sol";

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

struct ValRewardRecord {
    uint256 totalReward;
    uint256 epoch;
    uint256 timestamp;
}

contract VestingData is APR {
    using VestingPositionLib for VestingPosition;

    mapping(address => VestingPosition) public positions;
    mapping(address => mapping(uint256 => RPS)) public historyRPS;
    mapping(address => ValReward) public valRewards;
    mapping(address => ValRewardRecord[]) public valRewardRecords;

    function isActivePosition(address staker) public view returns (bool) {
        VestingPosition memory position = positions[staker];
        return position.isActive();
    }

    function isMaturingPosition(address staker) public view returns (bool) {
        VestingPosition memory position = positions[staker];
        return position.isMaturingPosition();
    }

    function onNewPosition(address staker, uint256 durationWeeks) external {
        uint256 duration = durationWeeks * 1 weeks;
        positions[staker] = VestingPosition({
            duration: duration,
            start: block.timestamp,
            end: block.timestamp + duration,
            base: getBase(),
            vestBonus: getVestingBonus(durationWeeks),
            rsiBonus: uint248(getRSI())
        });

        delete valRewards[staker];
    }

    function onStake(address staker, uint256 oldBalance) external {
        VestingPosition memory position = positions[staker];
        if (position.isActive()) {
            // stakeOf still shows the old balance because the new amount will be applied on commitEpoch
            _handleStake(staker, oldBalance);
        }
    }

    function onUnstake(
        address staker,
        uint256 amountUnstaked,
        uint256 amountLeft
    ) external returns (uint256 amountToWithdraw) {
        VestingPosition memory position = positions[msg.sender];
        if (position.isActive()) {
            Validator storage validator = validators[msg.sender];
            amountToWithdraw = _handleUnstake(validator, amountUnstaked, uint256(amountLeft));
        } else {
            amountToWithdraw = amountUnstaked;
        }

        return amountToWithdraw;
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

    function _saveValRewardData(address validator, uint256 epoch) internal {
        ValRewardRecord memory rewardData = ValRewardRecord({
            totalReward: valRewards[validator].total,
            epoch: epoch,
            timestamp: block.timestamp
        });

        valRewardRecords[validator].push(rewardData);
    }
}
