// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./VestFactory.sol";
import "./IVestedDelegation.sol";

error NotVestingManager();

abstract contract VestedDelegation is IVestedDelegation, VestFactory {
    /// @notice vesting manager => owner
    mapping(address => address) public vestManagers;
    /// @notice Additional mapping to store all vesting managers per user address for fast off-chain lookup
    mapping(address => address[]) public userVestManagers;

    // _______________ Modifiers _______________

    modifier onlyManager() {
        if (!isVestingManager(msg.sender)) {
            revert NotVestingManager();
        }

        _;
    }

    // _______________ External functions _______________

    /**
     * @inheritdoc IVestedDelegation
     */
    function newManager() external {
        require(msg.sender != address(0), "INVALID_OWNER");

        address managerAddr = _clone(msg.sender);
        vestManagers[managerAddr] = msg.sender;
        userVestManagers[msg.sender].push(managerAddr);
    }

    // External functions that are view
    /**
     * @inheritdoc IVestedDelegation
     */
    function getUserVestManagers(address user) external view returns (address[] memory) {
        return userVestManagers[user];
    }

    // _______________ Public functions _______________

    // Public functions that are view
    /**
     * @notice Claims that a delegator is a vest manager or not.
     * @param delegator Delegator's address
     */
    function isVestingManager(address delegator) public view returns (bool) {
        return vestManagers[delegator] != address(0);
    }

    // _______________ Internal functions _______________

    // _______________ Private functions _______________
}
