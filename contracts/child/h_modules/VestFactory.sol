// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/proxy/Clones.sol";

import "../modules/CVSStorage.sol";

import "./VestPosition.sol";

abstract contract VestFactory is CVSStorage {
    event NewClone(address newClone);

    function clone(address owner) internal returns (address) {
        address child = Clones.clone(implementation);

        VestPosition(child).initialize(owner);

        emit NewClone(child);

        return child;
    }
}
