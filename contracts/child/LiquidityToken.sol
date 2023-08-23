// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "./Governed.sol";

/**
 * @title LiquidityToken
 * @dev This contract represents the liquidity token for the Hydra staking mechanism.
 */
contract LiquidityToken is ERC20Upgradeable, Governed {
    /// @notice The role identifier for address(es) that have permission to mint and burn the token.
    bytes32 public constant SUPPLY_CONTROLLER_ROLE = keccak256("SUPPLY_CONTROLLER_ROLE");

    /**
     * @dev Initializes the token contract with the provided name, symbol, governed role, and supply controller.
     * @param name_ The name of the token.
     * @param symbol_ The symbol of the token.
     * @param governer The address that has rights to change the SUPPLY_CONTROLLERs.
     * @param supplyController The address assigned for controlling the supply (mint/burn) of the token.
     */
    function initialize(
        string calldata name_,
        string calldata symbol_,
        address governer,
        address supplyController
    ) public initializer {
        __ERC20_init(name_, symbol_);
        __Governed_init(governer);

        _grantRole(SUPPLY_CONTROLLER_ROLE, supplyController);
    }

    /**
     * @notice Mints the specified `amount` of tokens to the given address.
     * @dev Can only be called by an address with the `SUPPLY_CONTROLLER_ROLE`.
     * @param to The address to receive the minted tokens.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) public onlyRole(SUPPLY_CONTROLLER_ROLE) {
        _mint(to, amount);
    }

    /**
     * @notice Burns the specified `amount` of tokens from the given account.
     * @dev Can only be called by an address with the `SUPPLY_CONTROLLER_ROLE`.
     * @param account The address from which tokens will be burned.
     * @param amount The amount of tokens to burn.
     */
    function burn(address account, uint256 amount) public onlyRole(SUPPLY_CONTROLLER_ROLE) {
        _burn(account, amount);
    }
}
