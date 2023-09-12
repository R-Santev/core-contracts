// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./../interfaces/IValidatorSet.sol";
import "./APR.sol";

contract VestingData is APR {
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

    mapping(address => mapping(uint256 => RPS)) public historyRPS;

    mapping(address => ValReward) public valRewards;
    mapping(address => ValRewardRecord[]) public valRewardRecords;

    function _applyCustomReward(VestData memory position, uint256 reward, bool rsi) internal pure returns (uint256) {
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
