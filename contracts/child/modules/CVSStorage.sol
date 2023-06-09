// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "../../interfaces/modules/ICVSStorage.sol";
import "../../interfaces/IBLS.sol";
import "../../interfaces/IValidatorQueue.sol";
import "../../interfaces/IWithdrawalQueue.sol";
import "../../interfaces/Errors.sol";

import "../../interfaces/h_modules/IPowerExponent.sol";

import "../../libs/ValidatorStorage.sol";
import "../../libs/ValidatorQueue.sol";

abstract contract CVSStorage is ICVSStorage {
    using ValidatorStorageLib for ValidatorTree;
    using ValidatorQueueLib for ValidatorQueue;

    bytes32 public constant DOMAIN = keccak256("DOMAIN_CHILD_VALIDATOR_SET");
    uint256 public constant ACTIVE_VALIDATOR_SET_SIZE = 100;
    uint256 public constant WITHDRAWAL_WAIT_PERIOD = 1;
    uint256 public constant MAX_COMMISSION = 100;

    uint256 public epochSize;
    uint256 public currentEpochId;
    uint256[] public epochEndBlocks;
    uint256 public epochReward;
    uint256 public minStake;
    uint256 public minDelegation;

    IBLS public bls;

    // slither-disable-next-line naming-convention
    ValidatorTree internal _validators;
    // slither-disable-next-line naming-convention
    ValidatorQueue internal _queue;
    // slither-disable-next-line naming-convention
    mapping(address => WithdrawalQueue) internal _withdrawals;

    mapping(uint256 => Epoch) public epochs;
    mapping(address => bool) public whitelist;

    // slither-disable-next-line unused-state,naming-convention
    uint256[50] private __gap;

    // Initial Voting Power exponent to be ^0.85
    PowerExponentStore public powerExponent = PowerExponentStore({value: 8500, pendingValue: 0});

    //base implemetantion to be used by proxies
    address public implementation;

    /**
     * @inheritdoc ICVSStorage
     */
    function getValidator(
        address validator
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
        Validator memory v = _validators.get(validator);
        blsKey = v.blsKey;
        stake = v.stake;
        totalStake = v.stake + _validators.getDelegationPool(validator).supply;
        commission = v.commission;
        withdrawableRewards = v.totalRewards - v.takenRewards;
        active = v.active;
    }

    // H_MODIFY: TODO: The function helps having the same state on both contract and node sides but
    // a problem can still occur. If a change in balance occur at the last block of an epoch
    // the contract will address the change in the next epoch, but the node will make it at next epoch + 1.
    // A potential solution is to stop txs at the last block of an epoch
    // but the solution is temporary so better to handle it in general later when reworking the contracts

    /**
     * @notice A function to return the total stake together with the pending stake
     * H_MODIFY: Temporary fix to address the new way the node fetches the validators state
     * It checks for transfer events and sync the stake change with the node
     * But a check is made after every block and the changes are applied from the next epoch
     * Also it doesn't update the balance of the validator based on the amount emmited in the event
     * but fetches the balance from the contract. That's why we apply the pending balance here
     * @param validator Address of the validator
     */
    function getValidatorTotalStake(address validator) external view returns (uint256 stake, uint256 totalStake) {
        Validator memory v = _validators.get(validator);
        stake = uint256(int256(v.stake) + _getPendingStake(validator));
        totalStake = stake + _validators.getDelegationPool(validator).supply;
    }

    function _getPendingStake(address validator) internal view returns (int256) {
        return _queue.pendingStake(validator);
    }

    function verifyValidatorRegistration(
        address signer,
        uint256[2] calldata signature,
        uint256[4] calldata pubkey
    ) internal view {
        // slither-disable-next-line calls-loop
        (bool result, bool callSuccess) = bls.verifySingle(signature, pubkey, message(signer));
        if (!callSuccess || !result) revert InvalidSignature(signer);
    }

    /// @notice Message to sign for registration
    function message(address signer) internal view returns (uint256[2] memory) {
        // slither-disable-next-line calls-loop
        return bls.hashToPoint(DOMAIN, abi.encodePacked(signer, block.chainid));
    }
}
