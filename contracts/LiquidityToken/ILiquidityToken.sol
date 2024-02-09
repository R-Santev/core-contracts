// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface ILiquidityToken {
    /**
     * @notice Mints the specified `amount` of tokens to the given address.
     * @dev Can only be called by an address with the `SUPPLY_CONTROLLER_ROLE`.
     * @param to The address to receive the minted tokens.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) external;

    /**
     * @notice Burns the specified `amount` of tokens from the given account.
     * @dev Can only be called by an address with the `SUPPLY_CONTROLLER_ROLE`.
     * @param account The address from which tokens will be burned.
     * @param amount The amount of tokens to burn.
     */
    function burn(address account, uint256 amount) external;
}
