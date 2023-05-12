// SPDX-License-Identifier: MIT

// TODO: About the contract size 36000 bytes
// Move VestFactory to a separate contract
// Extract logic that can be handled by the Vest Managers from the Vesting contract
// Decrease functions
// Optimize logic to less code
// Use custom Errors without args to reduce strings size

pragma solidity 0.8.17;

import "./APR.sol";

import "../../interfaces/Errors.sol";

error NoReward();

abstract contract Vesting is APR {
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

    function isMaturingPosition(VestData memory position) public view returns (bool) {
        uint256 vestingEnd = position.end;
        uint256 matureEnd = vestingEnd + position.duration;
        return vestingEnd < block.timestamp && block.timestamp < matureEnd;
    }

    function _applyCustomReward(VestData memory position, uint256 reward, bool rsi) internal pure returns (uint256) {
        uint256 bonus = (position.base + position.vestBonus);
        uint256 divider = 10000;
        if (rsi) {
            bonus = bonus * position.rsiBonus;
            divider *= 10000;
        }

        return (reward * bonus) / divider;
    }

    /** @param amount Amount of tokens to be slashed
     * @dev Invoke only when position is active, otherwise - underflow
     */
    function _calcSlashing(VestData memory position, uint256 amount) internal view returns (uint256) {
        // Calculate what part of the balance to be slashed
        uint256 leftPeriod = position.end - block.timestamp;
        uint256 fullPeriod = position.duration;
        uint256 slash = (amount * leftPeriod) / fullPeriod;

        return slash;
    }

    function _burnAmount(uint256 amount) internal {
        payable(address(0)).transfer(amount);
    }
}
