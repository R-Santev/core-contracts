// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "../../../../interfaces/modules/ICVSAccessControl.sol";

abstract contract AccessControl is ICVSAccessControl, Ownable2StepUpgradeable {
    mapping(address => bool) public whitelist;

    function __CVSAccessControl_init(address governance) internal onlyInitializing {
        __CVSAccessControl_init_unchained(governance);
    }

    function __CVSAccessControl_init_unchained(address governance) internal onlyInitializing {
        _transferOwnership(governance);
    }

    /**
     * @notice Adds addresses that are allowed to register as validators.
     * @param whitelistAddreses Array of address to whitelist
     */
    function addToWhitelist(address[] calldata whitelistAddreses) external onlyOwner {
        for (uint256 i = 0; i < whitelistAddreses.length; i++) {
            _addToWhitelist(whitelistAddreses[i]);
        }
    }

    /**
     * @notice Deletes addresses that are allowed to register as validators.
     * @param whitelistAddreses Array of address to remove from whitelist
     */
    function removeFromWhitelist(address[] calldata whitelistAddreses) external onlyOwner {
        for (uint256 i = 0; i < whitelistAddreses.length; i++) {
            _removeFromWhitelist(whitelistAddreses[i]);
        }
    }

    function _addToWhitelist(address account) internal {
        whitelist[account] = true;
        emit AddedToWhitelist(account);
    }

    function _removeFromWhitelist(address account) internal {
        whitelist[account] = false;
        emit RemovedFromWhitelist(account);
    }

    // slither-disable-next-line unused-state,naming-convention
    uint256[50] private __gap;
}
