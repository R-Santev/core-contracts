// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

import "./VestManager.sol";

abstract contract VestFactory is Initializable {
    // base implemetantion to be used by VestManager proxies
    address public implementation;

    function __VestFactory_init() internal onlyInitializing {
        __VestFactory_init_unchained();
    }

    function __VestFactory_init_unchained() internal onlyInitializing {
        implementation = address(new VestManager());
    }

    event NewClone(address indexed owner, address newClone);

    function _clone(address owner) internal returns (address) {
        address child = Clones.clone(implementation);

        VestManager(child).initialize(owner);

        emit NewClone(owner, child);

        return child;
    }
}
