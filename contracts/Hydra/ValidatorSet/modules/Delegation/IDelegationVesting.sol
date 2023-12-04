// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IDelegationVesting {
    event PositionOpened(
        address indexed manager,
        address indexed validator,
        uint256 indexed weeksDuration,
        uint256 amount
    );
    event PositionTopUp(address indexed manager, address indexed validator, uint256 amount);
    event PositionCut(address indexed manager, address indexed validator, uint256 amount);
    event PositionRewardClaimed(address indexed manager, address indexed validator, uint256 amount);

    /**
     * @notice Creates new vesting manager which owner is the caller.
     * Every new instance is proxy leading to base impl, so minimal fees are applied.
     * Only Vesting manager can use the vesting functionality,
     * so users need to create a manager first to be able to vest.
     */
    function newManager() external;

    /**
     * @notice Delegates sent amount to validator. Set vesting position data.
     * Delete old top-ups data if exists. Can be called by vesting positions' managers only.
     * @param validator Validator to delegate to
     * @param durationWeeks Duration of the vesting in weeks
     */
    function openDelegatorPosition(address validator, uint256 durationWeeks) external payable;

    /**
     * @notice Delegates sent amount to validator. Add top-up data.
     * Modify vesting position data. Can be called by vesting positions' managers only.
     * @param validator Validator to delegate to
     */
    function topUpPosition(address validator) external payable;

    /**
     * @notice Undelegates amount from validator. Apply penalty in case vesting is not finished.
     * Can be called by vesting positions' managers only.
     * @param validator Validator to undelegate from
     * @param amount Amount to be undelegated
     */
    function cutPosition(address validator, uint256 amount) external;

    /**
     * @notice Claims delegator rewards for sender.
     * @param validator Validator to claim from
     * @param epochNumber Epoch where the last claimable reward is distributed.
     * We need it because not all rewards are matured at the moment of claiming.
     * @param topUpIndex Whether to redelegate the claimed rewards
     */
    function claimPositionReward(address validator, uint256 epochNumber, uint256 topUpIndex) external;
}
