// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

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
    using RewardPoolLib for RewardPool;

    // RPS = Reward Per Share
    struct RPS {
        uint192 value;
        uint64 timestamp;
    }

    struct VestData {
        uint256 amount;
        uint256 period; // in weeks
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
    // check is a contract position
    mapping(address => PositionData) public positionsData;

    // validator delegation pool => epochNumber => RPS
    mapping(address => mapping(uint256 => RPS)) public historyRPS;

    modifier onlyPosition() {
        if (!isPosition()) {
            revert StakeRequirement({src: "vestDelegate", msg: "NOT_POSITION"});
        }

        _;
    }

    function createPosition(uint256 vestingWeeks) external {
        if (vestingWeeks < 1 && vestingWeeks > 52) {
            revert StakeRequirement({src: "vesting", msg: "INVALID_VESTING_PERIOD"});
        }

        address positionAddress = clone(msg.sender);
        positionsData[positionAddress] = PositionData({addr: positionAddress, period: uint96(vestingWeeks)});
    }

    function vestDelegate(address validator) external payable onlyPosition {
        RewardPool storage delegation = _validators.getDelegationPool(validator);
        if (delegation.balanceOf(msg.sender) + msg.value < minDelegation)
            revert StakeRequirement({src: "vesting", msg: "DELEGATION_TOO_LOW"});

        _delegate(msg.sender, validator, msg.value);

        // TODO: delegation value must be updated because it is a reference type - check it
        _onDelegate(validator, delegation);
    }

    function vestClaimReward(address validator, uint256 epochNumber, uint256 topUpIndex) public onlyPosition {
        VestData memory vesting = vestings[validator][msg.sender];
        uint256 vestingStart = vesting.end - (vesting.period * 1 weeks);
        // If still unused position, there is no reward
        if (vestingStart == 0) {
            return;
        }

        // if the position is still active, there is no matured reward
        if (vestingStart < block.timestamp && vesting.end > block.timestamp) {
            return;
        }

        // distribute the proper vesting reward
        uint256 reward;
        (uint256 epochRPS, uint256 balance, int256 correction) = poolStateParams(validator, epochNumber, topUpIndex);
        RewardPool storage pool = _validators.getDelegationPool(validator);
        reward = pool.claimRewards(msg.sender, epochRPS, balance, correction);
        reward = _applyCustomReward(validator, reward);

        // If the full maturing period is finished, withdraw also the reward made after the vesting period
        if (block.timestamp > vesting.end + vesting.period * 1 weeks) {
            uint256 additionalReward = pool.claimRewards(msg.sender);
            additionalReward += _applyCustomReward(additionalReward);

            reward += additionalReward;
        }

        if (reward == 0) return;

        _registerWithdrawal(msg.sender, reward);

        emit DelegatorRewardClaimed(msg.sender, validator, false, reward);
    }

    function _onDelegate(address validator, RewardPool storage delegation) internal {
        if (isMaturingPosition(validator)) {
            revert StakeRequirement({src: "vesting", msg: "REWARD_NOT_TAKEN"});
        }

        uint256 balance = delegation.balanceOf(msg.sender);

        if (isActivePosition(validator)) {
            if (isTopUpMade(validator)) {
                // Top up can be made only once on epoch
                revert StakeRequirement({src: "vesting", msg: "TOPUP_ALREADY_MADE"});
            }

            // add topUp data and modify end period of position, decrease RSI bonus
            int256 correction = delegation.correctionOf(msg.sender);
            _topUp(validator, balance - msg.value, balance, correction);

            return;
        }

        // If is a position which is not active and not in maturing state,
        // then all rewards are taken if there are any and we can recreate/create the position

        // But first call claimReward to get all the reward from the last iteration
        // set zero rpoch number and topUp index because they would not be used in this case
        vestClaimReward(validator, 0, 0);

        vestings[validator][msg.sender] = VestData({
            amount: balance,
            period: positionsData[msg.sender].period,
            end: block.timestamp + (positionsData[msg.sender].period * 1 weeks),
            base: getBase(),
            vestBonus: getVestingBonus(positionsData[msg.sender].period),
            rsiBonus: uint248(getRSI())
        });
    }

    function _onUndelegate(
        address validator,
        RewardPool storage delegation,
        uint256 amount,
        uint256 leftAmount
    ) internal returns (uint256) {
        if (isActivePosition(validator)) {
            amount = _applySlashing(validator, amount);
            // burn reward
            uint256 reward = delegation.claimRewards(msg.sender);
            _burnAmount(reward + amount);
        }

        if (leftAmount == 0) {
            delete vestings[validator][msg.sender];
        }

        // return amount after slashing
        return amount;
    }

    // function claimBonus()

    function poolStateParams(
        address validator,
        uint256 epochNumber,
        uint256 topUpIndex
    ) internal view returns (uint256 rps, uint256 balance, int256 correction) {
        VestData storage data = vestings[validator][msg.sender];
        uint256 start = data.end - data.period * 1 weeks;
        require(block.timestamp >= start, "VestPosition: not started");

        // vesting not finished
        if (data.end > block.timestamp) {
            revert NoReward();
        }

        uint256 matureEnd = data.period * 1 weeks + data.end;
        uint256 alreadyMatured;
        // If full mature period is finished
        if (matureEnd < block.timestamp) {
            // alreadyMatured is the end of the full mature period
            alreadyMatured = matureEnd;
        } else {
            // calculate alreadyMatured
            uint256 maturedPeriod = block.timestamp - data.end;
            alreadyMatured = start + maturedPeriod;
        }

        RPS memory rpsData = historyRPS[validator][epochNumber];
        // If the given RPS is for future time - it is wrong, so revert
        if (rpsData.timestamp > alreadyMatured) {
            revert StakeRequirement({src: "vesting", msg: "WRONG_RPS"});
        }

        (uint256 balanceData, int256 correctionData) = handleTopUp(validator, epochNumber, topUpIndex);

        return (rpsData.value, balanceData, correctionData);

        // CVSDelegation(staking).claimDelegatorReward(validator, false, epochRPS, topUp.balance, topUp.correction);
        // uint256 reward = address(this).balance - currentBalance;
        // require(reward > 0, "VestPosition: no reward");

        // uint256 bonusReward = Vesting(staking).claimBonus(validator);
        // uint256 amount = reward + bonusReward;

        // emit Claimed(msg.sender, amount);

        // (bool success, ) = msg.sender.call{value: amount}("");
        // require(success, "VestPosition: claim failed");
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

    function isPosition() public view returns (bool) {
        return positionsData[msg.sender].addr != address(0);
    }

    function isActivePosition(address validator) public view returns (bool) {
        VestData memory position = vestings[validator][msg.sender];
        return position.end >= block.timestamp && position.end - position.period * 1 weeks <= block.timestamp;
    }

    function isMaturingPosition(address validator) public view returns (bool) {
        uint256 vestingEnd = vestings[validator][msg.sender].end;
        uint256 matureEnd = vestings[validator][msg.sender].end + vestings[validator][msg.sender].period * 1 weeks;
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

    function _topUp(address validator, uint256 oldBalance, uint256 balance, int256 correction) internal {
        topUpPerVal[validator][msg.sender].push(
            TopUpData({balance: balance, correction: correction, epochNum: currentEpochId})
        );

        // balance / old balance = increase coefficient
        // apply increase coefficient to the vesting period to find the increase in the period
        // TODO: Optimize gas costs
        uint256 timeIncrease = (balance * vestings[validator][msg.sender].period) / oldBalance;
        vestings[validator][msg.sender].end = vestings[validator][msg.sender].end + timeIncrease;
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

    function _applySlashing(address validator, uint256 amount) internal returns (uint256) {
        VestData memory data = vestings[validator][msg.sender];

        // Calculate what part of the delegated balance to be slashed
        uint256 leftPeriod = data.end - block.timestamp;
        uint256 fullPeriod = data.period * 1 weeks;
        uint256 slash = (amount * leftPeriod) / fullPeriod;

        _burnAmount(slash);

        return amount - slash;
    }

    function _burnAmount(uint256 amount) internal {
        payable(address(0)).transfer(amount);
    }

    function _applyCustomAPR(address validator, uint256 amount) internal view returns (uint256) {}

    function _applyCustomReward(address validator, uint256 reward) internal view returns (uint256) {
        VestData memory data = vestings[validator][msg.sender];

        // TODO: check if it's correct
        uint256 bonus = data.base + (data.vestBonus * data.rsiBonus);
        return (reward * bonus) / (10000 * 10000 * 10000);
    }
}
