// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./../modules/CVSStorage.sol";

import "../../interfaces/Errors.sol";

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

    function isPosition(address validator, address delegator) public view returns (bool) {
        return positions[validator][delegator].vestingEnd > 0;
    }

    function isActivePosition(address validator, address delegator) public view returns (bool) {
        Position memory position = positions[validator][delegator];
        return position.vestingStart <= block.timestamp && position.vestingEnd >= block.timestamp;
    }
}
