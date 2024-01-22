// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IDelegation {
    event Delegated(address indexed validator, address indexed delegator, uint256 amount);
    event Undelegated(address indexed validator, address indexed delegator, uint256 amount);

    /**
     * @notice Delegates sent amount to validator. Claims rewards beforehand.
     * @param validator Validator to delegate to
     */
    function delegateToValidator(address validator) external payable;

    /**
     * @notice Undelegates amount from validator for sender. Claims rewards beforehand.
     * @param validator Validator to undelegate from
     * @param amount The amount to undelegate
     */
    function undelegate(address validator, uint256 amount) external;

    /**
     * @notice Delegates sent amount to validator. Set vesting position data.
     * Delete old top-ups data if exists. Can be called by vesting positions' managers only.
     * @param validator Validator to delegate to
     * @param durationWeeks Duration of the vesting in weeks
     */
    function openVestedDelegatePosition(address validator, uint256 durationWeeks) external payable;

    /**
     * @notice Delegates sent amount to validator. Add top-up data.
     * Modify vesting position data. Can be called by vesting positions' managers only.
     * @param validator Validator to delegate to
     */
    function topUpDelegatePosition(address validator) external payable;

    /**
     * @notice Undelegates amount from validator. Apply penalty in case vesting is not finished.
     * Can be called by vesting positions' managers only.
     * @param validator Validator to undelegate from
     * @param amount Amount to be undelegated
     */
    function cutDelegatePosition(address validator, uint256 amount) external;

    /**
     * @notice Claims delegator rewards for sender.
     * @param validator Validator to claim from
     * @param epochNumber Epoch where the last claimable reward is distributed.
     * We need it because not all rewards are matured at the moment of claiming.
     * @param topUpIndex Whether to redelegate the claimed rewards
     */
    function claimPositionReward(address validator, uint256 epochNumber, uint256 topUpIndex) external;
}
