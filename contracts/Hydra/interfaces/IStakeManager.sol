// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IStakeManager {
    function totalActiveStake() external view returns (uint256);
}
