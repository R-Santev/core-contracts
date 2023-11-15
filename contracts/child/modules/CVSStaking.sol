// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./CVSStorage.sol";
import "./CVSAccessControl.sol";
import "./CVSWithdrawal.sol";

import "../../interfaces/Errors.sol";
import "../../interfaces/modules/ICVSStaking.sol";

import "./../h_modules/Vesting.sol";
import "../h_modules/StakeSyncer.sol";

import "../../libs/ValidatorStorage.sol";
import "../../libs/ValidatorQueue.sol";
import "../../libs/SafeMathInt.sol";

abstract contract CVSStaking is ICVSStaking, CVSStorage, CVSAccessControl, CVSWithdrawal, StakeSyncer {
    using ValidatorStorageLib for ValidatorTree;
    using ValidatorQueueLib for ValidatorQueue;
    using SafeMathUint for uint256;

    modifier onlyValidator() {
        if (!_validators.get(msg.sender).active) revert Unauthorized("VALIDATOR");
        _;
    }

    /**
     * @inheritdoc ICVSStaking
     */
    function register(uint256[2] calldata signature, uint256[4] calldata pubkey) external {
        if (!whitelist[msg.sender]) revert Unauthorized("WHITELIST");

        verifyValidatorRegistration(msg.sender, signature, pubkey);

        _validators.insert(
            msg.sender,
            Validator({
                blsKey: pubkey,
                stake: 0,
                liquidDebt: 0,
                commission: 0,
                totalRewards: 0,
                takenRewards: 0,
                active: true
            })
        );
        _removeFromWhitelist(msg.sender);

        emit NewValidator(msg.sender, pubkey);
    }

    /**
     * @inheritdoc ICVSStaking
     */
    function stake() public payable virtual onlyValidator {
        int256 totalValidatorStake = int256(_validators.stakeOf(msg.sender)) + _queue.pendingStake(msg.sender);
        if (msg.value.toInt256Safe() + totalValidatorStake < int256(minStake))
            revert StakeRequirement({src: "stake", msg: "STAKE_TOO_LOW"});
        claimValidatorReward();
        _queue.insert(msg.sender, int256(msg.value), 0);
        _syncStake(msg.sender);
        emit Staked(msg.sender, msg.value);
    }

    /**
     * @inheritdoc ICVSStaking
     * @dev Oveerriden by StakerVesting contract
     */
    //
    function unstake(uint256 amount) public virtual {
        int256 totalValidatorStake = int256(_validators.stakeOf(msg.sender)) + _queue.pendingStake(msg.sender);
        int256 amountInt = amount.toInt256Safe();
        if (amountInt > totalValidatorStake) revert StakeRequirement({src: "unstake", msg: "INSUFFICIENT_BALANCE"});

        int256 amountAfterUnstake = totalValidatorStake - amountInt;
        if (amountAfterUnstake < int256(minStake) && amountAfterUnstake != 0)
            revert StakeRequirement({src: "unstake", msg: "STAKE_TOO_LOW"});

        claimValidatorReward();
        _queue.insert(msg.sender, amountInt * -1, 0);
        if (amountAfterUnstake == 0) {
            _validators.get(msg.sender).active = false;
        }
        _registerWithdrawal(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    /**
     * @inheritdoc ICVSStaking
     */
    function setCommission(uint256 newCommission) external onlyValidator {
        require(newCommission <= MAX_COMMISSION, "INVALID_COMMISSION");
        Validator storage validator = _validators.get(msg.sender);
        emit CommissionUpdated(msg.sender, validator.commission, newCommission);
        validator.commission = newCommission;
    }

    /**
     * @inheritdoc ICVSStaking
     */
    function claimValidatorReward() public virtual {
        Validator storage validator = _validators.get(msg.sender);
        uint256 reward = _calcValidatorReward(validator);
        if (reward == 0) {
            return;
        }

        _claimValidatorReward(validator, reward);

        _registerWithdrawal(msg.sender, reward);
        emit ValidatorRewardClaimed(msg.sender, reward);
    }

    function _claimValidatorReward(Validator storage validator, uint256 reward) internal {
        validator.takenRewards += reward;
    }

    function _calcValidatorReward(Validator memory validator) internal pure returns (uint256) {
        return validator.totalRewards - validator.takenRewards;
    }

    /**
     * @inheritdoc ICVSStaking
     */
    function sortedValidators(uint256 n) public view returns (address[] memory) {
        uint256 length = n <= _validators.count ? n : _validators.count;
        address[] memory validatorAddresses = new address[](length);

        if (length == 0) return validatorAddresses;

        address tmpValidator = _validators.last();
        validatorAddresses[0] = tmpValidator;

        for (uint256 i = 1; i < length; i++) {
            tmpValidator = _validators.prev(tmpValidator);
            validatorAddresses[i] = tmpValidator;
        }

        return validatorAddresses;
    }

    /**
     * @inheritdoc ICVSStaking
     */
    function getValidatorReward(address validator) external view returns (uint256) {
        Validator memory val = _validators.get(validator);
        return val.totalRewards - val.takenRewards;
    }

    /**
     * @inheritdoc ICVSStaking
     */
    function totalStake() external view returns (uint256) {
        return _validators.totalStake;
    }

    /**
     * @inheritdoc ICVSStaking
     */
    function totalStakeOf(address validator) external view returns (uint256) {
        return _validators.totalStakeOf(validator);
    }

    function _distributeValidatorReward(address validator, uint256 reward) internal virtual {
        Validator storage _validator = _validators.get(validator);
        _validator.totalRewards += reward;

        emit ValidatorRewardDistributed(validator, reward);
    }
}
