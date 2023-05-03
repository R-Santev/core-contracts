// SPDX-License-Identifier: MIT

// TODO: About the contract size 36000 bytes
// Move VestFactory to a separate contract
// Extract logic that can be handled by the Vest Managers from the Vesting contract
// Decrease functions
// Optimize logic to less code
// Use custom Errors without args to reduce strings size

pragma solidity 0.8.17;

import "hardhat/console.sol";

import "./../modules/CVSStorage.sol";
import "./../modules/CVSDelegation.sol";

import "./APR.sol";
import "./VestFactory.sol";

import "../../interfaces/Errors.sol";
import "../../interfaces/h_modules/IVesting.sol";

import "../../libs/RewardPool.sol";

error NoReward();

abstract contract Vesting is IVesting {
    // validator => position => vesting user data
    mapping(address => mapping(address => VestData)) public vestings;

    struct VestData {
        uint256 duration;
        uint256 start;
        uint256 end;
        uint256 base;
        uint256 vestBonus;
        uint256 rsiBonus;
    }

    function openPosition(address validator, uint256 durationWeeks) external payable virtual;

    function topUpPosition(address validator) external payable virtual;

    function cutPosition(address validator, uint256 amount) external virtual;

    function claimPositionReward(address validator, uint256 epochNumber, uint256 topUpIndex) public virtual;

    function isActivePosition(address validator, address delegator) public view returns (bool) {
        return
            vestings[validator][delegator].start < block.timestamp &&
            block.timestamp < vestings[validator][delegator].end;
    }

    function isMaturingPosition(address validator) public view returns (bool) {
        uint256 vestingEnd = vestings[validator][msg.sender].end;
        uint256 matureEnd = vestingEnd + vestings[validator][msg.sender].duration;
        return vestingEnd < block.timestamp && block.timestamp < matureEnd;
    }

    /** @param amount Amount of tokens to be slashed
     * @dev Invoke only when position is active, otherwise - underflow
     */
    function _calcSlashing(address validator, uint256 amount) internal view returns (uint256) {
        VestData memory data = vestings[validator][msg.sender];

        // Calculate what part of the delegated balance to be slashed
        uint256 leftPeriod = data.end - block.timestamp;
        uint256 fullPeriod = data.duration;
        uint256 slash = (amount * leftPeriod) / fullPeriod;

        return slash;
    }

    function _burnAmount(uint256 amount) internal {
        payable(address(0)).transfer(amount);
    }
}
