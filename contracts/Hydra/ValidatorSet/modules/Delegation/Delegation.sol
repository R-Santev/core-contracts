// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "./DelegationVesting.sol";
import "./../../ValidatorSetBase.sol";
import "./../Staking/StateSyncer.sol";
import "./../Staking/LiquidStaking.sol";
import "./IDelegation.sol";

/**
 * @notice struct representation of a pool for reward distribution
 * @dev pools are formed by delegators to a specific validator
 * @dev uses virtual balances to track slashed delegations
 * @param supply amount of tokens in the pool
 * @param virtualSupply the total supply of virtual balances in the pool
 * @param magnifiedRewardPerShare coefficient to aggregate rewards
 * @param validator the address of the validator the pool based on
 * @param magnifiedRewardCorrections adjustments to reward magnifications by address
 * @param claimedRewards amount claimed by address
 * @param balances virtual balance by address
 */
struct DelegationPool {
    uint256 supply;
    uint256 virtualSupply;
    uint256 magnifiedRewardPerShare;
    address validator;
    mapping(address => int256) magnifiedRewardCorrections;
    mapping(address => uint256) claimedRewards;
    mapping(address => uint256) balances;
}

abstract contract Delegation is
    IDelegation,
    ValidatorSetBase,
    DelegationVesting,
    ERC20VotesUpgradeable,
    LiquidStaking,
    StateSyncer
{
    uint256 public minDelegation;
    mapping(address => DelegationPool) public delegationPools;

    function __Delegation_init(uint256 newMinDelegation) internal onlyInitializing {
        __VestFactory_init();
        __Delegation_init_unchained();
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

    function openDelegationPosition(address validator, uint256 durationWeeks) external payable onlyManager {
        DelegationPool storage delegation = delegationPools[validator];
        if (delegation.balanceOf(msg.sender) + msg.value < minDelegation)
            revert StakeRequirement({src: "vesting", msg: "DELEGATION_TOO_LOW"});

        _delegate(msg.sender, validator, msg.value);

        // ensure previous rewards are claimed
        if (delegation.claimableRewards(msg.sender) > 0) {
            revert StakeRequirement({src: "vesting", msg: "REWARDS_NOT_CLAIMED"});
        }
        rewardPool.claimRewards(msg.sender);
        _openPosition(validator, delegation, durationWeeks);

        emit PositionOpened(msg.sender, validator, durationWeeks, msg.value);
    }

    function _delegate(address delegator, address validator, uint256 amount) private {
        if (!validators[validator].active) revert Unauthorized("INVALID_VALIDATOR");
        _increaseValidatorBalance(validator, amount);
        delegationPools[validator].deposit(delegator, amount);
        StateSyncer._syncStake(validator, amount);
        LiquidStaking._onDelegate(delegator, amount);

        emit Delegated(delegator, validator, amount);
    }

    function _openPosition(address validator, DelegationPool storage delegation, uint256 durationWeeks) internal {
        VestData memory position = vestings[validator][msg.sender];
        if (isMaturingPosition(position)) {
            revert StakeRequirement({src: "vesting", msg: "POSITION_MATURING"});
        }

        if (isActivePosition(vestings[validator][msg.sender])) {
            revert StakeRequirement({src: "vesting", msg: "POSITION_ACTIVE"});
        }

        // If is a position which is not active and not in maturing state,
        // we can recreate/create the position

        uint256 duration = durationWeeks * 1 weeks;

        delete poolParamsChanges[validator][msg.sender];
        delete beforeTopUpParams[validator][msg.sender];

        vestings[validator][msg.sender] = VestData({
            duration: duration,
            start: block.timestamp,
            end: block.timestamp + duration,
            base: getBase(),
            vestBonus: getVestingBonus(durationWeeks),
            rsiBonus: uint248(getRSI())
        });

        // keep the change in the account pool params
        uint256 balance = delegation.balanceOf(msg.sender);
        int256 correction = delegation.correctionOf(msg.sender);
        _onAccountParamsChange(validator, balance, correction);
    }

    function _increaseValidatorBalance(address validator, uint256 amount) private {
        _mint(validator, amount);
        _delegate(validator, validator);
    }
}
