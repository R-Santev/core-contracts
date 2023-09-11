// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./../child/System.sol";
import "./../child/h_modules/APR.sol";
import "./modules/VestingData.sol";

import "./libs/VestingLib.sol";

import "./../interfaces/modules/ICVSStorage.sol";
import "./interfaces/IStakeManager.sol";
import "./interfaces/IValidatorSet.sol";

contract RewardPoolContract is Initializable, System, APR, VestingData {
    using VestingLib for VestData;

    uint256 constant DELEGATORS_COMMISSION = 10;

    IStakeManager public stakeManager;
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
    ) external onlySystemCall {
        // H_MODIFY: Ensure the max reward tokens are sent
        uint256 activeStake = stakeManager.totalActiveStake();
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
            uint256 stake = validatorSet.balanceOf(uptimeData.validator);
            uint256 delegation = validatorSet.delegationOf(uptimeData.validator);

            // slither-disable-next-line divide-before-multiply
            uint256 validatorReward = (reward * (stake + delegation) * uptimeData.signedBlocks) /
                (activeStake * uptime.totalBlocks);
            (uint256 validatorShares, uint256 delegatorShares) = _calculateValidatorAndDelegatorShares(
                uptimeData.validator,
                validatorReward
            );

            _distributeValidatorReward(uptimeData.validator, validatorShares);
            _distributeDelegatorReward(uptimeData.validator, delegatorShares);

            // H_MODIFY: Keep history record of the rewardPerShare to be used on reward claim
            uint256 magnifiedRewardPerShare = stakeManager
                .getDelegationPool(uptimeData.validator)
                .magnifiedRewardPerShare;
            if (delegatorShares > 0) {
                _saveEpochRPS(uptimeData.validator, magnifiedRewardPerShare, uptime.epochId);
            }

            // H_MODIFY: Keep history record of the validator rewards to be used on maturing vesting reward claim
            if (validatorShares > 0) {
                _saveValRewardData(uptimeData.validator, uptime.epochId);
            }
        }
    }

    function _calculateValidatorAndDelegatorShares(
        address validatorAddr,
        uint256 stakedBalance,
        uint256 delegatedBalance,
        uint256 totalReward
    ) private view returns (uint256, uint256) {
        if (stakedBalance == 0) return (0, 0);
        if (delegatedBalance == 0) return (totalReward, 0);

        uint256 validatorReward = (totalReward * stakedBalance) / (stakedBalance + delegatedBalance);
        uint256 delegatorReward = totalReward - validatorReward;

        uint256 commission = (DELEGATORS_COMMISSION * delegatorReward) / 100;

        return (validatorReward + commission, delegatorReward - commission);
    }

    function _distributeValidatorReward(address validator, uint256 reward) internal {
        VestData memory position = stakeManager.stakePositions(validator);
        if (position.isActive()) {
            reward = _applyCustomReward(position, reward, true);
        } else {
            reward = _applyCustomReward(reward);
        }

        pendingRewards[validator] += reward;

        emit ValidatorRewardDistributed(validator, reward);
    }

    function _distributeDelegatorReward(address validator, uint256 reward) internal {
        stakeManager.getDelegationPool(validator).distributeReward(reward);
        emit DelegatorRewardDistributed(validator, reward);
    }

    function calcReward(Epoch calldata epoch, uint256 activeStake, uint256 epochSize) internal view returns (uint256) {
        uint256 modifiedEpochReward = applyMacro(activeStake);
        uint256 blocksNum = epoch.endBlock - epoch.startBlock;
        uint256 nominator = modifiedEpochReward * blocksNum * 100;
        uint256 denominator = epochSize * 100;

        return nominator / denominator;
    }
}
