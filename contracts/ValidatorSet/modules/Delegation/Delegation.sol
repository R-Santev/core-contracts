// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./IDelegation.sol";
import "./VestedDelegation.sol";
import "./../Staking/StateSyncer.sol";
import "./../Staking/LiquidStaking.sol";
import "./../Staking/BalanceState.sol";
import "./../Withdrawal/Withdrawal.sol";
import "./../../ValidatorSetBase.sol";
import "./../../../common/CommonStructs.sol";

abstract contract Delegation is
    IDelegation,
    ValidatorSetBase,
    BalanceState,
    VestedDelegation,
    Withdrawal,
    LiquidStaking,
    StateSyncer
{
    // _______________ Initializer _______________

    function __Delegation_init() internal onlyInitializing {
        __VestFactory_init();
    }

    // _______________ External functions _______________

    /**
     * @inheritdoc IDelegation
     */
    function delegate(address validator) public payable {
        if (msg.value == 0) revert DelegateRequirement({src: "delegate", msg: "DELEGATING_AMOUNT_ZERO"});

        _processDelegate(validator, msg.sender, msg.value);
    }

    /**
     * @inheritdoc IDelegation
     */
    function undelegate(address validator, uint256 amount) external {
        _processUndelegate(validator, msg.sender, amount);
    }

    /**
     * @inheritdoc IDelegation
     */
    function openVestedDelegatePosition(address validator, uint256 durationWeeks) external payable onlyManager {
        _delegateToVal(validator, msg.sender, msg.value);
        rewardPool.onNewDelegatePosition(validator, msg.sender, durationWeeks, currentEpochId, msg.value);

        emit PositionOpened(msg.sender, validator, durationWeeks, msg.value);
    }

    /**
     * @inheritdoc IDelegation
     */
    function topUpDelegatePosition(address validator) external payable onlyManager {
        _delegateToVal(validator, msg.sender, msg.value);
        rewardPool.onTopUpDelegatePosition(validator, msg.sender, currentEpochId, msg.value);

        emit PositionTopUp(msg.sender, validator, msg.value);
    }

    /**
     * @inheritdoc IDelegation
     */
    function cutDelegatePosition(address validator, uint256 amount) external onlyManager {
        (uint256 penalty, ) = rewardPool.onCutPosition(validator, msg.sender, amount, 0);

        uint256 amountAfterPenalty = amount - penalty;

        _burnAmount(penalty);
        _registerWithdrawal(msg.sender, amountAfterPenalty);
        _postUndelegateAction(msg.sender, validator, amount);

        emit PositionCut(msg.sender, validator, amountAfterPenalty);
    }

    function _processDelegate(address validator, address delegator, uint256 amount) internal {
        _delegateToVal(validator, delegator, amount);

        rewardPool.onDelegate(validator, delegator, amount);
    }

    function _processUndelegate(address validator, address delegator, uint256 amount) internal {
        rewardPool.onUndelegate(validator, delegator, amount);

        _registerWithdrawal(delegator, amount);
        _postUndelegateAction(validator, delegator, amount);
    }

    // _______________ Private functions _______________

    function _delegateToVal(address validator, address delegator, uint256 amount) private {
        if (!validators[validator].active) revert Unauthorized("INVALID_VALIDATOR");

        _increaseValidatorBalance(validator, amount);
        _postDelegateAction(validator, delegator, amount);
    }

    function _increaseValidatorBalance(address validator, uint256 amount) private {
        _mint(validator, amount);
    }

    function _postDelegateAction(address validator, address delegator, uint256 amount) private {
        StateSyncer._syncStake(validator, amount);
        LiquidStaking._onDelegate(delegator, amount);

        emit Delegated(validator, delegator, amount);
    }

    function _postUndelegateAction(address validator, address delegator, uint256 amount) private {
        StateSyncer._syncUnstake(validator, amount);
        LiquidStaking._onUndelegate(delegator, amount);

        emit Undelegated(validator, delegator, amount);
    }

    function _burnAmount(uint256 amount) private {
        (bool success, ) = address(0).call{value: amount}("");
        require(success, "Failed to burn amount");
    }
}
