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
    mapping(uint256 => uint256) public paidRewardPerEpoch;

    function initialize(IValidatorSet newValidatorSet, address newRewardWallet) external initializer onlySystemCall {
        require(newRewardWallet != address(0) && address(newValidatorSet) != address(0), "ZERO_ADDRESS");
        validatorSet = newValidatorSet;
        rewardWallet = newRewardWallet;
    }

    /**
     * @inheritdoc IRewardPool
     */
    function distributeRewardsFor(
        uint256 epochId,
        Epoch calldata epoch,
        Uptime[] calldata uptime,
        uint256 epochSize
    ) external onlySystemCall {
        require(paidRewardPerEpoch[epochId] == 0, "REWARD_ALREADY_DISTRIBUTED");
        uint256 totalBlocks = validatorSet.totalBlocks(epochId);
        require(totalBlocks != 0, "EPOCH_NOT_COMMITTED");

        uint256 totalSupply = validatorSet.totalSupplyAt(epochId);
        uint256 reward = _calcReward(epoch, totalSupply, epochSize);

        uint256 length = uptime.length;
        uint256 totalReward = 0;
        for (uint256 i = 0; i < length; ++i) {
            totalReward += _distributeReward(epochId, uptime[i], reward, totalSupply, totalBlocks);
        }

        paidRewardPerEpoch[epochId] = totalReward;
    }

    function claimValidatorReward() external {
        if (isStakerInVestingCycle(msg.sender)) {
            return;
        }

        uint256 reward = _calcValidatorReward(msg.sender);
        if (reward == 0) {
            return;
        }

        _claimValidatorReward(msg.sender, reward);
        validatorSet.onRewardClaimed(msg.sender, reward);

        emit ValidatorRewardClaimed(msg.sender, reward);
    }

    /**
     * @inheritdoc IRewardPool
     */
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

    function onNewDelegationPosition(
        address validator,
        address delegator,
        uint256 durationWeeks,
        DelegationPoolParams params
    ) external {
        VestingPosition memory position = delegationPositions[validator][delegator];
        if (position.isMaturing()) {
            revert StakeRequirement({src: "vesting", msg: "POSITION_MATURING"});
        }

        if (position.isActive()) {
            revert StakeRequirement({src: "vesting", msg: "POSITION_ACTIVE"});
        }

        // If is a position which is not active and not in maturing state,
        // we can recreate/create the position
        uint256 duration = durationWeeks * 1 weeks;
        delete delegationPoolParamsHistory[validator][msg.sender];
        delete beforeTopUpParams[validator][msg.sender];
        delegationPositions[validator][msg.sender] = VestingPosition({
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

    function _onAccountParamsChange(address validator, uint256 balance, int256 correction) internal {
        if (isBalanceChangeMade(validator)) {
            // Top up can be made only once on epoch
            revert StakeRequirement({src: "vesting", msg: "TOPUP_ALREADY_MADE"});
        }

        poolParamsChanges[validator][msg.sender].push(
            AccountPoolParams({balance: balance, correction: correction, epochNum: currentEpochId})
        );
    }

    // TODO: Check if the commitEpoch is the last transaction in the epoch, otherwise bug may occur
    /**
     * @notice Checks if balance change was already made in the current epoch
     * @param validator Validator to delegate to
     */
    function isBalanceChangeMade(address validator) public view returns (bool) {
        uint256 length = delegationPoolParamsHistory[validator][msg.sender].length;
        if (length == 0) {
            return false;
        }

        DelegationPoolParams memory data = delegationPoolParamsHistory[validator][msg.sender][length - 1];
        if (data.epochNum == currentEpochId) {
            return true;
        }

        return false;
    }

    /**
     * @inheritdoc IRewardPool
     */
    function onStake(address staker, uint256 oldBalance) external {
        VestingPosition memory position = positions[staker];
        if (position.isActive()) {
            // stakeOf still shows the old balance because the new amount will be applied on commitEpoch
            _handleStake(staker, oldBalance);
        }
    }

    /**
     * @inheritdoc IRewardPool
     */
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

    /**
     * Calculates the epoch reward the following way:
     * apply the reward factor; participation factor is applied then
     * (base + vesting and RSI are applied on claimReward (handled by the position proxy) for delegators
     * and on _distributeValidatorReward for validators)
     * @param epoch Epoch for which the reward is distributed
     * @param activeStake Total active stake for the epoch
     * @param epochSize Number of blocks in the epoch
     */
    function _calcReward(Epoch calldata epoch, uint256 activeStake, uint256 epochSize) private pure returns (uint256) {
        uint256 modifiedEpochReward = applyMacro(activeStake);
        uint256 blocksNum = epoch.endBlock - epoch.startBlock;
        uint256 nominator = modifiedEpochReward * blocksNum * 100;
        uint256 denominator = epochSize * 100;

        return nominator / denominator;
    }

    function _distributeReward(
        uint256 epochId,
        Uptime calldata uptime,
        uint256 fullReward,
        uint256 totalSupply,
        uint256 totalBlocks
    ) private returns (uint256 reward) {
        require(uptime.signedBlocks <= totalBlocks, "SIGNED_BLOCKS_EXCEEDS_TOTAL");

        uint256 balance = validatorSet.balanceOfAt(uptime.validator, epochId);
        IDelegationPool delegationPool = IDelegationPool(validatorSet.getDelegationPoolOf(uptime.validator));
        uint256 delegation = delegationPool.delegationAt(epochId);

        // slither-disable-next-line divide-before-multiply
        uint256 validatorReward = (fullReward * (balance + delegation) * uptime.signedBlocks) /
            (totalSupply * totalBlocks);
        (uint256 validatorShares, uint256 delegatorShares) = _calculateValidatorAndDelegatorShares(
            validatorReward,
            balance,
            delegation
        );

        _distributeValidatorReward(uptime.validator, validatorShares);
        _distributeDelegatorReward(delegationPool, uptime.validator, delegatorShares);

        // Keep history record of the rewardPerShare to be used on reward claim
        uint256 magnifiedRewardPerShare = delegationPool.magnifiedRewardPerShare();
        if (delegatorShares > 0) {
            _saveEpochRPS(uptime.validator, magnifiedRewardPerShare, epochId);
        }

        // Keep history record of the validator rewards to be used on maturing vesting reward claim
        if (validatorShares > 0) {
            _saveValRewardData(uptime.validator, epochId);
        }

        return validatorReward;
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

    function _distributeValidatorReward(address validator, uint256 reward) private {
        VestingPosition memory position = positions[validator];
        if (position.isActive()) {
            reward = _applyCustomReward(position, reward, true);
        } else {
            reward = _applyCustomReward(reward);
        }

        valRewards[validator].total += reward;

        emit ValidatorRewardDistributed(validator, reward);
    }

    function _distributeDelegatorReward(IDelegationPool delegationPool, address validator, uint256 reward) private {
        delegationPool.distributeReward(reward);
        emit DelegatorRewardDistributed(validator, reward);
    }

    function _saveValRewardData(address validator, uint256 epoch) internal {
        ValRewardHistory memory rewardData = ValRewardHistory({
            totalReward: valRewards[validator].total,
            epoch: epoch,
            timestamp: block.timestamp
        });

        valRewardHistory[validator].push(rewardData);
    }

    function claimValidatorReward(uint256 rewardHistoryIndex) public {
        if (!isMaturingPosition(msg.sender)) {
            revert StakeRequirement({src: "vesting", msg: "NOT_MATURING"});
        }

        uint256 reward = _calcValidatorReward(msg.sender, rewardHistoryIndex);
        if (reward == 0) return;

        _claimValidatorReward(msg.sender, reward);
        validatorSet.onRewardClaimed(msg.sender, reward);

        emit ValidatorRewardClaimed(msg.sender, reward);
    }

    function _claimValidatorReward(address validator, uint256 reward) internal {
        valRewards[validator].taken += reward;
    }

    function _calcValidatorReward(address validator) internal view returns (uint256) {
        return valRewards[validator].total - valRewards[validator].taken;
    }

    function getValidatorReward(address validator) external view returns (uint256) {
        return valRewards[validator].total - valRewards[validator].taken;
    }

    /**
     * @dev Ensure the function is executed for maturing positions only
     */
    function _calcValidatorReward(address validator, uint256 rewardHistoryIndex) internal view returns (uint256) {
        VestingPosition memory position = positions[msg.sender];
        uint256 maturedPeriod = block.timestamp - position.end;
        uint256 alreadyMatured = position.start + maturedPeriod;
        ValRewardHistory memory rewardData = valRewardHistory[msg.sender][rewardHistoryIndex];
        // If the given data is for still not matured period - it is wrong, so revert
        if (rewardData.timestamp > alreadyMatured) {
            revert StakeRequirement({src: "stakerVesting", msg: "WRONG_DATA"});
        }

        if (rewardData.totalReward > valRewards[validator].taken) {
            return rewardData.totalReward - valRewards[validator].taken;
        }

        return 0;
    }

    // function claimValidatorReward() public override {
    //     if (isStakerInVestingCycle(msg.sender)) {
    //         return;
    //     }

    //     super.claimValidatorReward();
    // }
}
