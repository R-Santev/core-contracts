// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/proxy/Clones.sol";

import "../modules/CVSStorage.sol";

import "./VestManager.sol";

abstract contract VestFactory is CVSStorage {
    event NewClone(address indexed owner, address newClone);

    function _clone(address owner) internal returns (address) {
        address child = Clones.clone(implementation);

        VestManager(child).initialize(owner);

        emit NewClone(owner, child);

        return child;
    }
}
