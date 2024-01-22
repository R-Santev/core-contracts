// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./IRewardPool.sol";
import "./modules/APR.sol";
import "./libs/VestingPositionLib.sol";
import "./modules/Vesting.sol";
import "./../common/System/System.sol";
import "./../ValidatorSet/IValidatorSet.sol";
import "./../ValidatorSet/modules/Delegation/libs/DelegationPoolLib.sol";

contract RewardPool is IRewardPool, System, APR, Vesting, Initializable {
    using VestingPositionLib for VestingPosition;
    using DelegationPoolLib for DelegationPool;

    /// @notice A constant that is used to keep the commission of the delegators
    uint256 constant DELEGATORS_COMMISSION = 10;

    /// @notice Reward Wallet
    address public rewardWallet;

    /// @notice The address of the ValidatorSet contract
    IValidatorSet public validatorSet;

    /// @notice The validator rewards mapped to a validator's address
    mapping(address => ValReward) public valRewards;

    /// @notice Mapping used to keep the paid rewards per epoch
    mapping(uint256 => uint256) public paidRewardPerEpoch;

    /// @notice Keeps the delegation pools
    mapping(address => DelegationPool) public delegationPools;

    /// @notice The minimum delegation amount to be delegated
    uint256 public minDelegation;

    // _______________ Initializer _______________

    function initialize(
        IValidatorSet newValidatorSet,
        address newRewardWallet,
        uint256 newMinDelegation
    ) external initializer onlySystemCall {
        require(newRewardWallet != address(0) && address(newValidatorSet) != address(0), "ZERO_ADDRESS");
        validatorSet = newValidatorSet;
        rewardWallet = newRewardWallet;
        minDelegation = newMinDelegation;
        __APR_init(aprManager);
    }

    // _______________ External functions _______________

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
            base: base,
            vestBonus: getVestingBonus(durationWeeks),
            rsiBonus: uint248(rsi)
        });

        delete valRewards[staker];
    }

    function onNewDelegatePosition(
        address validator,
        address delegator,
        uint256 durationWeeks,
        uint256 currentEpochId,
        uint256 newBalance
    ) external {
        VestingPosition memory position = delegationPositions[validator][delegator];
        if (position.isMaturing()) {
            revert StakeRequirement({src: "vesting", msg: "POSITION_MATURING"});
        }

        if (position.isActive()) {
            revert StakeRequirement({src: "vesting", msg: "POSITION_ACTIVE"});
        }

        // ensure previous rewards are claimed
        DelegationPool storage delegation = delegationPools[validator];
        if (delegation.claimableRewards(msg.sender) > 0) {
            revert StakeRequirement({src: "vesting", msg: "REWARDS_NOT_CLAIMED"});
        }

        // If is a position which is not active and not in maturing state,
        // we can recreate/create the position
        uint256 duration = durationWeeks * 1 weeks;
        delete delegationPoolParamsHistory[validator][delegator];
        delete beforeTopUpParams[validator][delegator];
        // TODO: calculate end of period instead of write in in the cold storage. It is cheaper
        delegationPositions[validator][delegator] = VestingPosition({
            duration: duration,
            start: block.timestamp,
            end: block.timestamp + duration,
            base: base,
            vestBonus: getVestingBonus(durationWeeks),
            rsiBonus: uint248(rsi)
        });

        // keep the change in the delegation pool params per account
        _addNewDelegationPoolParam(
            validator,
            DelegationPoolParams({
                balance: newBalance,
                correction: delegation.correctionOf(msg.sender),
                epochNum: currentEpochId
            })
        );
    }

    function _addNewDelegationPoolParam(address validator, DelegationPoolParams memory params) internal {
        if (isBalanceChangeMade(validator, params.epochNum)) {
            // Top up can be made only once per epoch
            revert StakeRequirement({src: "vesting", msg: "TOPUP_ALREADY_MADE"});
        }

        delegationPoolParamsHistory[validator][msg.sender].push(params);
    }

    function onTopUpDelegatePosition(
        address validator,
        address delegator,
        uint256 newBalance,
        uint256 currentEpochId
    ) external {
        DelegationPool storage delegation = delegationPools[validator];
        if (!_isTopUpMade(validator, msg.sender)) {
            _saveFirstTopUp(validator, delegation, newBalance);
        }

        _topUpPosition(validator, delegator, delegation, currentEpochId);
    }

    function _saveFirstTopUp(address validator, DelegationPool storage delegation, uint256 balance) internal {
        int256 correction = delegation.magnifiedRewardCorrections[msg.sender];
        uint256 rewardPerShare = delegation.magnifiedRewardPerShare;
        beforeTopUpParams[validator][msg.sender] = RewardParams({
            rewardPerShare: rewardPerShare,
            balance: balance,
            correction: correction
        });
    }

    function _topUpPosition(
        address validator,
        address delegator,
        DelegationPool storage delegation,
        uint256 currentEpochId
    ) internal {
        if (!isActiveDelegatePosition(validator, delegator)) {
            revert StakeRequirement({src: "vesting", msg: "POSITION_NOT_ACTIVE"});
        }

        if (delegationPoolParamsHistory[validator][msg.sender].length > 52) {
            revert StakeRequirement({src: "vesting", msg: "TOO_MANY_TOP_UPS"});
        }

        // keep the change in the account pool params
        uint256 balance = delegation.balanceOf(msg.sender);
        int256 correction = delegation.correctionOf(msg.sender);
        _onAccountParamsChange(validator, balance, correction, currentEpochId);

        // Modify end period of position, decrease RSI bonus
        // balance / old balance = increase coefficient
        // apply increase coefficient to the vesting period to find the increase in the period
        // TODO: Optimize gas costs
        uint256 timeIncrease;

        uint256 oldBalance = balance - msg.value;
        uint256 duration = delegationPositions[validator][msg.sender].duration;
        if (msg.value >= oldBalance) {
            timeIncrease = duration;
        } else {
            timeIncrease = (msg.value * duration) / oldBalance;
        }

        delegationPositions[validator][msg.sender].duration = duration + timeIncrease;
        delegationPositions[validator][msg.sender].end = delegationPositions[validator][msg.sender].end + timeIncrease;
    }

    function _onAccountParamsChange(
        address validator,
        uint256 balance,
        int256 correction,
        uint256 currentEpochId
    ) internal {
        if (isBalanceChangeMade(validator, currentEpochId)) {
            // Top up can be made only once on epoch
            revert StakeRequirement({src: "vesting", msg: "TOPUP_ALREADY_MADE"});
        }

        delegationPoolParamsHistory[validator][msg.sender].push(
            DelegationPoolParams({balance: balance, correction: correction, epochNum: currentEpochId})
        );
    }

    function _isTopUpMade(address validator, address manager) internal view returns (bool) {
        return beforeTopUpParams[validator][manager].balance != 0;
    }

    // TODO: Check if the commitEpoch is the last transaction in the epoch, otherwise bug may occur
    /**
     * @notice Checks if balance change was already made in the current epoch
     * @param validator Validator to delegate to
     */
    function isBalanceChangeMade(address validator, uint256 currentEpochNum) public view returns (bool) {
        uint256 length = delegationPoolParamsHistory[validator][msg.sender].length;
        if (length == 0) {
            return false;
        }

        DelegationPoolParams memory data = delegationPoolParamsHistory[validator][msg.sender][length - 1];
        if (data.epochNum == currentEpochNum) {
            return true;
        }

        return false;
    }

    /**
     * @inheritdoc IRewardPool
     */
    function onCreatePool(address validator) external {
        DelegationPool storage delegation = getDelegationPoolOf(validator);
        delegation.validator = validator;
    }

    /**
     * @inheritdoc IRewardPool
     */
    function onStake(address staker, uint256 amount, uint256 oldBalance) external {
        if (isActivePosition(staker)) {
            _handleStake(staker, amount, oldBalance);
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
            // staker lose its reward
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
     * @inheritdoc IRewardPool
     */
    function onNewStakePosition(address staker, uint256 durationWeeks) external {
        if (isStakerInVestingCycle(staker)) {
            revert StakeRequirement({src: "vesting", msg: "ALREADY_IN_VESTING"});
        }

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

    function onDelegate(address validator, address delegator, uint256 amount) external returns (uint256 reward) {
        DelegationPool storage delegation = getDelegationPoolOf(validator);

        uint256 delegatedAmount = delegation.balanceOf(delegator);
        if (delegatedAmount + amount < minDelegation)
            revert DelegateRequirement({src: "delegate", msg: "DELEGATION_TOO_LOW"});

        reward = this.claimDelegatorReward(validator, delegator);
        delegation.deposit(delegator, amount);

        return reward;
    }

    /**
     * @inheritdoc IRewardPool
     */
    function onUndelegate(address validator, address delegator, uint256 amount) external returns (uint256 reward) {
        DelegationPool storage delegation = getDelegationPoolOf(validator);

        uint256 delegatedAmount = delegation.balanceOf(delegator);
        if (amount > delegatedAmount) revert DelegateRequirement({src: "undelegate", msg: "INSUFFICIENT_BALANCE"});

        uint256 amounAfterUndelegate = delegatedAmount - amount;
        if (amounAfterUndelegate < minDelegation && amounAfterUndelegate != 0)
            revert DelegateRequirement({src: "undelegate", msg: "DELEGATION_TOO_LOW"});

        delegation.withdraw(delegator, amount);
        reward = delegation.claimRewards(delegator);
        reward = _applyCustomReward(reward);
    }

    /**
     * @inheritdoc IRewardPool
     */
    function onNewDelegatePosition(
        address validator,
        address delegator,
        uint256 durationWeeks,
        uint256 currentEpochId,
        uint256 amount
    ) external {
        DelegationPool storage delegation = getDelegationPoolOf(validator);

        uint256 balance = delegation.balanceOf(delegator);
        uint256 newBalance = balance + amount;
        if (newBalance < minDelegation) revert DelegateRequirement({src: "vesting", msg: "DELEGATION_TOO_LOW"});

        if (isMaturingDelegatePosition(validator, delegator)) {
            revert DelegateRequirement({src: "vesting", msg: "POSITION_MATURING"});
        }

        if (isActiveDelegatePosition(validator, delegator)) {
            revert DelegateRequirement({src: "vesting", msg: "POSITION_ACTIVE"});
        }

        // ensure previous rewards are claimed
        if (delegation.claimableRewards(delegator) > 0) {
            revert DelegateRequirement({src: "vesting", msg: "REWARDS_NOT_CLAIMED"});
        }

        delegation.deposit(delegator, amount);

        // If is a position which is not active and not in maturing state,
        // we can recreate/create the position
        uint256 duration = durationWeeks * 1 weeks;
        delete delegationPoolParamsHistory[validator][delegator];
        delete beforeTopUpParams[validator][delegator];
        // TODO: calculate end of period instead of write in in the cold storage. It is cheaper
        delegationPositions[validator][delegator] = VestingPosition({
            duration: duration,
            start: block.timestamp,
            end: block.timestamp + duration,
            base: getBase(),
            vestBonus: getVestingBonus(durationWeeks),
            rsiBonus: uint248(getRSI())
        });

        // keep the change in the delegation pool params per account
        _addNewDelegationPoolParam(
            validator,
            delegator,
            DelegationPoolParams({
                balance: newBalance,
                correction: delegation.correctionOf(delegator),
                epochNum: currentEpochId
            })
        );
    }

    /**
     * @inheritdoc IRewardPool
     */
    function onTopUpDelegatePosition(
        address validator,
        address delegator,
        uint256 currentEpochId,
        uint256 amount
    ) external {
        DelegationPool storage delegation = delegationPools[validator];

        uint256 balance = delegation.balanceOf(delegator);
        uint256 newBalance = balance + amount;
        if (newBalance < minDelegation) revert DelegateRequirement({src: "vesting", msg: "DELEGATION_TOO_LOW"});

        if (!_isTopUpMade(validator, delegator)) {
            _saveFirstTopUp(validator, delegator, delegation, balance);
        }

        delegation.deposit(delegator, amount);
        _topUpDelegatePosition(validator, delegator, delegation, currentEpochId, amount);
    }

    /**
     * @inheritdoc IRewardPool
     */
    function onCutPosition(
        address validator,
        address delegator,
        uint256 amount,
        uint256 currentEpochId
    ) external returns (uint256 penalty, uint256 fullReward) {
        DelegationPool storage delegation = getDelegationPoolOf(validator);

        uint256 delegatedAmount = delegation.balanceOf(delegator);
        if (amount > delegatedAmount) revert DelegateRequirement({src: "vesting", msg: "INSUFFICIENT_BALANCE"});

        uint256 delegatedAmountLeft = delegatedAmount - amount;
        if (delegatedAmountLeft < minDelegation && delegatedAmountLeft != 0)
            revert DelegateRequirement({src: "vesting", msg: "DELEGATION_TOO_LOW"});

        delegation.withdraw(delegator, amount);

        VestingPosition memory position = delegationPositions[validator][delegator];
        if (position.isActive()) {
            penalty = _calcSlashing(position, amount);
            // apply the max Vesting bonus, because the full reward must be burned
            fullReward = applyMaxReward(delegation.claimRewards(delegator));

            // if position is closed when active, top-up must not be available as well as reward must not be available
            // so we delete the vesting data
            if (delegatedAmountLeft == 0) {
                delete delegationPositions[validator][delegator];
                delete delegationPoolParamsHistory[validator][delegator];
            } else {
                // keep the change in the account pool params
                uint256 balance = delegation.balanceOf(delegator);
                int256 correction = delegation.correctionOf(delegator);
                _onAccountParamsChange(validator, delegator, balance, correction, currentEpochId);
            }
        }
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
    function claimDelegatorReward(address validator, address delegator) external returns (uint256) {
        DelegationPool storage delegation = getDelegationPoolOf(validator);
        uint256 reward = delegation.claimRewards(delegator);
        reward = _applyCustomReward(reward);
        if (reward == 0) return 0;

        emit DelegatorRewardClaimed(validator, delegator, reward);

        return reward;
    }

    // External View functions
    function getValidatorReward(address validator) external view returns (uint256) {
        return valRewards[validator].total - valRewards[validator].taken;
    }

    /**
     * @inheritdoc IRewardPool
     */
    function onClaimPositionReward(
        address validator,
        address delegator,
        uint256 epochNumber,
        uint256 topUpIndex
    ) external returns (uint256 sumReward, uint256 remainder) {
        VestingPosition memory position = delegationPositions[validator][delegator];
        if (noRewardConditions(position)) {
            return (0, 0);
        }

        // uint256 sumReward;
        uint256 sumMaxReward;
        DelegationPool storage delegationPool = getDelegationPoolOf(validator);
        bool rsi = true;
        if (_isTopUpMade(validator, delegator)) {
            rsi = false;
            RewardParams memory params = beforeTopUpParams[validator][delegator];
            uint256 rsiReward = delegationPool.claimRewards(
                delegator,
                params.rewardPerShare,
                params.balance,
                params.correction
            );
            uint256 maxRsiReward = applyMaxReward(rsiReward);
            sumReward += _applyCustomReward(position, rsiReward, true);
            sumMaxReward += maxRsiReward;
        }

        // distribute the proper vesting reward
        (uint256 epochRPS, uint256 balance, int256 correction) = _rewardParams(
            validator,
            delegator,
            epochNumber,
            topUpIndex
        );
        uint256 reward = delegationPool.claimRewards(delegator, epochRPS, balance, correction);
        uint256 maxReward = applyMaxReward(reward);
        reward = _applyCustomReward(position, reward, rsi);
        sumReward += reward;
        sumMaxReward += maxReward;

        // If the full maturing period is finished, withdraw also the reward made after the vesting period
        if (block.timestamp > position.end + position.duration) {
            uint256 additionalReward = delegationPool.claimRewards(delegator);
            uint256 maxAdditionalReward = applyMaxReward(additionalReward);
            additionalReward = _applyCustomReward(additionalReward);
            sumReward += additionalReward;
            sumMaxReward += maxAdditionalReward;
        }

        // uint256 remainder = sumMaxReward - sumReward;
        // if (remainder > 0) {
        //     _burnAmount(remainder);
        // }
        remainder = sumMaxReward - sumReward;

        // return (sumReward, remainder);
    }

    /**
     * @inheritdoc IRewardPool
     */
    function getDelegationPoolSupplyOf(address validator) external view returns (uint256) {
        return getDelegationPoolOf(validator).supply;
    }

    // External View functions
    /**
     * @inheritdoc IRewardPool
     */
    function delegationOf(address validator, address delegator) external view returns (uint256) {
        DelegationPool storage delegation = delegationPools[validator];

        return delegation.balanceOf(delegator);
    }

    /**
     * @inheritdoc IRewardPool
     */
    function totalDelegationOf(address validator) external view returns (uint256) {
        DelegationPool storage delegation = delegationPools[validator];

        return delegation.supply;
    }

    /**
     * @inheritdoc IRewardPool
     */
    function getRawDelegatorReward(address validator, address delegator) external view returns (uint256) {
        DelegationPool storage delegation = getDelegationPoolOf(validator);
        return delegation.claimableRewards(delegator);
    }

    /**
     * @inheritdoc IRewardPool
     */
    function getDelegatorReward(address validator, address delegator) external view returns (uint256) {
        DelegationPool storage delegation = getDelegationPoolOf(validator);
        uint256 reward = delegation.claimableRewards(delegator);
        return _applyCustomReward(reward);
    }

    // _______________ Public functions _______________

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

    // Public View functions
    // TODO: Check if the commitEpoch is the last transaction in the epoch, otherwise bug may occur
    /**
     * @notice Checks if balance change was already made in the current epoch
     * @param validator Validator to delegate to
     */
    function isBalanceChangeMade(
        address validator,
        address delegator,
        uint256 currentEpochNum
    ) public view returns (bool) {
        uint256 length = delegationPoolParamsHistory[validator][delegator].length;
        if (length == 0) {
            return false;
        }

        DelegationPoolParams memory data = delegationPoolParamsHistory[validator][delegator][length - 1];
        if (data.epochNum == currentEpochNum) {
            return true;
        }

        return false;
    }

    // _______________ Internal functions _______________

    function _addNewDelegationPoolParam(
        address validator,
        address delegator,
        DelegationPoolParams memory params
    ) internal {
        if (isBalanceChangeMade(validator, delegator, params.epochNum)) {
            // Top up can be made only once per epoch
            revert StakeRequirement({src: "vesting", msg: "TOPUP_ALREADY_MADE"});
        }

        delegationPoolParamsHistory[validator][delegator].push(params);
    }

    function _topUpDelegatePosition(
        address validator,
        address delegator,
        DelegationPool storage delegation,
        uint256 currentEpochId,
        uint256 amount
    ) internal {
        if (!isActiveDelegatePosition(validator, delegator)) {
            revert DelegateRequirement({src: "vesting", msg: "POSITION_NOT_ACTIVE"});
        }

        if (delegationPoolParamsHistory[validator][delegator].length > 52) {
            revert DelegateRequirement({src: "vesting", msg: "TOO_MANY_TOP_UPS"});
        }

        // keep the change in the account pool params
        uint256 balance = delegation.balanceOf(delegator);
        int256 correction = delegation.correctionOf(delegator);
        _onAccountParamsChange(validator, delegator, balance, correction, currentEpochId);

        // Modify end period of position, decrease RSI bonus
        // balance / old balance = increase coefficient
        // apply increase coefficient to the vesting period to find the increase in the period
        // TODO: Optimize gas costs
        uint256 timeIncrease;

        uint256 oldBalance = balance - amount;
        uint256 duration = delegationPositions[validator][delegator].duration;
        if (amount >= oldBalance) {
            timeIncrease = duration;
        } else {
            timeIncrease = (amount * duration) / oldBalance;
        }

        delegationPositions[validator][delegator].duration = duration + timeIncrease;
        delegationPositions[validator][delegator].end = delegationPositions[validator][delegator].end + timeIncrease;
    }

    function _saveFirstTopUp(
        address validator,
        address delegator,
        DelegationPool storage delegation,
        uint256 balance
    ) internal {
        int256 correction = delegation.magnifiedRewardCorrections[delegator];
        uint256 rewardPerShare = delegation.magnifiedRewardPerShare;
        beforeTopUpParams[validator][delegator] = RewardParams({
            rewardPerShare: rewardPerShare,
            balance: balance,
            correction: correction
        });
    }

    function _onAccountParamsChange(
        address validator,
        address delegator,
        uint256 balance,
        int256 correction,
        uint256 currentEpochId
    ) internal {
        if (isBalanceChangeMade(validator, delegator, currentEpochId)) {
            // Top up can be made only once on epoch
            revert DelegateRequirement({src: "vesting", msg: "TOPUP_ALREADY_MADE"});
        }

        delegationPoolParamsHistory[validator][delegator].push(
            DelegationPoolParams({balance: balance, correction: correction, epochNum: currentEpochId})
        );
    }

    function _distributeDelegatorReward(address validator, uint256 reward) internal {
        delegationPools[validator].distributeReward(reward);
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

    function _claimValidatorReward(address validator, uint256 reward) internal {
        valRewards[validator].taken += reward;
    }

    // Internal View functions
    function _isTopUpMade(address validator, address manager) internal view returns (bool) {
        return beforeTopUpParams[validator][manager].balance != 0;
    }

    function _calcValidatorReward(address validator) internal view returns (uint256) {
        return valRewards[validator].total - valRewards[validator].taken;
    }

    /**
     * @notice returns RewardPool struct for a specific validator
     * @param validator the address of the validator whose pool is being queried
     * @return RewardPool struct for the validator
     */
    function getDelegationPoolOf(address validator) internal view returns (DelegationPool storage) {
        require(validator != address(0), "ZERO_ADDRESS");

        return delegationPools[validator];
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

    function _rewardParams(
        address validator,
        address manager,
        uint256 epochNumber,
        uint256 topUpIndex
    ) internal view returns (uint256 rps, uint256 balance, int256 correction) {
        VestingPosition memory position = delegationPositions[validator][manager];
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
            revert DelegateRequirement({src: "vesting", msg: "INVALID_EPOCH"});
        }
        // If the given RPS is for future time - it is wrong, so revert
        if (rpsData.timestamp > alreadyMatured) {
            revert DelegateRequirement({src: "vesting", msg: "WRONG_RPS"});
        }

        uint256 rewardPerShare = rpsData.value;
        (uint256 balanceData, int256 correctionData) = _getAccountParams(validator, manager, epochNumber, topUpIndex);

        return (rewardPerShare, balanceData, correctionData);
    }

    function _getAccountParams(
        address validator,
        address manager,
        uint256 epochNumber,
        uint256 paramsIndex
    ) internal view returns (uint256 balance, int256 correction) {
        if (paramsIndex >= delegationPoolParamsHistory[validator][manager].length) {
            revert DelegateRequirement({src: "vesting", msg: "INVALID_TOP_UP_INDEX"});
        }

        DelegationPoolParams memory params = delegationPoolParamsHistory[validator][manager][paramsIndex]; // poolParamsChanges[validator][manager][paramsIndex];
        if (params.epochNum > epochNumber) {
            revert DelegateRequirement({src: "vesting", msg: "LATER_TOP_UP"});
        } else if (params.epochNum == epochNumber) {
            // If balance change is made exactly in the epoch with the given index - it is the valid one for sure
            // because the balance change is made exactly before the distribution of the reward in this epoch
        } else {
            // This is the case where the balance change is  before the handled epoch (epochNumber)
            if (paramsIndex == delegationPoolParamsHistory[validator][manager].length - 1) {
                // If it is the last balance change - don't check does the next one can be better
            } else {
                // If it is not the last balance change - check does the next one can be better
                // We just need the right account specific pool params for the given RPS, to be able
                // to properly calculate the reward
                DelegationPoolParams memory nextParamsRecord = delegationPoolParamsHistory[validator][manager][
                    paramsIndex + 1
                ];
                if (nextParamsRecord.epochNum <= epochNumber) {
                    // If the next balance change is made in an epoch before the handled one or in the same epoch
                    // and is bigger than the provided balance change - the provided one is not valid.
                    // Because when the reward was distributed for the given epoch, the account balance was different
                    revert DelegateRequirement({src: "vesting", msg: "EARLIER_TOP_UP"});
                }
            }
        }

        return (params.balance, params.correction);
    }

    // _______________ Private functions _______________

    function _distributeReward(
        uint256 epochId,
        Uptime calldata uptime,
        uint256 fullReward,
        uint256 totalSupply,
        uint256 totalBlocks
    ) private returns (uint256 reward) {
        require(uptime.signedBlocks <= totalBlocks, "SIGNED_BLOCKS_EXCEEDS_TOTAL");

        uint256 balance = validatorSet.balanceOfAt(uptime.validator, epochId);
        DelegationPool storage delegationPool = delegationPools[uptime.validator];
        uint256 delegation = delegationPool.supply;

        // slither-disable-next-line divide-before-multiply
        uint256 validatorReward = (fullReward * (balance + delegation) * uptime.signedBlocks) /
            (totalSupply * totalBlocks);
        (uint256 validatorShares, uint256 delegatorShares) = _calculateValidatorAndDelegatorShares(
            balance,
            delegation,
            validatorReward
        );

        _distributeValidatorReward(uptime.validator, validatorShares);
        _distributeDelegatorReward(uptime.validator, delegatorShares);

        // Keep history record of the rewardPerShare to be used on reward claim
        if (delegatorShares > 0) {
            _saveEpochRPS(uptime.validator, delegationPool.magnifiedRewardPerShare, epochId);
        }

        // Keep history record of the validator rewards to be used on maturing vesting reward claim
        if (validatorShares > 0) {
            _saveValRewardData(uptime.validator, epochId);
        }

        return validatorReward;
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

    // Private View functions
    function noRewardConditions(VestingPosition memory position) private view returns (bool) {
        // If still unused position, there is no reward
        if (position.start == 0) {
            return true;
        }

        // if the position is still active, there is no matured reward
        if (position.isActive()) {
            return true;
        }

        return false;
    }

    // Private Pure functions
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
}
