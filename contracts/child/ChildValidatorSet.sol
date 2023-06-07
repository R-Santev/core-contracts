// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/utils/ArraysUpgradeable.sol";

import "../interfaces/IChildValidatorSetBase.sol";

import "./System.sol";

import "./modules/CVSStorage.sol";
import "./modules/CVSAccessControl.sol";
import "./modules/CVSWithdrawal.sol";
import "./modules/CVSStaking.sol";
import "./modules/CVSDelegation.sol";

import "./h_modules/PowerExponent.sol";
import "./h_modules/APR.sol";
import "./h_modules/ExtendedDelegation.sol";
import "./h_modules/ExtendedStaking.sol";
import "./h_modules/VestManager.sol";
import "./h_modules/Vesting.sol";

import "../libs/ValidatorStorage.sol";
import "../libs/ValidatorQueue.sol";
import "../libs/SafeMathInt.sol";

// TODO: setup use of reward account that would handle the amounts of rewards

// TODO: With the current architecture validators data is handled in both contract and node.
// This is not optimal and should be changed.
// Maybe better approach is to keep the data in the contract and just fetching info at the end of an epoch
// This way node would not have to handle balance changes on every block.

// solhint-disable max-states-count
contract ChildValidatorSet is
    IChildValidatorSetBase,
    System,
    APR,
    CVSStorage,
    CVSAccessControl,
    CVSWithdrawal,
    PowerExponent,
    CVSDelegation,
    ExtendedStaking,
    ExtendedDelegation
{
    using ValidatorStorageLib for ValidatorTree;
    using ValidatorQueueLib for ValidatorQueue;
    using WithdrawalQueueLib for WithdrawalQueue;
    using RewardPoolLib for RewardPool;
    using SafeMathInt for int256;
    using ArraysUpgradeable for uint256[];

    uint256 public constant DOUBLE_SIGNING_SLASHING_PERCENT = 10;
    // epochNumber -> roundNumber -> validator address -> bool
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public doubleSignerSlashes;

    /**
     * @notice Initializer function for genesis contract, called by v3 client at genesis to set up the initial set.
     * @dev only callable by client, can only be called once
     * @param init: newEpochReward reward for a proposed epoch
     *              newMinStake minimum stake to become a validator
     *              newMinDelegation minimum amount to delegate to a validator
     * @param validators: addr addresses of initial validators
     *                    pubkey uint256[4] BLS public keys of initial validators
     *                    signature uint256[2] signature of initial validators
     *                    stake amount staked per initial validator
     * @param newBls address pf BLS contract/precompile
     * @param governance Governance address to set as owner of the
     */
    function initialize(
        InitStruct calldata init,
        ValidatorInit[] calldata validators,
        IBLS newBls,
        address governance
    ) external initializer onlySystemCall {
        currentEpochId = 1;
        epochSize = init.epochSize;
        _transferOwnership(governance);
        __ReentrancyGuard_init();

        // slither-disable-next-line events-maths
        epochReward = init.epochReward;
        minStake = init.minStake;
        minDelegation = init.minDelegation;

        // set BLS contract
        bls = newBls;
        // add initial validators
        for (uint256 i = 0; i < validators.length; i++) {
            Validator memory validator = Validator({
                blsKey: validators[i].pubkey,
                stake: validators[i].stake,
                commission: 0,
                totalRewards: 0,
                takenRewards: 0,
                active: true
            });
            _validators.insert(validators[i].addr, validator);

            verifyValidatorRegistration(validators[i].addr, validators[i].signature, validators[i].pubkey);
        }

        // Polygon Edge didn't apply the default value set in the CVSStorage contract, so we set it here
        powerExponent = PowerExponentStore({value: 8500, pendingValue: 0});

        // H_MODIFY: Set base implementation for VestFactory
        implementation = address(new VestManager());
    }

    /**
     * @inheritdoc IChildValidatorSetBase
     */
    function commitEpoch(uint256 id, Epoch calldata epoch, Uptime calldata uptime) external onlySystemCall {
        uint256 newEpochId = currentEpochId++;
        require(id == newEpochId, "UNEXPECTED_EPOCH_ID");
        require(epoch.endBlock > epoch.startBlock, "NO_BLOCKS_COMMITTED");
        require((epoch.endBlock - epoch.startBlock + 1) % epochSize == 0, "EPOCH_MUST_BE_DIVISIBLE_BY_EPOCH_SIZE");
        require(epochs[newEpochId - 1].endBlock + 1 == epoch.startBlock, "INVALID_START_BLOCK");

        Epoch storage newEpoch = epochs[newEpochId];
        newEpoch.endBlock = epoch.endBlock;
        newEpoch.startBlock = epoch.startBlock;
        newEpoch.epochRoot = epoch.epochRoot;

        epochEndBlocks.push(epoch.endBlock);

        _distributeRewards(epoch, uptime);
        _processQueue();

        // H_MODIFY: Apply new exponent in case it was changed in the latest epoch
        _applyPendingExp();

        emit NewEpoch(id, epoch.startBlock, epoch.endBlock, epoch.epochRoot);
    }

    /**
     * @inheritdoc IChildValidatorSetBase
     */
    function commitEpochWithDoubleSignerSlashing(
        uint256 curEpochId,
        uint256 blockNumber,
        uint256 pbftRound,
        Epoch calldata epoch,
        Uptime calldata uptime,
        DoubleSignerSlashingInput[] calldata inputs
    ) external {
        uint256 length = inputs.length;
        require(length >= 2, "INVALID_LENGTH");
        // first, assert all blockhashes are unique
        require(_assertUniqueBlockhash(inputs), "BLOCKHASH_NOT_UNIQUE");

        // check aggregations are signed appropriately
        for (uint256 i = 0; i < length; ) {
            _checkPubkeyAggregation(
                keccak256(
                    abi.encode(
                        block.chainid,
                        blockNumber,
                        inputs[i].blockHash,
                        pbftRound,
                        inputs[i].epochId,
                        inputs[i].eventRoot,
                        inputs[i].currentValidatorSetHash,
                        inputs[i].nextValidatorSetHash
                    )
                ),
                inputs[i].signature,
                inputs[i].bitmap
            );
            unchecked {
                ++i;
            }
        }

        // get full validator set
        uint256 validatorSetLength = _validators.count < ACTIVE_VALIDATOR_SET_SIZE
            ? _validators.count
            : ACTIVE_VALIDATOR_SET_SIZE;
        address[] memory validatorSet = sortedValidators(validatorSetLength);
        bool[] memory slashingSet = new bool[](validatorSetLength);

        for (uint256 i = 0; i < validatorSetLength; ) {
            uint256 count = 0;
            for (uint256 j = 0; j < length; j++) {
                // check if bitmap index has validator
                if (_getValueFromBitmap(inputs[j].bitmap, i)) {
                    count++;
                }

                // slash validators that have signed multiple blocks
                if (count > 1) {
                    _slashDoubleSigner(validatorSet[i], inputs[j].epochId, pbftRound);
                    slashingSet[i] = true;
                    break;
                }
            }
            unchecked {
                ++i;
            }
        }
        _endEpochOnSlashingEvent(curEpochId, epoch, uptime, slashingSet);
    }

    /**
     * @inheritdoc IChildValidatorSetBase
     */
    function getCurrentValidatorSet() external view returns (address[] memory) {
        return sortedValidators(ACTIVE_VALIDATOR_SET_SIZE);
    }

    /**
     * @inheritdoc IChildValidatorSetBase
     */
    function getEpochByBlock(uint256 blockNumber) external view returns (Epoch memory) {
        uint256 ret = epochEndBlocks.findUpperBound(blockNumber);
        return epochs[ret + 1];
    }

    /**
     * @inheritdoc IChildValidatorSetBase
     */
    function totalActiveStake() public view returns (uint256 activeStake) {
        uint256 length = ACTIVE_VALIDATOR_SET_SIZE <= _validators.count ? ACTIVE_VALIDATOR_SET_SIZE : _validators.count;
        if (length == 0) return 0;

        address tmpValidator = _validators.last();
        activeStake += _validators.get(tmpValidator).stake + _validators.getDelegationPool(tmpValidator).supply;

        for (uint256 i = 1; i < length; i++) {
            tmpValidator = _validators.prev(tmpValidator);
            activeStake += _validators.get(tmpValidator).stake + _validators.getDelegationPool(tmpValidator).supply;
        }
    }

    function _distributeRewards(Epoch calldata epoch, Uptime calldata uptime) internal {
        // H_MODIFY: Ensure the max reward tokens are sent
        uint256 activeStake = totalActiveStake();
        // TODO: configure how the reward would enter the contract whenever more data from polygon is available
        // require(msg.value == getEpochReward(activeStake), "INVALID_REWARD_AMOUNT");

        require(uptime.epochId == currentEpochId - 1, "EPOCH_NOT_COMMITTED");

        uint256 length = uptime.uptimeData.length;

        require(length <= ACTIVE_VALIDATOR_SET_SIZE && length <= _validators.count, "INVALID_LENGTH");

        // H_MODIFY: change the epoch reward calculation
        // apply the reward factor; participation factor is applied then
        // base + vesting and RSI are applied on claimReward (handled by the position proxy) for delegators
        // and on _distributeValidatorReward for validators
        // TODO: Reward must be calculated per epoch; apply the changes whenever APR oracles are available
        uint256 reward = calcReward(epoch, activeStake);

        for (uint256 i = 0; i < length; ++i) {
            UptimeData memory uptimeData = uptime.uptimeData[i];
            Validator storage validator = _validators.get(uptimeData.validator);
            RewardPool storage rewardPool = _validators.getDelegationPool(uptimeData.validator);
            // slither-disable-next-line divide-before-multiply
            uint256 validatorReward = (reward * (validator.stake + rewardPool.supply) * uptimeData.signedBlocks) /
                (activeStake * uptime.totalBlocks);
            (uint256 validatorShares, uint256 delegatorShares) = _calculateValidatorAndDelegatorShares(
                uptimeData.validator,
                validatorReward
            );

            _distributeValidatorReward(uptimeData.validator, validatorShares);
            _distributeDelegatorReward(uptimeData.validator, delegatorShares);

            // H_MODIFY: Keep history record of the rewardPerShare to be used on reward claim
            if (delegatorShares > 0) {
                _saveEpochRPS(uptimeData.validator, rewardPool.magnifiedRewardPerShare, uptime.epochId);
            }

            // H_MODIFY: Keep history record of the validator rewards to be used on maturing vesting reward claim
            if (validatorShares > 0) {
                _saveValRewardData(uptimeData.validator, uptime.epochId);
            }
        }
    }

    function _processQueue() internal {
        QueuedValidator[] storage queue = _queue.get();
        for (uint256 i = 0; i < queue.length; ++i) {
            QueuedValidator memory item = queue[i];
            address validatorAddr = item.validator;
            // values will be zero for non existing validators
            Validator storage validator = _validators.get(validatorAddr);
            // if validator already present in tree, remove and reinsert to maintain sort
            if (_validators.exists(validatorAddr)) {
                _validators.remove(validatorAddr);
            }

            validator.stake = (int256(validator.stake) + item.stake).toUint256Safe();
            _validators.insert(validatorAddr, validator);
            _queue.resetIndex(validatorAddr);
        }
        _queue.reset();
    }

    function _slashDoubleSigner(address key, uint256 epoch, uint256 pbftRound) private {
        if (doubleSignerSlashes[epoch][pbftRound][key]) {
            return;
        }
        doubleSignerSlashes[epoch][pbftRound][key] = true;
        Validator storage validator = _validators.get(key);
        _validators.delegationPools[key].supply -=
            (_validators.delegationPools[key].supply * DOUBLE_SIGNING_SLASHING_PERCENT) /
            100;
        uint256 slashedAmount = (validator.stake * DOUBLE_SIGNING_SLASHING_PERCENT) / 100;
        validator.stake -= slashedAmount;
        _validators.totalStake -= slashedAmount;
        emit DoubleSignerSlashed(key, epoch, pbftRound);
    }

    function _endEpochOnSlashingEvent(
        uint256 id,
        Epoch calldata epoch,
        Uptime calldata uptime,
        bool[] memory slashingSet
    ) private {
        uint256 newEpochId = currentEpochId++;
        require(id == newEpochId, "UNEXPECTED_EPOCH_ID");
        require(epoch.endBlock > epoch.startBlock, "NO_BLOCKS_COMMITTED");
        require(epochs[newEpochId - 1].endBlock + 1 == epoch.startBlock, "INVALID_START_BLOCK");

        Epoch storage newEpoch = epochs[newEpochId];
        newEpoch.endBlock = epoch.endBlock;
        newEpoch.startBlock = epoch.startBlock;
        newEpoch.epochRoot = epoch.epochRoot;

        epochEndBlocks.push(epoch.endBlock);

        uint256 length = uptime.uptimeData.length;

        require(length <= ACTIVE_VALIDATOR_SET_SIZE && length <= _validators.count, "INVALID_LENGTH");

        uint256 activeStake = totalActiveStake();

        // H_MODIFY: change the epoch reward calculation
        // apply the reward factor; participation factor is applied then
        // base + vesting and RSI are applied on claimReward (handled by the position proxy)
        uint256 modifiedEpochReward = applyMacro(activeStake);
        uint256 reward = (modifiedEpochReward * (epoch.endBlock - epoch.startBlock) * 100) / (epochSize * 100);

        for (uint256 i = 0; i < length; ++i) {
            // skip reward distribution for slashed validators
            if (slashingSet[i]) {
                continue;
            }
            UptimeData memory uptimeData = uptime.uptimeData[i];
            Validator storage validator = _validators.get(uptimeData.validator);
            // slither-disable-next-line divide-before-multiply
            uint256 validatorReward = (reward *
                (validator.stake + _validators.getDelegationPool(uptimeData.validator).supply) *
                uptimeData.signedBlocks) / (activeStake * uptime.totalBlocks);
            (uint256 validatorShares, uint256 delegatorShares) = _calculateValidatorAndDelegatorShares(
                uptimeData.validator,
                validatorReward
            );

            _distributeValidatorReward(uptimeData.validator, validatorShares);
            // H_MODIFY: Keep history record of the validator rewards to be used on maturing vesting reward claim
            if (validatorShares > 0) {
                _saveValRewardData(uptimeData.validator, uptime.epochId);
            }

            _handleDelegation(uptimeData, uptime, delegatorShares);
        }

        _processQueue();

        // H_MODIFY: Apply new exponent in case it was changed in the latest epoch
        _applyPendingExp();

        emit NewEpoch(id, epoch.startBlock, epoch.endBlock, epoch.epochRoot);
    }

    function _handleDelegation(UptimeData memory uptimeData, Uptime memory uptime, uint256 delegatorShares) internal {
        RewardPool storage rewardPool = _validators.getDelegationPool(uptimeData.validator);

        rewardPool.distributeReward(delegatorShares);

        // H_MODIFY: Keep history record of the rewardPerShare to be used in reward claim
        if (delegatorShares > 0) {
            _saveEpochRPS(uptimeData.validator, rewardPool.magnifiedRewardPerShare, uptime.epochId);
        }

        emit DelegatorRewardDistributed(uptimeData.validator, delegatorShares);
    }

    function _calculateValidatorAndDelegatorShares(
        address validatorAddr,
        uint256 totalReward
    ) private view returns (uint256, uint256) {
        Validator memory validator = _validators.get(validatorAddr);
        uint256 stakedAmount = validator.stake;
        uint256 delegations = _validators.getDelegationPool(validatorAddr).supply;

        if (stakedAmount == 0) return (0, 0);
        if (delegations == 0) return (totalReward, 0);

        uint256 validatorReward = (totalReward * stakedAmount) / (stakedAmount + delegations);
        uint256 delegatorReward = totalReward - validatorReward;

        uint256 commission = (validator.commission * delegatorReward) / 100;

        return (validatorReward + commission, delegatorReward - commission);
    }

    /**
     * @notice verifies an aggregated BLS signature using BLS precompile
     * @param hash hash of the message signed
     * @param signature the signed message
     * @param bitmap bitmap of which validators have signed
     */
    function _checkPubkeyAggregation(bytes32 hash, bytes calldata signature, bytes calldata bitmap) private view {
        // verify signatures` for provided sig data and sigs bytes
        // slither-disable-next-line low-level-calls,calls-loop
        (bool callSuccess, bytes memory returnData) = VALIDATOR_PKCHECK_PRECOMPILE.staticcall{
            gas: VALIDATOR_PKCHECK_PRECOMPILE_GAS
        }(abi.encode(hash, signature, bitmap));
        bool verified = abi.decode(returnData, (bool));
        require(callSuccess && verified, "SIGNATURE_VERIFICATION_FAILED");
    }

    function _getValueFromBitmap(bytes calldata bitmap, uint256 index) private pure returns (bool) {
        uint256 byteNumber = index / 8;
        uint8 bitNumber = uint8(index % 8);

        if (byteNumber >= bitmap.length) {
            return false;
        }

        // Get the value of the bit at the given 'index' in a byte.
        return uint8(bitmap[byteNumber]) & (1 << bitNumber) > 0;
    }

    function _assertUniqueBlockhash(DoubleSignerSlashingInput[] calldata inputs) private pure returns (bool) {
        uint256 length = inputs.length;
        for (uint256 i = 0; i < length; i++) {
            for (uint256 j = i + 1; j < length; j++) {
                if (inputs[i].blockHash == inputs[j].blockHash) {
                    return false;
                }
            }
        }
        return true;
    }

    function calcReward(Epoch calldata epoch, uint256 activeStake) internal view returns (uint256) {
        uint256 modifiedEpochReward = applyMacro(activeStake);
        uint256 blocksNum = epoch.endBlock - epoch.startBlock;
        uint256 nominator = modifiedEpochReward * blocksNum * 100;
        uint256 denominator = epochSize * 100;

        return nominator / denominator;
    }

    // slither-disable-next-line unused-state,naming-convention
    uint256[50] private __gap;
}
