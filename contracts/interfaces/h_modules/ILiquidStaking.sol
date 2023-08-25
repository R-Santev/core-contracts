// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface ILiquidStaking {
    /**
     * @notice Returns the address of the liquidity token.
     */
    function liquidToken() external view returns (address);
}
