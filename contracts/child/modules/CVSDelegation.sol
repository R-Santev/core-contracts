// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "../../interfaces/modules/ICVSDelegation.sol";
import "./CVSStorage.sol";
import "./CVSWithdrawal.sol";
import "../../interfaces/Errors.sol";

import "../h_modules/APR.sol";

import "../../libs/ValidatorStorage.sol";
import "../../libs/ValidatorQueue.sol";
import "../../libs/RewardPool.sol";
import "../../libs/SafeMathInt.sol";

abstract contract CVSDelegation is ICVSDelegation, CVSStorage, CVSWithdrawal, APR {
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

    // function topUp(address validator) external payable {
    //     if (!isPosition()) {
    //         revert StakeRequirement({src: "topUp", msg: "NOT_POSITION"});
    //     }

    //     RewardPool storage delegation = _validators.getDelegationPool(validator);
    //     if (delegation.balanceOf(msg.sender) + msg.value < minDelegation)
    //         revert StakeRequirement({src: "topUp", msg: "DELEGATION_TOO_LOW"});

    //     claimDelegatorReward(validator, false);
    //     _delegate(msg.sender, validator, msg.value);
    // }

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

        _registerWithdrawal(msg.sender, amount);
        emit Undelegated(msg.sender, validator, amount);
    }

    // function undelegate(address validator, uint256 amount, uint256 epochNumber, uint256 topUpIndex) external {
    //     if (!isPosition()) {
    //         revert StakeRequirement({src: "delegate", msg: "NOT_POSITION"});
    //     }

    //     RewardPool storage delegation = _validators.getDelegationPool(validator);
    //     uint256 delegatedAmount = delegation.balanceOf(msg.sender);

    //     if (amount > delegatedAmount) revert StakeRequirement({src: "undelegate", msg: "INSUFFICIENT_BALANCE"});
    //     delegation.withdraw(msg.sender, amount);

    //     uint256 amountAfterUndelegate = delegatedAmount - amount;

    //     if (amountAfterUndelegate < minDelegation && amountAfterUndelegate != 0)
    //         revert StakeRequirement({src: "undelegate", msg: "DELEGATION_TOO_LOW"});

    //     claimDelegatorReward(validator, false, epochNumber, topUpIndex);

    //     amount = _onUndelegate(validator, delegation, amount, amountAfterUndelegate);

    //     int256 amountInt = amount.toInt256Safe();

    //     _queue.insert(validator, 0, amountInt * -1);

    //     _registerWithdrawal(msg.sender, amount);
    //     emit Undelegated(msg.sender, validator, amount);
    // }

    /**
     * @inheritdoc ICVSDelegation
     */
    function claimDelegatorReward(address validator, bool restake) public {
        RewardPool storage pool = _validators.getDelegationPool(validator);
        uint256 reward = pool.claimRewards(msg.sender);
        if (reward == 0) return;

        reward = _applyCustomReward(reward);

        if (restake) {
            _delegate(msg.sender, validator, reward);
        } else {
            _registerWithdrawal(msg.sender, reward);
        }

        emit DelegatorRewardClaimed(msg.sender, validator, restake, reward);
    }

    // function claimDelegatorReward(address validator, bool restake, uint256 epochNumber, uint256 topUpIndex) public {
    //     if (!isPosition()) {
    //         revert Unauthorized("NOT_POSITION");
    //     }

    //     (uint256 epochRPS, TopUpData memory topUp) = poolStateParams(validator, epochNumber, topUpIndex);

    //     RewardPool storage pool = _validators.getDelegationPool(validator);
    //     uint256 reward = pool.claimRewards(msg.sender, epochRPS, topUp.balance, topUp.correction);

    //     if (reward == 0) return;

    //     reward = _applyCustomAPR(validator, reward);

    //     if (restake) {
    //         _delegate(msg.sender, validator, reward);
    //     } else {
    //         _registerWithdrawal(msg.sender, reward);
    //     }

    //     // TODO: Emit event when sender is not a position only
    //     emit DelegatorRewardClaimed(msg.sender, validator, restake, reward);
    // }

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
    function getDelegatorReward(address validator, address delegator) external view returns (uint256) {
        return _validators.getDelegationPool(validator).claimableRewards(delegator);
    }

    function _delegate(address delegator, address validator, uint256 amount) internal {
        if (!_validators.get(validator).active) revert Unauthorized("INVALID_VALIDATOR");
        _queue.insert(validator, 0, amount.toInt256Safe());
        _validators.getDelegationPool(validator).deposit(delegator, amount);
        emit Delegated(delegator, validator, amount);
    }

    function _distributeDelegatorReward(address validator, uint256 reward) internal {
        _validators.getDelegationPool(validator).distributeReward(reward);
        emit DelegatorRewardDistributed(validator, reward);
    }
}
