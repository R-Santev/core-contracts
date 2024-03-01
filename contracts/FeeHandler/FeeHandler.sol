// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract FeeHandler is Initializable, OwnableUpgradeable {
    event FeeReceived(address indexed from, uint256 amount);
    event Response(bool success, bytes data);

    constructor() {
        _disableInitializers();
    }

    function initialize(address owner) public initializer {
        _transferOwnership(owner);
    }

    /**
     * @notice Generic method that will be used to transfer the generated fees to another contract
     * @param contractAddress The address of the contract that will be called
     * @param encodedFunction The encoded function with its signature and parameters, if any
     */
    function relocateFees(address contractAddress, bytes memory encodedFunction) public onlyOwner {
        (bool success, bytes memory data) = contractAddress.call{value: address(this).balance}(encodedFunction);

        emit Response(success, data);
    }

    receive() external payable {
        emit FeeReceived(msg.sender, msg.value);
    }
}
