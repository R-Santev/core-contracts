// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./StakerVesting.sol";
import "./LiquidStaking.sol";

import "./CVSStaking.sol";

import "./../../libs/ValidatorStorage.sol";
import "../../../../libs/SafeMathInt.sol";

abstract contract ExtendedStaking is StakerVesting, CVSStaking, LiquidStaking {
    using ValidatorStorageLib for ValidatorTree;

    using SafeMathUint for uint256;

    function openStakingPosition(uint256 durationWeeks) external payable {
        _requireNotInVestingCycle();

        stake();
        _handleOpenPosition(durationWeeks);
    }

    /**
     * @inheritdoc ICVSStaking
     */
    function stake() public payable override onlyValidator {
        super.stake();

        LiquidStaking._onStake(msg.sender, msg.value);

        VestData memory position = stakePositions[msg.sender];
        if (isActivePosition(position)) {
            // stakeOf still shows the old balance because the new amount will be applied on commitEpoch
            // _handleStake(_validators.stakeOf(msg.sender));
        }
    }

    function unstake(uint256 amount) public override {
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

    function claimValidatorReward(uint256 rewardHistoryIndex) public {
        VestData memory position = stakePositions[msg.sender];
        if (!isMaturingPosition(position)) {
            revert StakeRequirement({src: "vesting", msg: "NOT_MATURING"});
        }

        Validator storage validator = _validators.get(msg.sender);
        uint256 reward = _calcValidatorReward(validator, rewardHistoryIndex);
        if (reward == 0) return;

        // _claimValidatorReward(validator, reward);
        _registerWithdrawal(msg.sender, reward);

        emit ValidatorRewardClaimed(msg.sender, reward);
    }

    function _requireNotInVestingCycle() internal view {
        if (isStakerInVestingCycle(msg.sender)) {
            revert StakeRequirement({src: "veting", msg: "ALREADY_IN_VESTING"});
        }
    }

    /// @notice returns a validator balance for a given epoch
    function balanceOfAt(address account, uint256 epochNumber) external view returns (uint256) {
        return 0;
    }

    /// @notice returns the total supply for a given epoch
    function totalSupplyAt(uint256 epochNumber) external view returns (uint256) {
        return 0;
    }

    function getDelegationPoolOf(address validator) external view returns (address) {
        return address(0);
    }

    function stakePositionOf(address validator) external view returns (VestData memory) {
        return VestData({duration: 0, start: 0, end: 0, base: 0, vestBonus: 0, rsiBonus: 0});
    }
}
