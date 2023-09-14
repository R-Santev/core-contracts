// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";

import "./../Withdrawal/Withdrawal.sol";
import "./LiquidStaking.sol";
import "./StateSyncer.sol";
import "./StakerVesting.sol";

abstract contract Staking is ERC20VotesUpgradeable, Withdrawal, LiquidStaking, StateSyncer, StakerVesting {
    function __Staking_init() internal onlyInitializing {
        __Staking_init_unchained();
    }

    function __Staking_init_unchained() internal onlyInitializing {
        __ERC20_init("ValidatorSet", "VSET");
    }

    function openStakingPosition(uint256 durationWeeks) external payable {
        _requireNotInVestingCycle();
        stake();
        StakerVesting._setPosition(durationWeeks);
    }

    function stake() external payable onlyValidator {
        uint256 currentBalance = balanceOf(msg.sender);
        _stake(currentBalance);

        StateSyncer._syncStake(msg.sender, msg.value);
        LiquidStaking._distributeTokens(msg.sender, msg.value);
        StakerVesting._updatePosition(msg.sender, currentBalance);
    }

    function unstake(uint256 amount) public {
        int256 totalValidatorStake = int256(_validators.stakeOf(msg.sender));

        int256 amountInt = amount.toInt256Safe();
        if (amountInt > totalValidatorStake) revert StakeRequirement({src: "unstake", msg: "INSUFFICIENT_BALANCE"});

        int256 amountAfterUnstake = totalValidatorStake - amountInt;
        if (amountAfterUnstake < int256(minStake) && amountAfterUnstake != 0)
            revert StakeRequirement({src: "unstake", msg: "STAKE_TOO_LOW"});

        // claimValidatorReward();

        // _queue.insert(msg.sender, amountInt * -1, 0);
        _syncUnstake(msg.sender, amount);
        LiquidStaking._onUnstake(msg.sender, amount);
        if (amountAfterUnstake == 0) {
            _validators.get(msg.sender).active = false;
        }

        // modified part starts
        VestData memory position = stakePositions[msg.sender];
        if (isActivePosition(position)) {
            Validator storage validator = _validators.get(msg.sender);
            amount = _handleUnstake(validator, amount, uint256(amountAfterUnstake));
            amountInt = amount.toInt256Safe();
        }
        // modified part ends

        _registerWithdrawal(msg.sender, amount);

        emit Unstaked(msg.sender, amount);
    }

    function _stake(uint256 currentBalance) private {
        if (msg.value.toInt256Safe() + currentBalance < int256(minStake))
            revert StakeRequirement({src: "stake", msg: "STAKE_TOO_LOW"});

        assert(currentBalance + amount <= _maxSupply());
        _mint(validator, amount);
        _delegate(validator, validator);

        emit Staked(msg.sender, msg.value);
    }

    function _requireNotInVestingCycle() private view {
        if (isStakerInVestingCycle(msg.sender)) {
            revert StakeRequirement({src: "veting", msg: "ALREADY_IN_VESTING"});
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
