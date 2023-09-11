// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

contract VestingData {
    // Reward Per Share
    struct RPS {
        uint192 value;
        uint64 timestamp;
    }

    struct ValReward {
        uint256 totalReward;
        uint256 epoch;
        uint256 timestamp;
    }

    mapping(address => mapping(uint256 => RPS)) public historyRPS;
    mapping(address => ValReward[]) public valRewards;

    function _saveEpochRPS(address validator, uint256 rewardPerShare, uint256 epochNumber) internal {
        require(rewardPerShare > 0, "rewardPerShare must be greater than 0");

        RPS memory validatorRPSes = historyRPS[validator][epochNumber];
        require(validatorRPSes.value == 0, "RPS already saved");

        historyRPS[validator][epochNumber] = RPS({value: uint192(rewardPerShare), timestamp: uint64(block.timestamp)});
    }

    function _saveValRewardData(address validator, uint256 epoch, uint256 reward) internal {
        ValReward memory rewardData = ValReward({totalReward: reward, epoch: epoch, timestamp: block.timestamp});

        valRewards[validator].push(rewardData);
    }
}
