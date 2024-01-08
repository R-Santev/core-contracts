// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./../ValidatorSet/IValidatorSet.sol";
import "./../common/CommonStructs.sol";

struct Uptime {
    address validator;
    uint256 signedBlocks;
}

interface IRewardPool {
    event ValidatorRewardClaimed(address indexed validator, uint256 amount);
    event ValidatorRewardDistributed(address indexed validator, uint256 amount);
    event DelegatorRewardDistributed(address indexed validator, uint256 amount);

    /// @notice distributes rewards for the given epoch
    /// @dev transfers funds from sender to this contract
    /// @param uptime uptime data for every validator
    function distributeRewardsFor(
        uint256 epochId,
        Epoch calldata epoch,
        Uptime[] calldata uptime,
        uint256 epochSize
    ) external;

    /// @notice sets the reward params for the new vested position
    function onNewPosition(address staker, uint256 durationWeeks) external;

    /// @notice sets the reward params for the new vested delegation position
    function onNewDelegatePosition(
        address validator,
        address delegator,
        uint256 durationWeeks,
        uint256 currentEpochId,
        uint256 newBalance
    ) external;

    function onTopUpDelegatePosition(
        address validator,
        address delegator,
        uint256 newBalance,
        uint256 currentEpochId
    ) external;

    /// @notice update the reward params for the vested position
    function onStake(address staker, uint256 oldBalance) external payable;

    /// @notice update the reward params for the new vested position.
    function onUnstake(
        address staker,
        uint256 amountUnstaked,
        uint256 amountLeft
    ) external returns (uint256 amountToWithdraw);

    function isActivePosition(address staker) external view returns (bool);

    function isMaturingPosition(address staker) external view returns (bool);

    /**
     * Returns true if the staker is an active vesting position or not all rewards from the latest
     *  active position are matured yet
     * @param staker Address of the staker
     */
    function isStakerInVestingCycle(address staker) external view returns (bool);

    /// @notice Returns the generated rewards for a validator
    /// @param validator Address of the staker
    function getValidatorReward(address validator) external view returns (uint256);
}
