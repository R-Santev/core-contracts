// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IRewardPool {
    function getAPRPositionParams() external view returns (uint256, uint256, uint256, uint256);

    function isActivePosition(address staker) external view returns (bool);

    function isMaturingPosition(address staker) external view returns (bool);

    /**
     * Returns true if the staker is an active vesting position or not all rewards from the latest
     *  active position are matured yet
     * @param staker Address of the staker
     */
    function isStakerInVestingCycle(address staker) external view returns (bool);

    function onNewPosition(address staker, uint256 durationWeeks) external;

    function onStake(address staker, uint256 oldBalance) external;
}
