// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./../../interfaces/h_modules/IPowerExponent.sol";

contract CVSStorage {
    uint256 public currentEpochId;

    // Initial Voting Power exponent to be ^0.5
    PowerExponentStore public powerExponent;

    //base implemetantion to be used by proxies
    address public implementation;

    // Liquid Staking token given to stakers and delegators
    address internal _liquidToken;

    // slither-disable-next-line unused-state,naming-convention
    uint256[50] private __gap;
}
