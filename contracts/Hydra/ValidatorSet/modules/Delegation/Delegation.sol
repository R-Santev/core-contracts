// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

//base implemetantion to be used by proxies
// address public implementation;

// H_MODIFY: Set base implementation for VestFactory
// implementation = address(new VestManager());

import "./../../ValidatorSetBase.sol";

abstract contract Delegation is ValidatorSetBase {
    function getDelegationPoolOf(address validator) external pure returns (address) {
        return validator;
    }
}
