// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./VestFactory.sol";

error NotVestingManager();

abstract contract DelegationVesting is IDelegationVesting, VestFactory {
    // vesting manager => owner
    mapping(address => address) public vestManagers;

    modifier onlyManager() {
        if (!isVestingManager(msg.sender)) {
            revert NotVestingManager();
        }

        _;
    }

    function isVestingManager(address delegator) public view returns (bool) {
        return vestManagers[delegator] != address(0);
    }
}
