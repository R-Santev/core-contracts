// SPDX-License-Identifier: MIT

// TODO: About the contract size 36000 bytes
// Move VestFactory to a separate contract
// Extract logic that can be handled by the Vest Managers from the Vesting contract
// Decrease functions
// Optimize logic to less code
// Use custom Errors without args to reduce strings size

pragma solidity 0.8.17;

import "hardhat/console.sol";

import "./../modules/CVSStorage.sol";
import "./../modules/CVSDelegation.sol";

import "./../h_modules/APR.sol";
import "./../h_modules/VestFactory.sol";

import "../../interfaces/Errors.sol";
import "../../interfaces/h_modules/IVesting.sol";

import "../../libs/RewardPool.sol";

error NoReward();

abstract contract Vesting is IVesting, CVSStorage, APR, CVSDelegation, VestFactory {
    using ValidatorStorageLib for ValidatorTree;
    using ValidatorQueueLib for ValidatorQueue;
    using RewardPoolLib for RewardPool;
    using SafeMathUint for uint256;

    // Reward Per Share
    struct RPS {
        uint192 value;
        uint64 timestamp;
    }

    struct VestData {
        uint256 duration;
        uint256 start;
        uint256 end;
        uint256 base;
        uint256 vestBonus;
        uint256 rsiBonus;
    }

    struct AccountPoolParams {
        uint256 balance;
        int256 correction;
        uint256 epochNum;
    }

    struct PositionData {
        address addr;
        uint96 period;
    }

    struct RewardParams {
        uint256 rewardPerShare;
        uint256 balance;
        int256 correction;
    }

    // validator => user => top-up data
    mapping(address => mapping(address => AccountPoolParams[])) public poolParamsChanges;
    // validator => position => vesting user data
    mapping(address => mapping(address => VestData)) public vestings;
    // vesting manager => owner
    mapping(address => address) public vestManagers;

    // validator delegation pool => epochNumber => RPS
    mapping(address => mapping(uint256 => RPS)) public historyRPS;

    mapping(address => mapping(address => RewardParams)) public beforeTopUpParams;

    modifier onlyManager() {
        if (!isVestManager(msg.sender)) {
            revert StakeRequirement({src: "vesting", msg: "NOT_MANAGER"});
        }

        _;
    }

    function newManager() external {
        require(msg.sender != address(0), "INVALID_OWNER");

        address managerAddr = _clone(msg.sender);
        vestManagers[managerAddr] = msg.sender;
    }

    function openPosition(address validator, uint256 durationWeeks) external payable onlyManager {
        RewardPool storage delegation = _validators.getDelegationPool(validator);
        if (delegation.balanceOf(msg.sender) + msg.value < minDelegation)
            revert StakeRequirement({src: "vesting", msg: "DELEGATION_TOO_LOW"});

        _delegate(msg.sender, validator, msg.value);

        _openPosition(validator, delegation, durationWeeks);

        emit PositionOpened(msg.sender, validator, durationWeeks, msg.value);
    }

    function topUpPosition(address validator) external payable onlyManager {
        RewardPool storage delegation = _validators.getDelegationPool(validator);
        uint256 balance = delegation.balanceOf(msg.sender);
        if (balance + msg.value < minDelegation) revert StakeRequirement({src: "vesting", msg: "DELEGATION_TOO_LOW"});

        if (!_isTopUpMade(validator, msg.sender)) {
            int256 correction = delegation.magnifiedRewardCorrections[msg.sender];
            uint256 rewardPerShare = delegation.magnifiedRewardPerShare;

            beforeTopUpParams[validator][msg.sender] = RewardParams({
                rewardPerShare: rewardPerShare,
                balance: balance,
                correction: correction
            });
        }

        _delegate(msg.sender, validator, msg.value);

        _topUpPosition(validator, delegation);

        emit PositionTopUp(msg.sender, validator, poolParamsChanges[validator][msg.sender].length - 1, msg.value);
    }

    function _isTopUpMade(address validator, address manager) internal view returns (bool) {
        return beforeTopUpParams[validator][manager].balance != 0;
    }

    function cutPosition(address validator, uint256 amount) external onlyManager {
        RewardPool storage delegation = _validators.getDelegationPool(validator);
        uint256 delegatedAmount = delegation.balanceOf(msg.sender);

        if (amount > delegatedAmount) revert StakeRequirement({src: "vesting", msg: "INSUFFICIENT_BALANCE"});
        delegation.withdraw(msg.sender, amount);

        uint256 amountAfterUndelegate = delegatedAmount - amount;
        if (amountAfterUndelegate < minDelegation && amountAfterUndelegate != 0)
            revert StakeRequirement({src: "vesting", msg: "DELEGATION_TOO_LOW"});

        amount = _cutPosition(validator, delegation, amount, amountAfterUndelegate);

        int256 amountInt = amount.toInt256Safe();

        _queue.insert(validator, 0, amountInt * -1);

        _registerWithdrawal(msg.sender, amount);

        emit PositionCut(msg.sender, validator, amount);
    }

    function claimPositionReward(address validator, uint256 epochNumber, uint256 topUpIndex) public onlyManager {
        VestData memory vesting = vestings[validator][msg.sender];
        // If still unused position, there is no reward
        if (vesting.start == 0) {
            return;
        }

        // if the position is still active, there is no matured reward
        if (isActivePosition(validator, msg.sender)) {
            return;
        }

        uint256 sumReward;
        uint256 sumMaxReward;
        RewardPool storage pool = _validators.getDelegationPool(validator);
        bool rsi = true;
        if (_isTopUpMade(validator, msg.sender)) {
            rsi = false;
            RewardParams memory params = beforeTopUpParams[validator][msg.sender];
            console.log("FIRST CLAIM");
            uint256 rsiReward = pool.claimRewards(msg.sender, params.rewardPerShare, params.balance, params.correction);
            uint256 maxRsiReward = applyMaxReward(rsiReward);
            sumReward += _applyCustomReward(validator, msg.sender, rsiReward, true);
            sumMaxReward += maxRsiReward;
        }

        // distribute the proper vesting reward
        (uint256 epochRPS, uint256 balance, int256 correction) = _rewardParams(validator, epochNumber, topUpIndex);
        console.log("SECOND CLAIM");
        uint256 reward = pool.claimRewards(msg.sender, epochRPS, balance, correction);
        uint256 maxReward = applyMaxReward(reward);
        reward = _applyCustomReward(validator, msg.sender, reward, rsi);
        sumReward += reward;
        sumMaxReward += maxReward;

        // If the full maturing period is finished, withdraw also the reward made after the vesting period
        if (block.timestamp > vesting.end + vesting.duration) {
            console.log("THIRD CLAIM");
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

    function _topUpPosition(address validator, RewardPool storage delegation) internal {
        if (!isActivePosition(validator, msg.sender)) {
            revert StakeRequirement({src: "vesting", msg: "POSITION_NOT_ACTIVE"});
        }

        if (poolParamsChanges[validator][msg.sender].length > 52) {
            revert StakeRequirement({src: "vesting", msg: "TOO_MANY_TOP_UPS"});
        }

        // keep the change in the account pool params
        uint256 balance = delegation.balanceOf(msg.sender);
        int256 correction = delegation.correctionOf(msg.sender);
        _onAccountParamsChange(validator, balance, correction);

        // Modify end period of position, decrease RSI bonus
        // balance / old balance = increase coefficient
        // apply increase coefficient to the vesting period to find the increase in the period
        // TODO: Optimize gas costs
        uint256 timeIncrease;

        uint256 oldBalance = balance - msg.value;
        uint256 duration = vestings[validator][msg.sender].duration;
        if (msg.value >= oldBalance) {
            timeIncrease = duration;
        } else {
            timeIncrease = (msg.value * duration) / oldBalance;
        }

        vestings[validator][msg.sender].duration = duration + timeIncrease;
        vestings[validator][msg.sender].end = vestings[validator][msg.sender].end + timeIncrease;
    }

    function _onAccountParamsChange(address validator, uint256 balance, int256 correction) internal {
        if (isBalanceChangeMade(validator)) {
            // Top up can be made only once on epoch
            revert StakeRequirement({src: "vesting", msg: "TOPUP_ALREADY_MADE"});
        }

        poolParamsChanges[validator][msg.sender].push(
            AccountPoolParams({balance: balance, correction: correction, epochNum: currentEpochId})
        );
    }

    function _openPosition(address validator, RewardPool storage delegation, uint256 durationWeeks) internal {
        if (isMaturingPosition(validator)) {
            revert StakeRequirement({src: "vesting", msg: "POSITION_MATURING"});
        }

        if (isActivePosition(validator, msg.sender)) {
            revert StakeRequirement({src: "vesting", msg: "POSITION_ACTIVE"});
        }

        // ensure previous rewards are claimed
        if (delegation.claimableRewards(msg.sender) > 0) {
            revert StakeRequirement({src: "vesting", msg: "REWARDS_NOT_CLAIMED"});
        }

        // If is a position which is not active and not in maturing state,
        // we can recreate/create the position

        uint256 duration = durationWeeks * 1 weeks;

        delete poolParamsChanges[validator][msg.sender];
        delete beforeTopUpParams[validator][msg.sender];

        vestings[validator][msg.sender] = VestData({
            duration: duration,
            start: block.timestamp,
            end: block.timestamp + duration,
            base: getBase(),
            vestBonus: getVestingBonus(durationWeeks),
            rsiBonus: uint248(getRSI())
        });

        // keep the change in the account pool params
        uint256 balance = delegation.balanceOf(msg.sender);
        int256 correction = delegation.correctionOf(msg.sender);
        _onAccountParamsChange(validator, balance, correction);
    }

    function _cutPosition(
        address validator,
        RewardPool storage delegation,
        uint256 amount,
        uint256 delegatedAmount
    ) internal returns (uint256) {
        if (isActivePosition(validator, msg.sender)) {
            uint256 penalty = _calcSlashing(validator, amount);
            // apply the max Vesting bonus, because the full reward must be burned
            uint256 fullReward = applyMaxReward(delegation.claimRewards(msg.sender));
            _burnAmount(penalty + fullReward);

            amount -= penalty;

            // if position is closed when active, top-up must not be available as well as reward must not be available
            // so we delete the vesting data
            if (delegatedAmount == 0) {
                delete vestings[validator][msg.sender];
                delete poolParamsChanges[validator][msg.sender];
            } else {
                // keep the change in the account pool params
                uint256 balance = delegation.balanceOf(msg.sender);
                int256 correction = delegation.correctionOf(msg.sender);
                _onAccountParamsChange(validator, balance, correction);
            }
        }

        return amount;
    }

    function _rewardParams(
        address validator,
        uint256 epochNumber,
        uint256 topUpIndex
    ) internal view returns (uint256 rps, uint256 balance, int256 correction) {
        VestData memory position = vestings[validator][msg.sender];
        uint256 matureEnd = position.end + position.duration;
        uint256 alreadyMatured;
        // If full mature period is finished, the full reward up to the end of the vesting must be matured
        if (matureEnd < block.timestamp) {
            alreadyMatured = position.end;
        } else {
            // rewardPerShare must be fetched from the history records
            uint256 maturedPeriod = block.timestamp - position.end;
            alreadyMatured = position.start + maturedPeriod;
        }

        RPS memory rpsData = historyRPS[validator][epochNumber];
        if (rpsData.timestamp == 0) {
            revert StakeRequirement({src: "vesting", msg: "INVALID_EPOCH"});
        }
        // If the given RPS is for future time - it is wrong, so revert
        if (rpsData.timestamp > alreadyMatured) {
            revert StakeRequirement({src: "vesting", msg: "WRONG_RPS"});
        }

        uint256 rewardPerShare = rpsData.value;
        (uint256 balanceData, int256 correctionData) = _getAccountParams(validator, epochNumber, topUpIndex);

        return (rewardPerShare, balanceData, correctionData);
    }

    function _saveEpochRPS(address validator, uint256 rewardPerShare, uint256 epochNumber) internal {
        require(rewardPerShare > 0, "rewardPerShare must be greater than 0");

        RPS memory validatorRPSes = historyRPS[validator][epochNumber];
        require(validatorRPSes.value == 0, "RPS already saved");

        historyRPS[validator][epochNumber] = RPS({value: uint192(rewardPerShare), timestamp: uint64(block.timestamp)});
    }

    // TODO: Handle stakers rewards

    function isVestManager(address delegator) public view returns (bool) {
        return vestManagers[delegator] != address(0);
    }

    function isActivePosition(address validator, address delegator) public view returns (bool) {
        return
            vestings[validator][delegator].start < block.timestamp &&
            block.timestamp < vestings[validator][delegator].end;
    }

    function isMaturingPosition(address validator) public view returns (bool) {
        uint256 vestingEnd = vestings[validator][msg.sender].end;
        uint256 matureEnd = vestingEnd + vestings[validator][msg.sender].duration;
        return vestingEnd < block.timestamp && block.timestamp < matureEnd;
    }

    // TODO: Check if the commitEpoch is the last transaction in the epoch, otherwise bug may occur
    /**
     * @notice Checks if balance change was already made in the current epoch
     * @param validator Validator to delegate to
     */
    function isBalanceChangeMade(address validator) public view returns (bool) {
        uint256 length = poolParamsChanges[validator][msg.sender].length;
        if (length == 0) {
            return false;
        }

        AccountPoolParams memory data = poolParamsChanges[validator][msg.sender][length - 1];
        if (data.epochNum == currentEpochId) {
            return true;
        }

        return false;
    }

    function _getAccountParams(
        address validator,
        uint256 epochNumber,
        uint256 paramsIndex
    ) internal view returns (uint256 balance, int256 correction) {
        if (paramsIndex >= poolParamsChanges[validator][msg.sender].length) {
            revert StakeRequirement({src: "vesting", msg: "INVALID_TOP_UP_INDEX"});
        }

        AccountPoolParams memory params = poolParamsChanges[validator][msg.sender][paramsIndex];
        if (params.epochNum > epochNumber) {
            revert StakeRequirement({src: "vesting", msg: "LATER_TOP_UP"});
        } else if (params.epochNum == epochNumber) {
            // If balance change is made exactly in the epoch with the given index - it is the valid one for sure
            // because the balance change is made exactly before the distribution of the reward in this epoch
        } else {
            // This is the case where the balance change is  before the handled epoch (epochNumber)
            if (paramsIndex == poolParamsChanges[validator][msg.sender].length - 1) {
                // If it is the last balance change - don't check does the next one can be better
            } else {
                // If it is not the last balance change - check does the next one can be better
                // We just need the right account specific pool params for the given RPS, to be able
                // to properly calculate the reward
                AccountPoolParams memory nextParamsRecord = poolParamsChanges[validator][msg.sender][paramsIndex + 1];
                if (nextParamsRecord.epochNum <= epochNumber) {
                    // If the next balance change is made in an epoch before the handled one or in the same epoch
                    // and is bigger than the provided balance change - the provided one is not valid.
                    // Because when the reward was distributed for the given epoch, the account balance was different
                    revert StakeRequirement({src: "vesting", msg: "EARLIER_TOP_UP"});
                }
            }
        }

        return (params.balance, params.correction);
    }

    /** @param amount Amount of tokens to be slashed
     * @dev Invoke only when position is active, otherwise - underflow
     */
    function _calcSlashing(address validator, uint256 amount) internal view returns (uint256) {
        VestData memory data = vestings[validator][msg.sender];

        // Calculate what part of the delegated balance to be slashed
        uint256 leftPeriod = data.end - block.timestamp;
        uint256 fullPeriod = data.duration;
        uint256 slash = (amount * leftPeriod) / fullPeriod;

        return slash;
    }

    function _burnAmount(uint256 amount) internal {
        payable(address(0)).transfer(amount);
    }

    function _applyCustomReward(
        address validator,
        address delegator,
        uint256 reward,
        bool rsi
    ) internal view returns (uint256) {
        VestData memory data = vestings[validator][delegator];
        uint256 bonus = (data.base + data.vestBonus);
        uint256 divider = 10000;
        if (rsi) {
            bonus = bonus * data.rsiBonus;
            divider *= 10000;
        }

        return (reward * bonus) / divider;
    }

    function getPositionReward(address validator, address delegator) external view returns (uint256) {
        if (isVestManager(delegator)) {
            return
                _applyCustomReward(
                    validator,
                    delegator,
                    _validators.getDelegationPool(validator).claimableRewards(delegator),
                    true
                );
        }

        return 0;
    }

    function getRPSValues(address validator) external view returns (RPS[] memory) {
        RPS[] memory values = new RPS[](currentEpochId);
        for (uint256 i = 0; i < currentEpochId; i++) {
            if (historyRPS[validator][i].value != 0) {
                values[i] = (historyRPS[validator][i]);
            }
        }

        return values;
    }

    function getAccountParams(address validator, address manager) external view returns (AccountPoolParams[] memory) {
        return poolParamsChanges[validator][manager];
    }
}
