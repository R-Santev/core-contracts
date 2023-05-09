// SPDX-License-Identifier: MIT

// TODO: About the contract size 36000 bytes
// Move VestFactory to a separate contract
// Extract logic that can be handled by the Vest Managers from the Vesting contract
// Decrease functions
// Optimize logic to less code
// Use custom Errors without args to reduce strings size

pragma solidity 0.8.17;

import "../../interfaces/Errors.sol";
import "./APR.sol";

error NoReward();

abstract contract Vesting is APR {
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

    /**
     * Returns true if the staker is in active vesting position
     *  active position are matured yet
     * @param position VestData struct holding the vesting position data
     */
    function isActivePosition(VestData memory position) public view returns (bool) {
        return position.start < block.timestamp && block.timestamp < position.end;
    }

    function isMaturingPosition(address validator) public view returns (bool) {
        uint256 vestingEnd = vestings[validator][msg.sender].end;
        uint256 matureEnd = vestingEnd + vestings[validator][msg.sender].duration;
        return vestingEnd < block.timestamp && block.timestamp < matureEnd;
    }

    /** @param amount Amount of tokens to be slashed
     * @dev Invoke only when position is active, otherwise - underflow
     */
    function _calcSlashing(VestData memory position, uint256 amount) internal view returns (uint256) {
        // Calculate what part of the delegated balance to be slashed
        uint256 leftPeriod = position.end - block.timestamp;
        uint256 fullPeriod = position.duration;
        uint256 slash = (amount * leftPeriod) / fullPeriod;

        return slash;
    }

    function _burnAmount(uint256 amount) internal {
        payable(address(0)).transfer(amount);
    }
}
