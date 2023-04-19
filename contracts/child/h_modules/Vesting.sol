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

    // RPS = Reward Per Share
    struct RPS {
        uint192 value;
        uint64 timestamp;
    }

    struct VestData {
        uint256 amount;
        uint256 duration; // in weeks
        uint256 start;
        uint256 end;
        uint256 base;
        uint256 vestBonus;
        uint256 rsiBonus;
    }

    struct TopUpData {
        uint256 balance;
        int256 correction;
        uint256 epochNum;
    }

    struct PositionData {
        address addr;
        uint96 period;
    }

    // validator => user => top-up data
    mapping(address => mapping(address => TopUpData[])) public topUpPerVal;
    // validator => position => vesting user data
    mapping(address => mapping(address => VestData)) public vestings;
    // vesting manager => owner
    mapping(address => address) public vestManagers;

    // validator delegation pool => epochNumber => RPS
    mapping(address => mapping(uint256 => RPS)) public historyRPS;

    modifier onlyManager() {
        if (!isVestManager(msg.sender)) {
            revert StakeRequirement({src: "vestDelegate", msg: "NOT_MANAGER"});
        }

        _;
    }

    function newManager() external {
        require(msg.sender != address(0), "INVALID_OWNER");

        address managerAddr = _clone(msg.sender);
        vestManagers[managerAddr] = msg.sender;
    }

    function openPosition(address validator, uint256 duration) external payable onlyManager {
        RewardPool storage delegation = _validators.getDelegationPool(validator);
        if (delegation.balanceOf(msg.sender) + msg.value < minDelegation)
            revert StakeRequirement({src: "vesting", msg: "DELEGATION_TOO_LOW"});

        _delegate(msg.sender, validator, msg.value);

        // TODO: delegation value must be updated because it is a reference type - check it
        _openPosition(validator, delegation, duration);
    }

    function topUpPosition(address validator) external payable onlyManager {
        RewardPool storage delegation = _validators.getDelegationPool(validator);

        if (delegation.balanceOf(msg.sender) + msg.value < minDelegation)
            revert StakeRequirement({src: "vesting", msg: "DELEGATION_TOO_LOW"});

        _delegate(msg.sender, validator, msg.value);

        _topUpPosition(validator, delegation);
    }

    function cutPosition(address validator, uint256 amount) external onlyManager {
        RewardPool storage delegation = _validators.getDelegationPool(validator);
        uint256 delegatedAmount = delegation.balanceOf(msg.sender);

        if (amount > delegatedAmount) revert StakeRequirement({src: "vesting", msg: "INSUFFICIENT_BALANCE"});
        delegation.withdraw(msg.sender, amount);

        uint256 amountAfterUndelegate = delegatedAmount - amount;
        if (amountAfterUndelegate < minDelegation && amountAfterUndelegate != 0)
            revert StakeRequirement({src: "vesting", msg: "DELEGATION_TOO_LOW"});

        amount = _cutPosition(validator, delegation, amount);

        int256 amountInt = amount.toInt256Safe();

        _queue.insert(validator, 0, amountInt * -1);

        _registerWithdrawal(msg.sender, amount);
        emit Undelegated(msg.sender, validator, amount);
    }

    function claimPositionReward(address validator, uint256 epochNumber, uint256 topUpIndex) public onlyManager {
        VestData memory vesting = vestings[validator][msg.sender];
        uint256 vestingEnd = vesting.start + (vesting.duration * 1 weeks);
        // If still unused position, there is no reward
        if (vesting.start == 0) {
            return;
        }

        // if the position is still active, there is no matured reward
        if (isActivePosition(validator, msg.sender)) {
            return;
        }

        // distribute the proper vesting reward
        uint256 reward;
        (uint256 epochRPS, uint256 balance, int256 correction) = poolStateParams(validator, epochNumber, topUpIndex);
        RewardPool storage pool = _validators.getDelegationPool(validator);
        reward = pool.claimRewards(msg.sender, epochRPS, balance, correction);
        reward = _applyCustomReward(validator, reward);

        // If the full maturing period is finished, withdraw also the reward made after the vesting period
        if (block.timestamp > vestingEnd + vesting.duration * 1 weeks) {
            uint256 additionalReward = pool.claimRewards(msg.sender);
            additionalReward += _applyCustomReward(additionalReward);

            reward += additionalReward;
        }

        if (reward == 0) return;

        _registerWithdrawal(msg.sender, reward);

        emit DelegatorRewardClaimed(msg.sender, validator, false, reward);
    }

    function _topUpPosition(address validator, RewardPool storage delegation) internal {
        if (isMaturingPosition(validator)) {
            revert StakeRequirement({src: "vesting", msg: "POSITION_MATURING"});
        }

        if (!isActivePosition(validator, msg.sender)) {
            revert StakeRequirement({src: "vesting", msg: "POSITION_NOT_ACTIVE"});
        }

        if (isTopUpMade(validator)) {
            // Top up can be made only once on epoch
            revert StakeRequirement({src: "vesting", msg: "TOPUP_ALREADY_MADE"});
        }

        uint256 balance = delegation.balanceOf(msg.sender);

        // add topUp data and modify end period of position, decrease RSI bonus
        int256 correction = delegation.correctionOf(msg.sender);

        topUpPerVal[validator][msg.sender].push(
            TopUpData({balance: balance, correction: correction, epochNum: currentEpochId})
        );

        // balance / old balance = increase coefficient
        // apply increase coefficient to the vesting period to find the increase in the period
        // TODO: Optimize gas costs
        uint256 timeIncrease = (balance * vestings[validator][msg.sender].duration) / balance - msg.value;
        vestings[validator][msg.sender].end = vestings[validator][msg.sender].end + timeIncrease;
    }

    function _openPosition(address validator, RewardPool storage delegation, uint256 duration) internal {
        if (isMaturingPosition(validator)) {
            revert StakeRequirement({src: "vesting", msg: "POSITION_MATURING"});
        }

        if (isActivePosition(validator, msg.sender)) {
            revert StakeRequirement({src: "vesting", msg: "POSITION_ACTIVE"});
        }

        // If is a position which is not active and not in maturing state,
        // then all rewards are taken if there are any and we can recreate/create the position

        // But first call claimReward to get all the reward from the last iteration
        // set zero epoch number and topUp index because they would not be used in this case
        claimPositionReward(validator, 0, 0);

        vestings[validator][msg.sender] = VestData({
            amount: delegation.balanceOf(msg.sender) + msg.value,
            duration: duration,
            start: block.timestamp,
            end: block.timestamp + duration * 1 weeks,
            base: getBase(),
            vestBonus: getVestingBonus(duration),
            rsiBonus: uint248(getRSI())
        });
    }

    function _cutPosition(address validator, RewardPool storage delegation, uint256 amount) internal returns (uint256) {
        if (isActivePosition(validator, msg.sender)) {
            uint256 penalty = _calcSlashing(validator, amount);
            // apply the max Vesting bonus, because the full reward must be burned
            uint256 fullReward = applyMaxReward(delegation.claimRewards(msg.sender));
            _burnAmount(penalty + fullReward);

            amount -= penalty;
        }

        return amount;
    }

    function poolStateParams(
        address validator,
        uint256 epochNumber,
        uint256 topUpIndex
    ) internal view returns (uint256 rps, uint256 balance, int256 correction) {
        VestData memory position = vestings[validator][msg.sender];
        require(block.timestamp >= position.start, "VestPosition: not started");

        // vesting not finished
        if (position.end > block.timestamp) {
            revert NoReward();
        }

        uint256 matureEnd = position.duration * 1 weeks + position.end;
        uint256 rewardPerShare;
        // If full mature period is finished
        if (matureEnd < block.timestamp) {
            // rewardPerShare is the actual one
            RewardPool storage pool = _validators.getDelegationPool(validator);
            rewardPerShare = pool.magnifiedRewardPerShare;
        } else {
            // rewardPerShare must be fetched from the history records
            uint256 maturedPeriod = block.timestamp - position.end;
            uint256 alreadyMatured = position.start + maturedPeriod;

            RPS memory rpsData = historyRPS[validator][epochNumber];
            // If the given RPS is for future time - it is wrong, so revert
            if (rpsData.timestamp > alreadyMatured) {
                revert StakeRequirement({src: "vesting", msg: "WRONG_RPS"});
            }

            rewardPerShare = rpsData.value;
        }

        (uint256 balanceData, int256 correctionData) = handleTopUp(validator, epochNumber, topUpIndex);

        return (rewardPerShare, balanceData, correctionData);
    }

    function _saveEpochRPS(address validator, uint256 rewardPerShare, uint256 epochNumber) internal {
        require(rewardPerShare > 0, "rewardPerShare must be greater than 0");

        RPS memory validatorRPSes = historyRPS[validator][epochNumber];
        require(validatorRPSes.value == 0, "RPS already saved");

        historyRPS[validator][epochNumber] = RPS({value: uint192(rewardPerShare), timestamp: uint64(block.timestamp)});

        // Immediately save the first RPS
        // if (validatorRPSes.length < 1) {
        //     weeklyRPSes[validator].push(
        //         WeeklyRPS({value: uint192(rewardPerShare), timestamp: uint64(block.timestamp)})
        //     );
        //     return;
        // }

        // // Add new RPS if one week have been passed from the last RPS
        // // TODO: Use safecast for the casting
        // if (lastRPS.timestamp + 1 weeks <= block.timestamp) {
        //     weeklyRPSes[validator].push(
        //         WeeklyRPS({value: uint192(rewardPerShare), timestamp: uint64(block.timestamp)})
        //     );
        // }
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
        uint256 vestingEnd = vestings[validator][msg.sender].start + vestings[validator][msg.sender].duration * 1 weeks;
        uint256 matureEnd = vestingEnd + vestings[validator][msg.sender].duration * 1 weeks;
        return vestingEnd < block.timestamp && block.timestamp < matureEnd;
    }

    // TODO: Check if the commitEpoch is the last transaction in the epoch, otherwise bug may occur
    /**
     * @notice Checks if a top up was already made in the current epoch
     * @param validator Validator to delegate to
     */
    function isTopUpMade(address validator) public view returns (bool) {
        uint256 length = topUpPerVal[validator][msg.sender].length;
        if (length == 0) {
            return false;
        }

        TopUpData memory data = topUpPerVal[validator][msg.sender][length - 1];
        if (data.epochNum == currentEpochId) {
            return true;
        }

        return false;
    }

    function handleTopUp(
        address validator,
        uint256 epochNumber,
        uint256 topUpIndex
    ) internal view returns (uint256 balance, int256 correction) {
        if (topUpPerVal[validator][msg.sender].length == 0) {
            RewardPool storage pool = _validators.getDelegationPool(validator);

            return (pool.balanceOf(msg.sender), pool.correctionOf(msg.sender));
        }

        if (topUpIndex >= topUpPerVal[validator][msg.sender].length) {
            revert();
        }

        TopUpData memory topUp = topUpPerVal[validator][msg.sender][topUpIndex];

        if (topUp.epochNum > epochNumber) {
            revert();
        } else if (topUp.epochNum == epochNumber) {
            // If topUp is made exactly in the before epoch - it is the valid one for sure
        } else {
            // This is the case where the topUp is made more than 1 epoch before the handled one (epochNumber)
            if (topUpIndex == topUpPerVal[validator][msg.sender].length - 1) {
                // If it is the last topUp - don't check does the next one can be better
            } else {
                // If it is not the last topUp - check does the next one can be better
                TopUpData memory nextTopUp = topUpPerVal[validator][msg.sender][topUpIndex + 1];
                if (nextTopUp.epochNum < epochNumber) {
                    // If the next topUp is made in an epoch before the handled one
                    // and is bigger than the provided top - the provided one is not valid
                    revert();
                }
            }
        }

        return (topUp.balance, topUp.correction);
    }

    function _calcSlashing(address validator, uint256 amount) internal view returns (uint256) {
        VestData memory data = vestings[validator][msg.sender];

        // Calculate what part of the delegated balance to be slashed
        uint256 leftPeriod = data.end - block.timestamp;
        uint256 fullPeriod = data.duration * 1 weeks;
        uint256 slash = (amount * leftPeriod) / fullPeriod;

        return slash;
    }

    function _burnAmount(uint256 amount) internal {
        payable(address(0)).transfer(amount);
    }

    function _applyCustomAPR(address validator, uint256 amount) internal view returns (uint256) {}

    function _applyCustomReward(address validator, uint256 reward) internal view returns (uint256) {
        VestData memory data = vestings[validator][msg.sender];

        // TODO: check if it's correct
        uint256 bonus = (data.base + data.vestBonus) * data.rsiBonus;

        return (reward * bonus) / (10000 * 10000);
    }

    function getPositionReward(address validator, address delegator) external view returns (uint256) {
        if (isVestManager(delegator)) {
            console.log("hereeeeeeeeeeeeeee");
            return _applyCustomReward(validator, _validators.getDelegationPool(validator).claimableRewards(delegator));
        }

        return 0;
    }
}
