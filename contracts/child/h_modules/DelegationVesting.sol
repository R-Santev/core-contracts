// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./Vesting.sol";
import "./VestFactory.sol";

import "../../interfaces/Errors.sol";
import "../../interfaces/h_modules/IDelegationVesting.sol";

import "./../modules/CVSStorage.sol";
import "./../modules/CVSDelegation.sol";

import "../../libs/RewardPool.sol";

// TODO: About the contract size 36000 bytes
// Move VestFactory to a separate contract
// Extract logic that can be handled by the Vest Managers from the Vesting contract
// Decrease functions
// Optimize logic to less code
// Use custom Errors without args to reduce strings size

// TODO: Refactor the logic to be more readable

abstract contract DelegationVesting is IDelegationVesting, Vesting, VestFactory {
    using ValidatorStorageLib for ValidatorTree;
    using ValidatorQueueLib for ValidatorQueue;
    using RewardPoolLib for RewardPool;
    using SafeMathUint for uint256;

    // Reward Per Share
    struct RPS {
        uint192 value;
        uint64 timestamp;
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

    // validator => position => vesting user data
    mapping(address => mapping(address => VestData)) public vestings;

    // validator => user => top-up data
    mapping(address => mapping(address => AccountPoolParams[])) public poolParamsChanges;

    // vesting manager => owner
    mapping(address => address) public vestManagers;

    // Additional mapping to store all vesting managers per user address for fast off-chain lookup
    mapping(address => address[]) public userVestManagers;

    // validator delegation pool => epochNumber => RPS
    mapping(address => mapping(uint256 => RPS)) public historyRPS;

    // keep the account parameters before the top-up, so we can separately calculate the rewards made before the a top-up is made
    // This is because we need to apply the RSI bonus to the rewards made before the top-up
    mapping(address => mapping(address => RewardParams)) public beforeTopUpParams;

    function _openPosition(address validator, RewardPool storage delegation, uint256 durationWeeks) internal {
        VestData memory position = vestings[validator][msg.sender];
        if (isMaturingPosition(position)) {
            revert StakeRequirement({src: "vesting", msg: "POSITION_MATURING"});
        }

        if (isActivePosition(vestings[validator][msg.sender])) {
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
        if (isActivePosition(vestings[validator][msg.sender])) {
            VestData memory position = vestings[validator][msg.sender];
            uint256 penalty = _calcSlashing(position, amount);
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

    function _topUpPosition(address validator, RewardPool storage delegation) internal {
        VestData memory position = vestings[validator][msg.sender];
        if (!isActivePosition(position)) {
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

    function _isTopUpMade(address validator, address manager) internal view returns (bool) {
        return beforeTopUpParams[validator][manager].balance != 0;
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

    function _rewardParams(
        address validator,
        address manager,
        uint256 epochNumber,
        uint256 topUpIndex
    ) internal view returns (uint256 rps, uint256 balance, int256 correction) {
        VestData memory position = vestings[validator][manager];
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
        (uint256 balanceData, int256 correctionData) = _getAccountParams(validator, manager, epochNumber, topUpIndex);

        return (rewardPerShare, balanceData, correctionData);
    }

    function _saveEpochRPS(address validator, uint256 rewardPerShare, uint256 epochNumber) internal {
        require(rewardPerShare > 0, "rewardPerShare must be greater than 0");

        RPS memory validatorRPSes = historyRPS[validator][epochNumber];
        require(validatorRPSes.value == 0, "RPS already saved");

        historyRPS[validator][epochNumber] = RPS({value: uint192(rewardPerShare), timestamp: uint64(block.timestamp)});
    }

    function isVestManager(address delegator) public view returns (bool) {
        return vestManagers[delegator] != address(0);
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

    function storeVestManagerData(address vestManager, address owner) internal {
        vestManagers[vestManager] = owner;
        userVestManagers[owner].push(vestManager);
    }

    function _getAccountParams(
        address validator,
        address manager,
        uint256 epochNumber,
        uint256 paramsIndex
    ) internal view returns (uint256 balance, int256 correction) {
        if (paramsIndex >= poolParamsChanges[validator][manager].length) {
            revert StakeRequirement({src: "vesting", msg: "INVALID_TOP_UP_INDEX"});
        }

        AccountPoolParams memory params = poolParamsChanges[validator][manager][paramsIndex];
        if (params.epochNum > epochNumber) {
            revert StakeRequirement({src: "vesting", msg: "LATER_TOP_UP"});
        } else if (params.epochNum == epochNumber) {
            // If balance change is made exactly in the epoch with the given index - it is the valid one for sure
            // because the balance change is made exactly before the distribution of the reward in this epoch
        } else {
            // This is the case where the balance change is  before the handled epoch (epochNumber)
            if (paramsIndex == poolParamsChanges[validator][manager].length - 1) {
                // If it is the last balance change - don't check does the next one can be better
            } else {
                // If it is not the last balance change - check does the next one can be better
                // We just need the right account specific pool params for the given RPS, to be able
                // to properly calculate the reward
                AccountPoolParams memory nextParamsRecord = poolParamsChanges[validator][manager][paramsIndex + 1];
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

    function getUserVestManagers(address user) external view returns (address[] memory) {
        return userVestManagers[user];
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

    function _saveFirstTopUp(address validator, RewardPool storage delegation, uint256 balance) internal {
        int256 correction = delegation.magnifiedRewardCorrections[msg.sender];
        uint256 rewardPerShare = delegation.magnifiedRewardPerShare;
        beforeTopUpParams[validator][msg.sender] = RewardParams({
            rewardPerShare: rewardPerShare,
            balance: balance,
            correction: correction
        });
    }
}
