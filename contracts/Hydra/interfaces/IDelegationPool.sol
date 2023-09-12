// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IDelegationPool {
    function magnifiedRewardPerShare() external view returns (uint256);

    /// @notice returns the delegation pool balance for a given epoch
    function delegationAt(uint256 epochNumber) external view returns (uint256);

    function distributeReward(uint256 reward) external;
}
