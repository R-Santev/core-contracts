// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "./IDelegation.sol";
import "./VestedDelegation.sol";
import "./../Staking/StateSyncer.sol";
import "./../Staking/LiquidStaking.sol";
import "./../Withdrawal/Withdrawal.sol";
import "./../../ValidatorSetBase.sol";
import "./../../../common/CommonStructs.sol";
import "./libs/DelegationPoolLib.sol";

abstract contract Delegation is
    IDelegation,
    ValidatorSetBase,
    ERC20VotesUpgradeable,
    VestedDelegation,
    Withdrawal,
    LiquidStaking,
    StateSyncer
{
    using DelegationPoolLib for DelegationPool;

    /// @notice The minimum delegation amount to be delegated
    uint256 public minDelegation;

    /// @notice Keeps the validator's balances for every delegator
    mapping(address => mapping(address => uint256)) balances;

    // _______________ Initializer _______________

    function __Delegation_init(uint256 newMinDelegation) internal onlyInitializing {
        __VestFactory_init();
        __Delegation_init_unchained(newMinDelegation);
    }

    function __Delegation_init_unchained(uint256 newMinDelegation) internal onlyInitializing {
        minDelegation = newMinDelegation;
    }

    // _______________ External functions _______________

    /**
     * @inheritdoc IDelegation
     */
    function delegate(address validator, bool restake) external payable {
        if (msg.value == 0) revert DelegateRequirement({src: "delegate", msg: "DELEGATING_AMOUNT_ZERO"});

        uint256 delegatedAmount = balances[validator][msg.sender];
        if (delegatedAmount + msg.value < minDelegation)
            revert DelegateRequirement({src: "delegate", msg: "DELEGATION_TOO_LOW"});

        _processDelegate(validator, msg.sender, restake, msg.value);
    }

    /**
     * @inheritdoc IDelegation
     */
    function undelegate(address validator, uint256 amount) external {
        uint256 delegatedAmount = balanceOf(msg.sender);
        if (amount > delegatedAmount) revert DelegateRequirement({src: "undelegate", msg: "INSUFFICIENT_BALANCE"});

        uint256 amounAfterUndelegate = delegatedAmount - amount;
        if (amounAfterUndelegate < minDelegation && amounAfterUndelegate != 0)
            revert DelegateRequirement({src: "undelegate", msg: "DELEGATION_TOO_LOW"});

        _processUndelegate(validator, msg.sender, amount);
    }

    /**
     * @inheritdoc IDelegation
     */
    function openDelegatePosition(address validator, uint256 durationWeeks) external payable onlyManager {
        uint256 balance = balances[validator][msg.sender];
        uint256 newBalance = balance + msg.value;
        if (newBalance < minDelegation) revert StakeRequirement({src: "vesting", msg: "DELEGATION_TOO_LOW"});

        _delegateToVal(msg.sender, validator, msg.value);
        rewardPool.onNewDelegatePosition(validator, msg.sender, durationWeeks, currentEpochId, newBalance);

        emit PositionOpened(msg.sender, validator, durationWeeks, msg.value);
    }

    /**
     * @inheritdoc IDelegation
     */
    function topUpDelegatePosition(address validator) external payable onlyManager {
        uint256 balance = balances[validator][msg.sender];
        if (balance + msg.value < minDelegation) revert StakeRequirement({src: "vesting", msg: "DELEGATION_TOO_LOW"});

        _delegateToVal(msg.sender, validator, msg.value);
        rewardPool.onTopUpDelegatePosition(validator, msg.sender, balance + msg.value, currentEpochId);

        emit PositionTopUp(msg.sender, validator, msg.value);
    }

    /**
     * @inheritdoc IDelegation
     */
    function cutDelegatePosition(address validator, uint256 amount) external onlyManager {
        uint256 delegatedAmount = balances[validator][msg.sender];
        if (amount > delegatedAmount) revert DelegateRequirement({src: "vesting", msg: "DELEGATION_TOO_LOW"});

        uint256 amountAfterUndelegate = delegatedAmount - amount;
        if (amountAfterUndelegate < minDelegation && amountAfterUndelegate != 0)
            revert DelegateRequirement({src: "vesting", msg: "DELEGATION_TOO_LOW"});

        _postUndelegateAction(msg.sender, validator, amount);

        amount = rewardPool.onCutPosition(validator, msg.sender, amount, amountAfterUndelegate, 0);

        _registerWithdrawal(msg.sender, amount);
        emit PositionCut(msg.sender, validator, amount);
    }

    /**
     * @inheritdoc IDelegation
     */
    function claimPositionReward(address validator, uint256 epochNumber, uint256 topUpIndex) external onlyManager {
        uint256 amount = rewardPool.onClaimPositionReward(validator, msg.sender, epochNumber, topUpIndex);
        if (amount == 0) return;

        _registerWithdrawal(msg.sender, amount);

        emit PositionRewardClaimed(msg.sender, validator, amount);
    }

    // External View functions
    /**
     * @inheritdoc IDelegation
     */
    function getDelegatorReward(address validator, address delegator) external view returns (uint256) {
        return rewardPool.onGetDelegatorReward(validator, delegator);
    }

    /**
     * @inheritdoc IDelegation
     */
    function delegationOf(address validator, address delegator) external view returns (uint256) {
        return balances[validator][delegator];
    }

    /**
     * @inheritdoc IDelegation
     */
    function totalDelegationOf(address validator) external view returns (uint256) {
        return balanceOf(validator);
    }

    // _______________ Public functions _______________

    // _______________ Internal functions _______________

    function _processDelegate(address validator, address delegator, bool restake, uint256 amount) internal {
        uint256 reward = rewardPool.claimDelegatorReward(delegator, validator, restake);
        if (reward != 0) {
            if (!restake) _registerWithdrawal(delegator, reward);

            emit DelegatorRewardClaimed(delegator, validator, restake, reward);
        }

        _mint(delegator, amount);
        _delegate(delegator, delegator);
        _postDelegateAction(validator, delegator, amount);
        emit Delegated(delegator, validator, amount);
    }

    function _processUndelegate(address validator, address delegator, uint256 amount) internal {
        uint256 reward = rewardPool.onUndelegate(delegator, validator, amount);
        uint256 amountInclReward = amount + reward;

        _postUndelegateAction(validator, delegator, amountInclReward);
        _registerWithdrawal(delegator, amountInclReward);
        emit Undelegated(delegator, validator, amountInclReward);
    }

    // _______________ Private functions _______________

    function _delegateToVal(address delegator, address validator, uint256 amount) private {
        if (!validators[validator].active) revert Unauthorized("INVALID_VALIDATOR");
        _increaseValidatorBalance(validator, amount);
        balances[validator][delegator] += amount;

        _postDelegateAction(validator, delegator, amount);

        emit Delegated(delegator, validator, amount);
    }

    function _increaseValidatorBalance(address validator, uint256 amount) private {
        _mint(validator, amount);
        _delegate(validator, validator);
    }

    function _postDelegateAction(address validator, address delegator, uint256 amount) private {
        StateSyncer._syncStake(validator, amount);
        LiquidStaking._onDelegate(delegator, amount);
    }

    function _postUndelegateAction(address validator, address delegator, uint256 amount) private {
        StateSyncer._syncUnstake(validator, amount);
        LiquidStaking._onUndelegate(delegator, amount);
    }
}
