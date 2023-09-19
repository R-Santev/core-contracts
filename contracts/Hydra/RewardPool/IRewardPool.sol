// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

struct UptimeData {
    address validator;
    uint256 signedBlocks;
}

struct Uptime {
    uint256 epochId;
    UptimeData[] uptimeData;
    uint256 totalBlocks;
}

interface IRewardPool {
    event ValidatorRewardClaimed(address indexed validator, uint256 amount);
    event ValidatorRewardDistributed(address indexed validator, uint256 amount);
    event DelegatorRewardDistributed(address indexed validator, uint256 amount);

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

    function onUnstake(
        address staker,
        uint256 amountUnstaked,
        uint256 amountLeft
    ) external returns (uint256 amountToWithdraw);
}
