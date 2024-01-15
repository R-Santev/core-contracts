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

    /// @notice top up to a delegate positions
    function onTopUpDelegatePosition(
        address validator,
        address delegator,
        uint256 newBalance,
        uint256 currentEpochId
    ) external;

    /// @notice update the reward params for the vested position
    function onStake(address staker, uint256 amount, uint256 oldBalance) external;

    /// @notice update the reward params for the new vested position
    function onUnstake(
        address staker,
        uint256 amountUnstaked,
        uint256 amountLeft
    ) external returns (uint256 amountToWithdraw);

    /// @notice withdraws from the delegation pools and claims rewards
    /// @dev returns the reward in order to make the withdrawal in the delegation contract
    function onUndelegate(address delegator, address validator, uint256 amount) external returns (uint256 reward);

    /// @notice cuts a vesting position from the delegation pool
    /// @dev applies penalty (slashing) if the vesting period is active and returns the updated amount
    function onCutPosition(
        address validator,
        address delegator,
        uint256 amount,
        uint256 delegatedAmount,
        uint256 currentEpochId
    ) external returns (uint256);

    /**
     * @notice Claims delegator rewards for sender.
     * @param validator Validator to claim from
     * @param restake Whether to redelegate the claimed rewards
     */
    function claimDelegatorReward(address delegator, address validator, bool restake) external returns (uint256);

    /**
     * Returns true if the staker is an active vesting position or not all rewards from the latest
     *  active position are matured yet
     * @param staker Address of the staker
     */
    // function isStakerInVestingCycle(address staker) external view returns (bool);

    /// @notice Returns the generated rewards for a validator
    /// @param validator Address of the staker
    function getValidatorReward(address validator) external view returns (uint256);

    /**
     * @notice Gets delegators's unclaimed rewards with validator
     * @param validator Address of validator
     * @param delegator Address of delegator
     * @return Delegator's unclaimed rewards with validator (in MATIC wei)
     */
    function onGetDelegatorReward(address validator, address delegator) external view returns (uint256);

    /**
     * @notice Claims delegator rewards for sender.
     * @param validator Validator to claim from
     * @param delegator Delegator to claim for
     * @param epochNumber Epoch where the last claimable reward is distributed.
     * We need it because not all rewards are matured at the moment of claiming.
     * @param topUpIndex Whether to redelegate the claimed rewards
     */
    function onClaimPositionReward(
        address validator,
        address delegator,
        uint256 epochNumber,
        uint256 topUpIndex
    ) external returns (uint256);

    /**
     * @notice returns the supply of the delegation pool of the requested validator
     * @param validator the address of the validator whose pool is being queried
     * @return supply of the delegation pool
     */
    function getDelegationPoolSupplyOf(address validator) external view returns (uint256);
}
