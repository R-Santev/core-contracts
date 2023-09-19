// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./IRewardPool.sol";
import "./modules/APR.sol";
import "./modules/VestingData.sol";
import "./../common/System/System.sol";
import "./libs/VestingLib.sol";
import "./../ValidatorSet/IValidatorSet.sol";
import "./../DelegationPool/IDelegationPool.sol";

contract RewardPoolContract is IRewardPool, System, APR, VestingData, Initializable {
    using VestingPositionLib for VestingPosition;

    uint256 constant DELEGATORS_COMMISSION = 10;

    address public rewardWallet;
    IValidatorSet public validatorSet;
    mapping(address => ValReward) public valRewards;
    mapping(address => uint256) public pendingRewards;
    mapping(uint256 => uint256) public paidRewardPerEpoch;

    function initialize(IValidatorSet newValidatorSet, address newRewardWallet) external initializer onlySystemCall {
        require(newRewardWallet != address(0) && address(newValidatorSet) != address(0), "ZERO_ADDRESS");
        validatorSet = newValidatorSet;
        rewardWallet = newRewardWallet;
    }

    function distributeRewardsFor(
        uint256 epochId,
        Epoch calldata epoch,
        Uptime calldata uptime,
        uint256 epochSize
    ) external onlySystemCall {
        require(paidRewardPerEpoch[epochId] == 0, "REWARD_ALREADY_DISTRIBUTED");
        uint256 totalBlocks = validatorSet.totalBlocks(epochId);
        require(totalBlocks != 0, "EPOCH_NOT_COMMITTED");

        // H_MODIFY: Ensure the max reward tokens are sent
        uint256 activeStake = validatorSet.totalSupplyAt(epochId);

        uint256 length = uptime.uptimeData.length;

        // Hydra modification: Check is removed because validators that are already not part of the validator set
        // can receive reward for the last epoch they were part of the validator set
        // require(length <= ACTIVE_VALIDATOR_SET_SIZE && length <= _validators.count, "INVALID_LENGTH");

        // Epoch reward calculation:
        // apply the reward factor; participation factor is applied then
        // base + vesting and RSI are applied on claimReward (handled by the position proxy) for delegators
        // and on _distributeValidatorReward for validators
        uint256 reward = calcReward(epoch, activeStake, epochSize);

        for (uint256 i = 0; i < length; ++i) {
            UptimeData memory uptimeData = uptime.uptimeData[i];
            uint256 stake = validatorSet.balanceOfAt(uptimeData.validator, epochId);

            IDelegationPool delegationPool = IDelegationPool(validatorSet.getDelegationPoolOf(uptimeData.validator));
            uint256 delegation = delegationPool.delegationAt(epochId);

            // slither-disable-next-line divide-before-multiply
            uint256 validatorReward = (reward * (stake + delegation) * uptimeData.signedBlocks) /
                (activeStake * uptime.totalBlocks);
            (uint256 validatorShares, uint256 delegatorShares) = _calculateValidatorAndDelegatorShares(
                validatorReward,
                stake,
                delegation
            );

            // _distributeValidatorReward(uptimeData.validator, validatorShares);
            // _distributeDelegatorReward(delegationPool, uptimeData.validator, delegatorShares);

            // // H_MODIFY: Keep history record of the rewardPerShare to be used on reward claim
            // uint256 magnifiedRewardPerShare = delegationPool.magnifiedRewardPerShare();
            // if (delegatorShares > 0) {
            //     _saveEpochRPS(uptimeData.validator, magnifiedRewardPerShare, uptime.epochId);
            // }

            // // H_MODIFY: Keep history record of the validator rewards to be used on maturing vesting reward claim
            // if (validatorShares > 0) {
            //     _saveValRewardData(uptimeData.validator, uptime.epochId);
            // }
        }
    }

    // function claimValidatorReward(uint256 rewardHistoryIndex) public {
    //     VestData memory position = stakePositions[msg.sender];
    //     if (!isMaturingPosition(position)) {
    //         revert StakeRequirement({src: "vesting", msg: "NOT_MATURING"});
    //     }

    //     Validator storage validator = _validators.get(msg.sender);
    //     uint256 reward = _calcValidatorReward(validator, rewardHistoryIndex);
    //     if (reward == 0) return;

    //     // _claimValidatorReward(validator, reward);
    //     _registerWithdrawal(msg.sender, reward);

    //     emit ValidatorRewardClaimed(msg.sender, reward);
    // }

    function onUnstake(
        address staker,
        uint256 amountUnstaked,
        uint256 amountLeft
    ) external returns (uint256 amountToWithdraw) {
        VestingPosition memory position = positions[staker];
        if (position.isActive()) {
            // staker lost its reward
            valRewards[staker].taken = valRewards[staker].total;
            uint256 penalty = _calcSlashing(position, amountUnstaked);
            // if position is closed when active, top-up must not be available as well as reward must not be available
            // so we delete the vesting data
            if (amountLeft == 0) {
                delete positions[staker];
            }

            return amountUnstaked - penalty;
        }

        return amountUnstaked;
    }

    function onNewPosition(address staker, uint256 durationWeeks) external {
        uint256 duration = durationWeeks * 1 weeks;
        positions[staker] = VestingPosition({
            duration: duration,
            start: block.timestamp,
            end: block.timestamp + duration,
            base: getBase(),
            vestBonus: getVestingBonus(durationWeeks),
            rsiBonus: uint248(getRSI())
        });

        delete valRewards[staker];
    }

    function _saveValRewardData(address validator, uint256 epoch) internal {
        ValRewardRecord memory rewardData = ValRewardRecord({
            totalReward: valRewards[validator].total,
            epoch: epoch,
            timestamp: block.timestamp
        });

        valRewardRecords[validator].push(rewardData);
    }

    function getAPRPositionParams() external view returns (uint256, uint256, uint256, uint256) {
        // return (APR_START, APR_PERIOD, APR_DECIMALS, APR_MAX);
    }

    function _calculateValidatorAndDelegatorShares(
        uint256 stakedBalance,
        uint256 delegatedBalance,
        uint256 totalReward
    ) private pure returns (uint256, uint256) {
        if (stakedBalance == 0) return (0, 0);
        if (delegatedBalance == 0) return (totalReward, 0);

        uint256 validatorReward = (totalReward * stakedBalance) / (stakedBalance + delegatedBalance);
        uint256 delegatorReward = totalReward - validatorReward;

        uint256 commission = (DELEGATORS_COMMISSION * delegatorReward) / 100;

        return (validatorReward + commission, delegatorReward - commission);
    }

    function _distributeValidatorReward(address validator, uint256 reward) internal {
        VestingPosition memory position = positions[validator];
        if (position.isActive()) {
            reward = _applyCustomReward(position, reward, true);
        } else {
            reward = _applyCustomReward(reward);
        }

        pendingRewards[validator] += reward;

        emit ValidatorRewardDistributed(validator, reward);
    }

    function _distributeDelegatorReward(IDelegationPool delegationPool, address validator, uint256 reward) internal {
        delegationPool.distributeReward(reward);
        emit DelegatorRewardDistributed(validator, reward);
    }

    function calcReward(Epoch calldata epoch, uint256 activeStake, uint256 epochSize) internal pure returns (uint256) {
        uint256 modifiedEpochReward = applyMacro(activeStake);
        uint256 blocksNum = epoch.endBlock - epoch.startBlock;
        uint256 nominator = modifiedEpochReward * blocksNum * 100;
        uint256 denominator = epochSize * 100;

        return nominator / denominator;
    }

    function claimValidatorReward() public virtual {
        // Validator storage validator = _validators.get(msg.sender);
        // uint256 reward = _calcValidatorReward(validator);
        // if (reward == 0) {
        //     return;
        // }
        // _claimValidatorReward(validator, reward);
        // _registerWithdrawal(msg.sender, reward);
        // emit ValidatorRewardClaimed(msg.sender, reward);
    }

    function _claimValidatorReward(Validator storage validator, uint256 reward) internal {
        // TODO: fill the logic
        // validator.takenRewards += reward;
    }

    function _calcValidatorReward(Validator memory validator) internal pure returns (uint256) {
        // return validator.totalRewards - validator.takenRewards;
    }

    function getValidatorReward(address validator) external view returns (uint256) {
        // Validator memory val = _validators.get(validator);
        // return val.totalRewards - val.takenRewards;
    }

    /**
     * @dev Ensure the function is executed for maturing positions only
     */
    // function _calcValidatorReward(
    //     Validator memory validator,
    //     uint256 rewardHistoryIndex
    // ) internal view returns (uint256) {
    //     VestData memory position = stakePositions[msg.sender];
    //     uint256 maturedPeriod = block.timestamp - position.end;
    //     uint256 alreadyMatured = position.start + maturedPeriod;
    //     ValReward memory rewardData = valRewards[msg.sender][rewardHistoryIndex];
    //     // If the given data is for still not matured period - it is wrong, so revert
    //     if (rewardData.timestamp > alreadyMatured) {
    //         revert StakeRequirement({src: "stakerVesting", msg: "WRONG_DATA"});
    //     }

    //     // if (rewardData.totalReward > validator.takenRewards) {
    //     //     return rewardData.totalReward - validator.takenRewards;
    //     // }

    //     return 0;
    // }

    //     function _distributeValidatorReward(address validator, uint256 reward) internal override {
    //     VestData memory position = stakePositions[msg.sender];
    //     uint256 maxPotentialReward = applyMaxReward(reward);
    //     if (isActivePosition(position)) {
    //         reward = _applyCustomReward(position, reward, true);
    //     } else {
    //         reward = _applyCustomReward(reward);
    //     }

    //     uint256 remainder = maxPotentialReward - reward;
    //     if (remainder > 0) {
    //         _burnAmount(remainder);
    //     }

    //     super._distributeValidatorReward(validator, reward);
    // }

    // function claimValidatorReward() public override {
    //     if (isStakerInVestingCycle(msg.sender)) {
    //         return;
    //     }

    //     super.claimValidatorReward();
    // }
}
