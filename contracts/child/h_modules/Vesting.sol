// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./../modules/CVSStorage.sol";

import "../../interfaces/Errors.sol";

error NoReward();

contract Vesting is CVSStorage {
    // RPS = Reward Per Share
    struct RPS {
        uint192 value;
        uint64 timestamp;
    }

    struct Position {
        uint256 vestingStart;
        uint256 vestingEnd;
    }

    struct VestData {
        uint256 amount;
        uint256 end;
        uint256 period; // in weeks
        uint256 bonus; // user apr params
    }

    struct TopUpData {
        uint256 balance;
        int256 correction;
        uint256 epochNum;
    }

    // validator => user => VestData
    mapping(address => mapping(address => VestData)) public vestingPerVal;
    mapping(address => mapping(address => TopUpData[])) public topUpPerVal;

    // validator => delegator => Position Data
    mapping(address => mapping(address => Position)) public positions;

    // validator delegation pool => epochNumber => RPS
    mapping(address => mapping(uint256 => RPS)) public historyRPS;

    function _saveEpochRPS(address validator, uint256 rewardPerShare, uint256 epochNumber) internal {
        require(rewardPerShare > 0, "rewardPerShare must be greater than 0");

        RPS memory validatorRPSes = historyRPS[validator][epochNumber];
        require(validatorRPSes.value == 0, "RPS already saved");

        historyRPS[validator][epochNumber] = RPS({value: uint192(rewardPerShare), timestamp: uint64(block.timestamp)});

        // Immediately save the first RPS
        // if (validatorRPSes.length < 1) {
        //     weeklyRPSes[validator].push(
        //         WeeklyRPS({value: uint192(rewardPerShare), timestamp: uint64(block.timestamp)})
        //     );
        //     return;
        // }

        // // Add new RPS if one week have been passed from the last RPS
        // // TODO: Use safecast for the casting
        // if (lastRPS.timestamp + 1 weeks <= block.timestamp) {
        //     weeklyRPSes[validator].push(
        //         WeeklyRPS({value: uint192(rewardPerShare), timestamp: uint64(block.timestamp)})
        //     );
        // }
    }

    // function _setPosition(address validator, uint256 amount, uint256 vestingWeeks) internal {
    //     require(amount > 0, "amount must be greater than 0");
    //     require(vestingWeeks > 0, "vestingWeeks must be greater than 0");

    //     if (isUsedPosition(validator, msg.sender)) {
    //         revert StakeRequirement({src: "vesting", msg: "POSITION_ALREADY_USED"});
    //     }

    //     positions[validator][msg.sender] = Position({
    //         vestingStart: block.timestamp,
    //         vestingEnd: block.timestamp + vestingWeeks * 1 weeks
    //     });

    //     _delegate(msg.sender, validator, msg.value);
    // }

    // CONTINUE: Think about the structure of the vesting, because with the current withdrawal settings the mechanism would not work

    // function claimBonus()

    function poolStateParams(
        address validator,
        uint256 epochNumber,
        uint256 topUpIndex
    ) internal returns (uint256, TopUpData memory) {
        VestData storage data = vestingPerVal[validator][msg.sender];
        uint256 start = data.end - data.period * 1 weeks;
        require(block.timestamp >= start, "VestPosition: not started");

        if (data.end > block.timestamp) {
            revert NoReward();
        }

        uint256 maturePeriod = block.timestamp - data.end;
        uint256 matureTimestamp = start + maturePeriod;

        RPS memory rps = historyRPS[validator][epochNumber];
        if (rps.timestamp > matureTimestamp) {
            revert NoReward();
        }

        TopUpData memory topUp = handleTopUp(validator, epochNumber, topUpIndex);

        return (rps.value, topUp);

        // CVSDelegation(staking).claimDelegatorReward(validator, false, epochRPS, topUp.balance, topUp.correction);
        // uint256 reward = address(this).balance - currentBalance;
        // require(reward > 0, "VestPosition: no reward");

        // uint256 bonusReward = Vesting(staking).claimBonus(validator);
        // uint256 amount = reward + bonusReward;

        // emit Claimed(msg.sender, amount);

        // (bool success, ) = msg.sender.call{value: amount}("");
        // require(success, "VestPosition: claim failed");
    }

    function isPosition(address validator, address delegator) public view returns (bool) {
        return positions[validator][delegator].vestingEnd > 0;
    }

    function isActivePosition(address validator, address delegator) public view returns (bool) {
        Position memory position = positions[validator][delegator];
        return position.vestingStart <= block.timestamp && position.vestingEnd >= block.timestamp;
    }

    function handleTopUp(
        address validator,
        uint256 epochNumber,
        uint256 topUpIndex
    ) internal returns (TopUpData memory) {
        if (topUpIndex >= topUpPerVal[validator][msg.sender].length) {
            revert();
        }

        TopUpData memory topUp = topUpPerVal[validator][msg.sender][topUpIndex];

        if (topUp.epochNum > epochNumber) {
            revert();
        } else if (topUp.epochNum == epochNumber) {
            // If topUp is made exactly in the before epoch - it is the valid one for sure
        } else {
            // This is the case where the topUp is made more than 1 epoch before the handled one (epochNumber)
            if (topUpIndex == topUpPerVal[validator][msg.sender].length - 1) {
                // If it is the last topUp - don't check does the next one can be better
            } else {
                // If it is not the last topUp - check does the next one can be better
                TopUpData memory nextTopUp = topUpPerVal[validator][msg.sender][topUpIndex + 1];
                if (nextTopUp.epochNum < epochNumber) {
                    // If the next topUp is made in an epoch before the handled one
                    // and is bigger than the provided top - the provided one is not valid
                    revert();
                }
            }
        }

        return topUp;
    }
}
