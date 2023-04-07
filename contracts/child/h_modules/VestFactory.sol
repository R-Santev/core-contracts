// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/proxy/Clones.sol";

import "./VestPosition.sol";

contract VestFactory {
    address public implementation;

    event NewClone(address newClone);

    constructor(address _implementation) {
        implementation = _implementation;
    }

    function clone() internal returns (address) {
        address child = Clones.clone(implementation);

        VestPosition(child).initialize(address(this));

        emit NewClone(child);

        return child;
    }
}
