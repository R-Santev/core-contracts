// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "../modules/CVSStorage.sol";
import "../modules/CVSAccessControl.sol";
import "../../interfaces/h_modules/IPowerExponent.sol";

contract PowerExponent is IPowerExponent, CVSStorage, CVSAccessControl {
    /**
     * @inheritdoc IPowerExponent
     */
    function getExponent() external view returns (uint256 numerator, uint256 denominator) {
        return (powerExponent.value, 10000);
    }

    /**
     * @inheritdoc IPowerExponent
     */
    function updateExponent(uint256 newValue) external onlyOwner {
        require(newValue > 4999 && newValue < 10001, "0.5 <= Exponent <= 1");

        powerExponent.pendingValue = uint128(newValue);
    }

    /**
     * @notice Apply pending value if any
     *
     * @dev Execute when commit epoch
     */
    function _applyPendingExp() internal {
        PowerExponentStore memory data = powerExponent;
        if (data.pendingValue != 0) {
            data.value = data.pendingValue;
            data.pendingValue = 0;

            powerExponent = data;
        }
    }
}
