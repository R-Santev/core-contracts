// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";

import "./../Withdrawal/Withdrawal.sol";
import "./LiquidStaking.sol";
import "./StateSyncer.sol";
import "./StakerVesting.sol";
import "./IStaking.sol";

// TODO: An optimization I can do is keeping only once the general apr params for a block so I don' need to keep them for every single user

abstract contract Staking is
    IStaking,
    ERC20VotesUpgradeable,
    Withdrawal,
    LiquidStaking,
    StateSyncer,
    StakerVesting,
    AccessControl
{
    uint256 public constant MAX_COMMISSION = 100;
    uint256 public minStake;

    function __Staking_init(uint256 newMinStake) internal onlyInitializing {
        __ERC20_init("ValidatorSet", "VSET");
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

    function totalStake() external view returns (uint256) {
        return totalSupply();
    }

    function totalStakeOf(address validator) external view returns (uint256) {
        return balanceOf(validator);
    }

    /**
     * @inheritdoc IStaking
     */
    function register(uint256[2] calldata signature, uint256[4] calldata pubkey) external {
        if (!whitelist[msg.sender]) revert Unauthorized("WHITELIST");

        _verifyValidatorRegistration(msg.sender, signature, pubkey);

        validators[msg.sender] = Validator({blsKey: pubkey, stake: 0, liquidDebt: 0, commission: 0, active: true});
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

    function openStakingPosition(uint256 durationWeeks) external payable {
        _requireNotInVestingCycle();
        uint256 currentBalance = balanceOf(msg.sender);
        _processStake(currentBalance);
        rewardPool.onNewPosition(msg.sender, durationWeeks);
    }

    function stake() external payable onlyValidator {
        uint256 currentBalance = balanceOf(msg.sender);
        _processStake(currentBalance);
        rewardPool.onStake(msg.sender, currentBalance);
    }

    function unstake(uint256 amount) public {
        uint256 balanceAfterUnstake = _unstake(amount);
        StateSyncer._syncUnstake(msg.sender, amount);
        LiquidStaking._collectTokens(msg.sender, amount);
        uint256 amountToWithdraw = StakerVesting._updatePositionOnUnstake(amount, balanceAfterUnstake);
        _registerWithdrawal(msg.sender, amount);

        emit Unstaked(msg.sender, amount);
    }

    function _processStake(uint256 balance) private {
        _stake(balance);
        _postStakeAction();
    }

    function _stake(uint256 currentBalance) private {
        uint256 amount = msg.value;
        if (msg.value + currentBalance < minStake) revert StakeRequirement({src: "stake", msg: "STAKE_TOO_LOW"});
        assert(currentBalance + amount <= _maxSupply());

        _mint(msg.sender, amount);
        _delegate(msg.sender, msg.sender);

        emit Staked(msg.sender, msg.value);
    }

    function _postStakeAction() private {
        StateSyncer._syncStake(msg.sender, msg.value);
        LiquidStaking._distributeTokens(msg.sender, msg.value);
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

    function _requireNotInVestingCycle() private view {
        if (isStakerInVestingCycle(msg.sender)) {
            revert StakeRequirement({src: "veting", msg: "ALREADY_IN_VESTING"});
        }
    }

    function _removeIfValidatorUnstaked(address validator, uint256 newStake) private {
        if (newStake == 0) {
            validators[validator].active = false;
            emit ValidatorDeactivated(validator);
        }
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
        require(from == address(0) || to == address(0), "TRANSFER_FORBIDDEN");
        super._beforeTokenTransfer(from, to, amount);
    }

    function _delegate(address delegator, address delegatee) internal override {
        if (delegator != delegatee) revert("DELEGATION_FORBIDDEN");
        super._delegate(delegator, delegatee);
    }
}
