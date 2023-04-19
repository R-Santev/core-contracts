// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IVesting {
    // TODO: Add docs
    function openPosition(address validator, uint256 duration) external payable;

    function topUpPosition(address validator) external payable;

    function cutPosition(address validator, uint256 amount) external;

    function claimPositionReward(address validator, uint256 epochNumber, uint256 topUpIndex) external;
}
