// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "./IDelegation.sol";
import "./DelegationVesting.sol";
import "./../../ValidatorSetBase.sol";
import "./../Staking/StateSyncer.sol";
import "./../Staking/LiquidStaking.sol";
import "./libs/DelegationPoolLib.sol";
import "./../../../common/CommonStructs.sol";

abstract contract Delegation is
    IDelegation,
    ValidatorSetBase,
    ERC20VotesUpgradeable,
    DelegationVesting,
    LiquidStaking,
    StateSyncer
{
    uint256 public minDelegation;
    mapping(address => mapping(address => uint256)) balances;

    function __Delegation_init(uint256 newMinDelegation) internal onlyInitializing {
        __VestFactory_init();
        __Delegation_init_unchained(newMinDelegation);
    }

    function __Delegation_init_unchained(uint256 newMinDelegation) internal onlyInitializing {
        minDelegation = newMinDelegation;
    }

    // TODO: fix function
    function getDelegationPoolOf(address validator) external pure returns (address) {
        return validator;
    }

    function newManager() external {
        require(msg.sender != address(0), "INVALID_OWNER");

        address managerAddr = _clone(msg.sender);
        vestManagers[managerAddr] = msg.sender;
    }

    function openDelegatePosition(address validator, uint256 durationWeeks) external payable onlyManager {
        uint256 balance = balances[validator][msg.sender];
        uint256 newBalance = balance + msg.value;
        if (newBalance < minDelegation) revert StakeRequirement({src: "vesting", msg: "DELEGATION_TOO_LOW"});

        _delegateToVal(msg.sender, validator, msg.value);
        rewardPool.onNewDelegatePosition(validator, msg.sender, durationWeeks, currentEpochId, newBalance);

        emit PositionOpened(msg.sender, validator, durationWeeks, msg.value);
    }

    function topUpDelegatePosition(address validator) external payable onlyManager {
        uint256 balance = balances[validator][msg.sender];
        if (balance + msg.value < minDelegation) revert StakeRequirement({src: "vesting", msg: "DELEGATION_TOO_LOW"});

        _delegateToVal(msg.sender, validator, msg.value);
        rewardPool.onTopUpDelegatePosition(validator, msg.sender, balance + msg.value, currentEpochId);

        emit PositionTopUp(msg.sender, validator, msg.value);
    }

    function _delegateToVal(address delegator, address validator, uint256 amount) private {
        if (!validators[validator].active) revert Unauthorized("INVALID_VALIDATOR");
        _increaseValidatorBalance(validator, amount);
        balances[validator][delegator] += amount;
        StateSyncer._syncStake(validator, amount);
        LiquidStaking._onDelegate(delegator, amount);

        emit Delegated(delegator, validator, amount);
    }

    function _increaseValidatorBalance(address validator, uint256 amount) private {
        _mint(validator, amount);
        _delegate(validator, validator);
    }

    function claimDelegatorReward(address validator, bool restake) external {
        revert("NOT_IMPLEMENTED");
    }

    function claimPositionReward(address validator, uint256 epochNumber, uint256 topUpIndex) external {
        revert("NOT_IMPLEMENTED");
    }

    function cutPosition(address validator, uint256 amount) external {
        revert("NOT_IMPLEMENTED");
    }

    function delegate(address validator, bool restake) external payable {
        revert("NOT_IMPLEMENTED");
    }

    function delegationOf(address validator, address delegator) external view returns (uint256) {
        return balances[validator][delegator];
    }

    function getDelegatorReward(address validator, address delegator) external view returns (uint256) {
        revert("NOT_IMPLEMENTED");
    }

    function openDelegatorPosition(address validator, uint256 durationWeeks) external payable {
        revert("NOT_IMPLEMENTED");
    }

    function topUpPosition(address validator) external payable {
        revert("NOT_IMPLEMENTED");
    }

    function totalDelegationOf(address validator) external view returns (uint256) {
        return balanceOf(validator);
    }

    function undelegate(address validator, uint256 amount) external {
        revert("NOT_IMPLEMENTED");
    }
}
