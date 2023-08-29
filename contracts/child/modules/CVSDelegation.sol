// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./CVSStorage.sol";
import "./CVSWithdrawal.sol";

import "../../interfaces/Errors.sol";
import "../../interfaces/modules/ICVSDelegation.sol";

import "../h_modules/APR.sol";
import "../h_modules/StakeSyncer.sol";
import "../h_modules/LiquidStaking.sol";

import "../../libs/ValidatorStorage.sol";
import "../../libs/ValidatorQueue.sol";
import "../../libs/RewardPool.sol";
import "../../libs/SafeMathInt.sol";

abstract contract CVSDelegation is APR, ICVSDelegation, CVSStorage, CVSWithdrawal, StakeSyncer, LiquidStaking {
    using ValidatorStorageLib for ValidatorTree;
    using ValidatorQueueLib for ValidatorQueue;
    using RewardPoolLib for RewardPool;
    using SafeMathUint for uint256;

    /**
     * @inheritdoc ICVSDelegation
     */
    function delegate(address validator, bool restake) external payable {
        RewardPool storage delegation = _validators.getDelegationPool(validator);
        if (delegation.balanceOf(msg.sender) + msg.value < minDelegation)
            revert StakeRequirement({src: "delegate", msg: "DELEGATION_TOO_LOW"});

        claimDelegatorReward(validator, restake);
        _delegate(msg.sender, validator, msg.value);
    }

    /**
     * @inheritdoc ICVSDelegation
     */
    function undelegate(address validator, uint256 amount) external {
        RewardPool storage delegation = _validators.getDelegationPool(validator);
        uint256 delegatedAmount = delegation.balanceOf(msg.sender);

        if (amount > delegatedAmount) revert StakeRequirement({src: "undelegate", msg: "INSUFFICIENT_BALANCE"});
        delegation.withdraw(msg.sender, amount);

        uint256 amountAfterUndelegate = delegatedAmount - amount;
        if (amountAfterUndelegate < minDelegation && amountAfterUndelegate != 0)
            revert StakeRequirement({src: "undelegate", msg: "DELEGATION_TOO_LOW"});

        claimDelegatorReward(validator, false);

        int256 amountInt = amount.toInt256Safe();
        _queue.insert(validator, 0, amountInt * -1);
        _syncUnstake(validator, amount);
        LiquidStaking._onUndelegate(msg.sender, amount);

        _registerWithdrawal(msg.sender, amount);
        emit Undelegated(msg.sender, validator, amount);
    }

    /**
     * @inheritdoc ICVSDelegation
     * @notice  Don't execute in case reward after _applyCustomReward() is 0
     * because pool.claimRewards() will delete the accumulated reward but you will not receive anything
     */
    function claimDelegatorReward(address validator, bool restake) public {
        RewardPool storage pool = _validators.getDelegationPool(validator);
        uint256 reward = pool.claimRewards(msg.sender);
        reward = _applyCustomReward(reward);
        if (reward == 0) return;

        if (restake) {
            _delegate(msg.sender, validator, reward);
        } else {
            _registerWithdrawal(msg.sender, reward);
        }

        emit DelegatorRewardClaimed(msg.sender, validator, restake, reward);
    }

    /**
     * @inheritdoc ICVSDelegation
     */
    function totalDelegationOf(address validator) external view returns (uint256) {
        return _validators.getDelegationPool(validator).supply;
    }

    /**
     * @inheritdoc ICVSDelegation
     */
    function delegationOf(address validator, address delegator) external view returns (uint256) {
        return _validators.getDelegationPool(validator).balanceOf(delegator);
    }

    /**
     * @inheritdoc ICVSDelegation
     */
    function getDelegatorReward(address validator, address delegator) external view virtual returns (uint256) {
        uint256 reward = _validators.getDelegationPool(validator).claimableRewards(delegator);
        return _applyCustomReward(reward);
    }

    function _delegate(address delegator, address validator, uint256 amount) internal {
        if (!_validators.get(validator).active) revert Unauthorized("INVALID_VALIDATOR");
        // TODO: queued delegation is not handled on commitEpoch because the delegated balance
        // is directly taken from the delegation pool. This means that new delegation is immediately applied
        // while new stake is applied at the end of an epoch
        // Fix it.
        _queue.insert(validator, 0, amount.toInt256Safe());
        _validators.getDelegationPool(validator).deposit(delegator, amount);
        _syncStake(validator, amount);
        LiquidStaking._onDelegate(delegator, amount);
        emit Delegated(delegator, validator, amount);
    }

    function _distributeDelegatorReward(address validator, uint256 reward) internal {
        _validators.getDelegationPool(validator).distributeReward(reward);
        emit DelegatorRewardDistributed(validator, reward);
    }
}
