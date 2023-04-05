// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

import "./VestPosition.sol";

contract VestFactory is Ownable {
    uint8 public latestAddedVersion;

    mapping(address => bool) public clones;
    address public implementation;

    event NewClone(address newClone);

    constructor(address _implementation) {
        implementation = _implementation;
    }

    function clone() external {
        address child = Clones.clone(implementation);
        clones[child] = true;

        VestPosition(child).initialize(address(this));

        emit NewClone(child);
    }

    function isClone(address proxy) public view returns (bool) {
        return clones[proxy];
    }
}
