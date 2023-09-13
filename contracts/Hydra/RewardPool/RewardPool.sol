// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./../common/CVSSystem/CVSSystem.sol";
import "./modules/VestingData.sol";
import "./modules/APR.sol";

import "./libs/VestingLib.sol";

import "./../ValidatorSet/IValidatorSet.sol";
import "./../DelegationPool/IDelegationPool.sol";

contract RewardPoolContract is Initializable, CVSSystem, APR, VestingData {
    using VestingLib for VestData;

    uint256 constant DELEGATORS_COMMISSION = 10;

    IValidatorSet public validatorSet;

    mapping(address => uint256) public pendingRewards;

    event ValidatorRewardDistributed(address indexed validator, uint256 amount);
    event DelegatorRewardDistributed(address indexed validator, uint256 amount);

    function initialize(address newStakeManager) external initializer onlySystemCall {}

    function distributeRewardsFor(
        uint256 epochId,
        Epoch calldata epoch,
        Uptime calldata uptime,
        uint256 epochSize
    ) external payable onlySystemCall {
        // H_MODIFY: Ensure the max reward tokens are sent
        uint256 activeStake = validatorSet.totalSupplyAt(epochId);
        // Ensure proper reward amount is sent
        require(msg.value == getEpochMaxReward(activeStake), "INVALID_REWARD_AMOUNT");
        uint256 totalBlocks = uptime.totalBlocks;
        require(totalBlocks != 0, "EPOCH_NOT_COMMITTED");

        uint256 length = uptime.uptimeData.length;

        // Hydra modification: Check is removed because validators that are already not part of the validator set
        // can receive reward for the last epoch they were part of the validator set
        // require(length <= ACTIVE_VALIDATOR_SET_SIZE && length <= _validators.count, "INVALID_LENGTH");

        // H_MODIFY: change the epoch reward calculation
        // apply the reward factor; participation factor is applied then
        // base + vesting and RSI are applied on claimReward (handled by the position proxy) for delegators
        // and on _distributeValidatorReward for validators
        // TODO: Reward must be calculated per epoch; apply the changes whenever APR oracles are available
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
        VestData memory position = validatorSet.stakePositionOf(validator);
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
