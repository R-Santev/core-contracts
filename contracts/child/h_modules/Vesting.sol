// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./../modules/CVSStorage.sol";

import "./../h_modules/APR.sol";
import "./../h_modules/VestFactory.sol";

import "../../interfaces/Errors.sol";

error NoReward();

abstract contract Vesting is CVSStorage, VestFactory, APR {
    // RPS = Reward Per Share
    struct RPS {
        uint192 value;
        uint64 timestamp;
    }

    struct VestData {
        uint256 amount;
        uint256 end;
        uint256 bonus; // user apr params
    }

    struct TopUpData {
        uint256 balance;
        int256 correction;
        uint256 epochNum;
    }

    // validator => user => VestData
    mapping(address => mapping(address => TopUpData[])) public topUpPerVal;

    // validator => vesting period => delegator => Position Data
    mapping(address => mapping(uint256 => mapping(address => VestData))) public positions;

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

    function createPosition(address validator, uint256 vestingWeeks) external {
        if (vestingWeeks > 0 && vestingWeeks < 53) {
            revert StakeRequirement({src: "vesting", msg: "INVALID_VESTING_PERIOD"});
        }

        if (expression) {}

        if (isUsedPosition(validator, msg.sender)) {
            revert StakeRequirement({src: "vesting", msg: "POSITION_ALREADY_USED"});
        }

        // CONTINUE: find a way to check if position for specific period is created
        // there is no need for separate position contract per validator (because different delegation pools)
        // Create position
        // continue with delegate
        positions[validator][msg.sender] = Position({
            vestingStart: block.timestamp,
            vestingEnd: block.timestamp + vestingWeeks * 1 weeks
        });

        _delegate(msg.sender, validator, msg.value);
    }

    // CONTINUE: Think about the structure of the vesting, because with the current withdrawal settings the mechanism would not work

    // function claimBonus()

    function poolStateParams(
        address validator,
        uint256 epochNumber,
        uint256 topUpIndex
    ) internal view returns (uint256, TopUpData memory) {
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

    function isPosition() public view returns (bool) {
        return isClone(msg.sender);
    }

    function isActivePosition(address validator, address delegator) public view returns (bool) {
        Position memory position = positions[validator][delegator];
        return position.vestingEnd >= block.timestamp && position.vestingStart <= block.timestamp;
    }

    // TODO: Check if the commitEpoch is the last transaction in the epoch, otherwise bug may occur
    /**
     * @notice Checks if a top up was already made in the current epoch
     * @param validator Validator to delegate to
     */
    function isTopUpMade(address validator) public view returns (bool) {
        uint256 length = topUpPerVal[validator][msg.sender].length;
        if (length == 0) {
            return false;
        }

        TopUpData memory data = topUpPerVal[validator][msg.sender][length - 1];
        if (data.epochNum == currentEpochId) {
            return true;
        }

        return false;
    }

    function _topUp(address validator, uint256 oldBalance, uint256 balance, int256 correction) internal {
        topUpPerVal[validator][msg.sender].push(
            TopUpData({balance: balance, correction: correction, epochNum: currentEpochId})
        );

        // balance / old balance = increase coefficient
        // apply increase coefficient to the vesting period to find the increase in the period
        // TODO: Optimize gas costs
        uint256 timeIncrease = (balance * vestingPerVal[validator][msg.sender].period) / oldBalance;
        vestingPerVal[validator][msg.sender].end = vestingPerVal[validator][msg.sender].end + timeIncrease;
    }

    function handleTopUp(
        address validator,
        uint256 epochNumber,
        uint256 topUpIndex
    ) internal view returns (TopUpData memory) {
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

    function applyCustomAPR(address validator, uint256 amount) internal returns (uint256) {
        return (amount * vestingPerVal[validator][msg.sender].bonus) / DENOMINATOR;
    }
}
