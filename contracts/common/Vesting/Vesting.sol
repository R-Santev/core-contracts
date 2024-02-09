// SPDX-License-Identifier: MIT

// TODO: About the contract size 36000 bytes
// Move VestFactory to a separate contract
// Extract logic that can be handled by the Vest Managers from the Vesting contract
// Decrease functions
// Optimize logic to less code
// Use custom Errors without args to reduce strings size

pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./../Errors.sol";
import "./../../ValidatorSet/ValidatorSetBase.sol";

error NoReward();

abstract contract Vesting is ValidatorSetBase {
    /** @param amount Amount of tokens to be slashed
     * @dev Invoke only when position is active, otherwise - underflow
     */
    function _calcSlashing(
        uint256 positionEnd,
        uint256 positionDuration,
        uint256 amount
    ) internal view returns (uint256) {
        // Calculate what part of the balance to be slashed
        uint256 leftPeriod = positionEnd - block.timestamp;
        uint256 fullPeriod = positionDuration;
        uint256 slash = (amount * leftPeriod) / fullPeriod;

        return slash;
    }

    function _burnAmount(uint256 amount) internal {
        (bool success, ) = address(0).call{value: amount}("");
        require(success, "Failed to burn amount");
    }
}
