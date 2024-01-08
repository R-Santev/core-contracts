// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "./IStaking.sol";
import "./StateSyncer.sol";
import "./LiquidStaking.sol";
import "./../Withdrawal/Withdrawal.sol";
import "./../AccessControl/AccessControl.sol";

// TODO: An optimization I can do is keeping only once the general apr params for a block so I don' need to keep them for every single user

abstract contract Staking is
    IStaking,
    ValidatorSetBase,
    ERC20VotesUpgradeable,
    Withdrawal,
    LiquidStaking,
    StateSyncer,
    AccessControl
{
    uint256 public constant MAX_COMMISSION = 100;
    uint256 public minStake;

    function __Staking_init(uint256 newMinStake, address newLiquidToken) internal onlyInitializing {
        __ERC20_init("ValidatorSet", "VSET");
        __LiquidStaking_init(newLiquidToken);
        __Staking_init_unchained(newMinStake);
    }

    function __Staking_init_unchained(uint256 newMinStake) internal onlyInitializing {
        require(newMinStake >= 1 ether, "INVALID_MIN_STAKE");
        minStake = newMinStake;
    }

    modifier onlyValidator() {
        if (!validators[msg.sender].active) revert Unauthorized("VALIDATOR");
        _;
    }

    /**
     * @inheritdoc IValidatorSet
     */
    function balanceOfAt(address account, uint256 epochNumber) external view returns (uint256) {
        return super.getPastVotes(account, _commitBlockNumbers[epochNumber]);
    }

    /**
     * @inheritdoc IValidatorSet
     */
    function totalSupplyAt(uint256 epochNumber) external view returns (uint256) {
        return super.getPastTotalSupply(_commitBlockNumbers[epochNumber]);
    }

    /**
     * @inheritdoc IStaking
     */
    function register(uint256[2] calldata signature, uint256[4] calldata pubkey) external {
        if (validators[msg.sender].registered) revert AlreadyRegistered(msg.sender);
        if (!validators[msg.sender].whitelisted) revert Unauthorized("WHITELIST");
        _register(msg.sender, signature, pubkey);
        _removeFromWhitelist(msg.sender);

        emit NewValidator(msg.sender, pubkey);
    }

    /**
     * @inheritdoc IStaking
     */
    function setCommission(uint256 newCommission) external onlyValidator {
        require(newCommission <= MAX_COMMISSION, "INVALID_COMMISSION");
        Validator storage validator = validators[msg.sender];
        emit CommissionUpdated(msg.sender, validator.commission, newCommission);
        validator.commission = newCommission;
    }

    /**
     * @inheritdoc IStaking
     */
    function openVestedPosition(uint256 durationWeeks) external payable onlyValidator {
        _requireNotInVestingCycle();
        _ensureStakeIsInRange(msg.value, balanceOf(msg.sender));

        _processStake(msg.sender, msg.value);
        rewardPool.onNewPosition(msg.sender, durationWeeks);
    }

    /**
     * @inheritdoc IStaking
     */
    function stake() external payable onlyValidator {
        uint256 currentBalance = balanceOf(msg.sender);
        _ensureStakeIsInRange(msg.value, currentBalance);

        _processStake(msg.sender, msg.value);
        rewardPool.onStake{value: msg.value}(msg.sender, currentBalance);
    }

    /**
     * @inheritdoc IStaking
     */
    function unstake(uint256 amount) public {
        uint256 balanceAfterUnstake = _unstake(amount);
        StateSyncer._syncUnstake(msg.sender, amount);
        LiquidStaking._collectTokens(msg.sender, amount);
        uint256 amountToWithdraw = rewardPool.onUnstake(msg.sender, amount, balanceAfterUnstake);
        _registerWithdrawal(msg.sender, amountToWithdraw);

        emit Unstaked(msg.sender, amount);
    }

    function _register(address validator, uint256[2] calldata signature, uint256[4] calldata pubkey) internal {
        _verifyValidatorRegistration(validator, signature, pubkey);
        validators[validator].blsKey = pubkey;
        validators[validator].active = true;
        validators[validator].registered = true;
        validatorsAddresses.push(validator);
    }

    function _processStake(address account, uint256 amount) internal {
        _stake(account, amount);
        _postStakeAction(account, amount);
    }

    function _stake(address account, uint256 amount) private {
        _mint(account, amount);
        _delegate(account, account);

        emit Staked(account, amount);
    }

    function _postStakeAction(address account, uint256 amount) private {
        StateSyncer._syncStake(account, amount);
        LiquidStaking._distributeTokens(account, amount);
    }

    function _unstake(uint256 amount) private returns (uint256) {
        uint256 currentBalance = balanceOf(msg.sender);
        if (amount > currentBalance) revert StakeRequirement({src: "unstake", msg: "INSUFFICIENT_BALANCE"});

        uint256 balanceAfterUnstake = currentBalance - amount;
        if (balanceAfterUnstake < minStake && balanceAfterUnstake != 0)
            revert StakeRequirement({src: "unstake", msg: "STAKE_TOO_LOW"});

        _burn(msg.sender, amount);
        _removeIfValidatorUnstaked(msg.sender, balanceAfterUnstake);

        return balanceAfterUnstake;
    }

    function _ensureStakeIsInRange(uint256 amount, uint256 currentBalance) private view {
        if (amount + currentBalance < minStake) revert StakeRequirement({src: "stake", msg: "STAKE_TOO_LOW"});
        assert(currentBalance + amount <= _maxSupply());
    }

    function _requireNotInVestingCycle() private view {
        if (rewardPool.isStakerInVestingCycle(msg.sender)) {
            revert StakeRequirement({src: "vesting", msg: "ALREADY_IN_VESTING"});
        }
    }

    function _removeIfValidatorUnstaked(address validator, uint256 newStake) private {
        if (newStake == 0) {
            validators[validator].active = false;
            emit ValidatorDeactivated(validator);
        }
    }

    /**
     * @inheritdoc IStaking
     */
    function getValidators() public view returns (address[] memory) {
        return validatorsAddresses;
    }

    // slither-disable-next-line unused-state,naming-convention
    uint256[50] private __gap;
}
