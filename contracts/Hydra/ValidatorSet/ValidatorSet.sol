// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/utils/ArraysUpgradeable.sol";

import "./ValidatorSetBase.sol";
import "./modules/AccessControl/AccessControl.sol";
import "./modules/PowerExponent/PowerExponent.sol";
import "./modules/Staking/Staking.sol";
import "./modules/Delegation/Delegation.sol";
import "./../common/System/System.sol";

import "../../libs/SafeMathInt.sol";

// TODO: setup use of reward account that would handle the amounts of rewards

// solhint-disable max-states-count
contract ValidatorSet is ValidatorSetBase, System, AccessControl, PowerExponent, Staking, Delegation {
    using WithdrawalQueueLib for WithdrawalQueue;
    using SafeMathInt for int256;
    using ArraysUpgradeable for uint256[];

    /// @notice Constant used to keep the slashing percent
    uint256 public constant DOUBLE_SIGNING_SLASHING_PERCENT = 10;

    /// @notice Keeps the flag for the slashing per epoch and pbft round
    /// @dev epochNumber -> roundNumber -> validator address -> bool
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public doubleSignerSlashes;

    /// @notice Epoch data linked with the epoch id
    mapping(uint256 => Epoch) public epochs;

    /// @notice Array with epoch end blocks
    uint256[] public epochEndBlocks;

    // _______________ Modifiers _______________

    modifier onlyRewardPool() {
        if (msg.sender != address(rewardPool)) revert Unauthorized("REWARD_POOL");
        _;
    }

    // _______________ Initializer _______________

    /**
     * @notice Initializer function for genesis contract, called by v3 client at genesis to set up the initial set.
     * @dev only callable by client, can only be called once
     * @param init: newEpochReward reward for a proposed epoch
     *              newMinStake minimum stake to become a validator
     *              newMinDelegation minimum amount to delegate to a validator
     * @param newValidators: addr addresses of initial validators
     *                    pubkey uint256[4] BLS public keys of initial validators
     *                    signature uint256[2] signature of initial validators
     *                    stake amount staked per initial validator
     * @param newBls address of BLS contract/precompile
     * @param governance Governance address to set as owner of the contract
     */
    function initialize(
        InitStruct calldata init,
        ValidatorInit[] calldata newValidators,
        IBLS newBls,
        IRewardPool newRewardPool,
        address governance,
        address liquidToken
    ) external initializer onlySystemCall {
        __ValidatorSetBase_init(newBls, newRewardPool);
        __PowerExponent_init();
        __AccessControl_init(governance);
        __Staking_init(init.minStake, liquidToken);
        __Delegation_init();
        __ReentrancyGuard_init();
        _initialize(newValidators);
    }

    function _initialize(ValidatorInit[] calldata newValidators) private {
        epochEndBlocks.push(0);
        // set initial validators
        for (uint256 i = 0; i < newValidators.length; i++) {
            _register(newValidators[i].addr, newValidators[i].signature, newValidators[i].pubkey);
            _processStake(newValidators[i].addr, newValidators[i].stake);
        }
    }

    // _______________ External functions _______________

    function commitEpoch(uint256 id, Epoch calldata epoch, uint256 epochSize) external payable onlySystemCall {
        uint256 newEpochId = currentEpochId++;
        require(id == newEpochId, "UNEXPECTED_EPOCH_ID");
        require(epoch.endBlock > epoch.startBlock, "NO_BLOCKS_COMMITTED");
        require((epoch.endBlock - epoch.startBlock + 1) % epochSize == 0, "EPOCH_MUST_BE_DIVISIBLE_BY_EPOCH_SIZE");
        require(epochs[newEpochId - 1].endBlock + 1 == epoch.startBlock, "INVALID_START_BLOCK");

        epochs[newEpochId] = epoch;
        _commitBlockNumbers[newEpochId] = block.number;
        epochEndBlocks.push(epoch.endBlock);

        // Apply new exponent in case it was changed in the latest epoch
        _applyPendingExp();

        emit NewEpoch(id, epoch.startBlock, epoch.endBlock, epoch.epochRoot);
    }

    function onRewardClaimed(address validator, uint256 amount) external onlyRewardPool {
        _registerWithdrawal(validator, amount);
    }

    // External View functions
    /// @notice Get the validator by its address
    /// @param validatorAddress address
    function getValidator(
        address validatorAddress
    )
        external
        view
        returns (
            uint256[4] memory blsKey,
            uint256 stake,
            uint256 totalStake,
            uint256 commission,
            uint256 withdrawableRewards,
            bool active
        )
    {
        Validator memory v = validators[validatorAddress];
        blsKey = v.blsKey;
        stake = balanceOf(validatorAddress);
        totalStake = stake + rewardPool.getDelegationPoolSupplyOf(validatorAddress);
        commission = v.commission;
        withdrawableRewards = rewardPool.getValidatorReward(validatorAddress);
        active = v.active;
    }

    /**
     * @inheritdoc IValidatorSet
     */
    function totalBlocks(uint256 epochId) external view returns (uint256 length) {
        uint256 endBlock = epochs[epochId].endBlock;
        length = endBlock == 0 ? 0 : endBlock - epochs[epochId].startBlock + 1;
    }

    /**
     * @inheritdoc IValidatorSet
     */
    function getEpochByBlock(uint256 blockNumber) external view returns (Epoch memory) {
        uint256 epochIndex = epochEndBlocks.findUpperBound(blockNumber);
        return epochs[epochIndex];
    }

    // _______________ Public functions _______________

    // _______________ Internal functions _______________

    // _______________ Private functions _______________

    // slither-disable-next-line unused-state,naming-convention
    uint256[50] private __gap;
}
