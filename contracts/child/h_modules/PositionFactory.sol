// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./VestPosition.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

contract Factory is Ownable {
    uint8 public latestAddedVersion;

    mapping(uint8 => address[]) public clones;
    mapping(uint8 => address) public baseImplementationPerVersion;

    event NewClone(uint8 indexed versionUsed, address newClone);
    event NewVersion(uint8 indexed versionId, address baseImplementation);

    constructor(address _implementation) {
        _addVersion(_implementation);
    }

    function clone(uint8 _version) external {
        require(_version <= latestAddedVersion, "Invalid version");

        address child = Clones.clone(baseImplementationPerVersion[_version]);
        clones[_version].push(child);

        Implementation(child).initialize(msg.sender);

        emit NewClone(_version, child);
    }

    function addVersion(address _implementation) external onlyOwner {
        latestAddedVersion++;
        _addVersion(_implementation);
    }

    function getClones(uint8 version) external view returns (address[] memory) {
        return clones[version];
    }

    function _addVersion(address _implementation) private {
        baseImplementationPerVersion[latestAddedVersion] = _implementation;

        emit NewVersion(latestAddedVersion, _implementation);
    }
}
