// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

// TODO: About the contract size 36000 bytes
// Move VestFactory to a separate contract
// Extract logic that can be handled by the Vest Managers from the Vesting contract
// Decrease functions
// Optimize logic to less code
// Use custom Errors without args to reduce strings size

import "./Vesting.sol";
import "./VestFactory.sol";
import "./DelegationVesting.sol";

import "../../interfaces/Errors.sol";

import "./../modules/CVSStorage.sol";
import "./../modules/CVSDelegation.sol";

import "../../libs/RewardPool.sol";

abstract contract ExtendedDelegation is DelegationVesting, CVSDelegation {
    using ValidatorStorageLib for ValidatorTree;
    using ValidatorQueueLib for ValidatorQueue;
    using RewardPoolLib for RewardPool;
    using SafeMathUint for uint256;

    modifier onlyManager() {
        if (!isVestManager(msg.sender)) {
            revert StakeRequirement({src: "vesting", msg: "NOT_MANAGER"});
        }

        _;
    }

    function newManager() external {
        require(msg.sender != address(0), "INVALID_OWNER");

        address managerAddr = _clone(msg.sender);
        storeVestManagerData(managerAddr, msg.sender);
    }

    function openDelegatorPosition(address validator, uint256 durationWeeks) external payable onlyManager {
        RewardPool storage delegation = _validators.getDelegationPool(validator);
        if (delegation.balanceOf(msg.sender) + msg.value < minDelegation)
            revert StakeRequirement({src: "vesting", msg: "DELEGATION_TOO_LOW"});

        _delegate(msg.sender, validator, msg.value);
        _openPosition(validator, delegation, durationWeeks);

        emit PositionOpened(msg.sender, validator, durationWeeks, msg.value);
    }

    function topUpPosition(address validator) external payable override onlyManager {
        RewardPool storage delegation = _validators.getDelegationPool(validator);
        uint256 balance = delegation.balanceOf(msg.sender);
        if (balance + msg.value < minDelegation) revert StakeRequirement({src: "vesting", msg: "DELEGATION_TOO_LOW"});

        if (!_isTopUpMade(validator, msg.sender)) {
            _saveFirstTopUp(validator, delegation, balance);
        }

        _delegate(msg.sender, validator, msg.value);
        _topUpPosition(validator, delegation);

        emit PositionTopUp(msg.sender, validator, poolParamsChanges[validator][msg.sender].length - 1, msg.value);
    }

    function cutPosition(address validator, uint256 amount) external onlyManager {
        RewardPool storage delegation = _validators.getDelegationPool(validator);
        uint256 delegatedAmount = delegation.balanceOf(msg.sender);

        if (amount > delegatedAmount) revert StakeRequirement({src: "vesting", msg: "INSUFFICIENT_BALANCE"});
        delegation.withdraw(msg.sender, amount);

        uint256 amountAfterUndelegate = delegatedAmount - amount;
        if (amountAfterUndelegate < minDelegation && amountAfterUndelegate != 0)
            revert StakeRequirement({src: "vesting", msg: "DELEGATION_TOO_LOW"});

        int256 amountInt = amount.toInt256Safe();
        _queue.insert(validator, 0, amountInt * -1);
        // emit here so the amount is correct value (before the cut)
        _syncStake(validator);
        LiquidStaking._onUndelegate(msg.sender, amount);

        amount = _cutPosition(validator, delegation, amount, amountAfterUndelegate);
        _registerWithdrawal(msg.sender, amount);

        emit PositionCut(msg.sender, validator, amount);
    }

    function claimPositionReward(
        address validator,
        uint256 epochNumber,
        uint256 topUpIndex
    ) public override onlyManager {
        VestData memory vesting = vestings[validator][msg.sender];
        if (noRewardConditions(vesting)) {
            return;
        }

        uint256 sumReward;
        uint256 sumMaxReward;
        RewardPool storage pool = _validators.getDelegationPool(validator);
        bool rsi = true;
        if (_isTopUpMade(validator, msg.sender)) {
            rsi = false;
            RewardParams memory params = beforeTopUpParams[validator][msg.sender];
            uint256 rsiReward = pool.claimRewards(msg.sender, params.rewardPerShare, params.balance, params.correction);
            uint256 maxRsiReward = applyMaxReward(rsiReward);
            sumReward += _applyCustomReward(vesting, rsiReward, true);
            sumMaxReward += maxRsiReward;
        }

        // distribute the proper vesting reward
        (uint256 epochRPS, uint256 balance, int256 correction) = _rewardParams(
            validator,
            msg.sender,
            epochNumber,
            topUpIndex
        );
        uint256 reward = pool.claimRewards(msg.sender, epochRPS, balance, correction);
        uint256 maxReward = applyMaxReward(reward);
        reward = _applyCustomReward(vesting, reward, rsi);
        sumReward += reward;
        sumMaxReward += maxReward;

        // If the full maturing period is finished, withdraw also the reward made after the vesting period
        if (block.timestamp > vesting.end + vesting.duration) {
            uint256 additionalReward = pool.claimRewards(msg.sender);
            uint256 maxAdditionalReward = applyMaxReward(additionalReward);
            additionalReward = _applyCustomReward(additionalReward);
            sumReward += additionalReward;
            sumMaxReward += maxAdditionalReward;
        }

        uint256 remainder = sumMaxReward - sumReward;
        if (remainder > 0) {
            _burnAmount(remainder);
        }

        if (sumReward == 0) return;

        _registerWithdrawal(msg.sender, sumReward);

        emit PositionRewardClaimed(msg.sender, validator, sumReward);
    }

    function getDelegatorPositionReward(
        address validator,
        address delegator,
        uint256 epochNumber,
        uint256 topUpIndex
    ) external view returns (uint256) {
        VestData memory vesting = vestings[validator][delegator];
        if (noRewardConditions(vesting)) {
            return 0;
        }

        uint256 sumReward;
        RewardPool storage pool = _validators.getDelegationPool(validator);
        bool rsi = true;
        if (_isTopUpMade(validator, delegator)) {
            rsi = false;
            RewardParams memory params = beforeTopUpParams[validator][delegator];
            uint256 rsiReward = pool.claimableRewards(
                delegator,
                params.rewardPerShare,
                params.balance,
                params.correction
            );
            sumReward += _applyCustomReward(vesting, rsiReward, true);
        }

        (uint256 epochRPS, uint256 balance, int256 correction) = _rewardParams(
            validator,
            delegator,
            epochNumber,
            topUpIndex
        );
        uint256 reward = pool.claimableRewards(msg.sender, epochRPS, balance, correction) - sumReward;
        reward = _applyCustomReward(vesting, reward, rsi);
        sumReward += reward;

        // If the full maturing period is finished, withdraw also the reward made after the vesting period
        if (block.timestamp > vesting.end + vesting.duration) {
            uint256 additionalReward = pool.claimableRewards(msg.sender) - sumReward;
            additionalReward = _applyCustomReward(additionalReward);
            sumReward += additionalReward;
        }

        return sumReward;
    }

    function noRewardConditions(VestData memory vesting) private view returns (bool) {
        // If still unused position, there is no reward
        if (vesting.start == 0) {
            return true;
        }

        // if the position is still active, there is no matured reward
        if (isActivePosition(vesting)) {
            return true;
        }

        return false;
    }
}
