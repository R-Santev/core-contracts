// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IVesting {
    // TODO: Add docs
    function vestDelegate(address validator) external payable;

    function vestClaimReward(address validator, uint256 epochNumber, uint256 topUpIndex) external;
}
