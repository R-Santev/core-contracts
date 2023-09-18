// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

/**
 * @title StateSyncer
 * @notice This contract is used to emit a specific event on stake, unstake, delegate and undelegate;
 * Child chain listen for this event to sync the state of the validators
 */
abstract contract StateSyncer {
    event TransferStake(address indexed from, address indexed to, uint256 value);

    /**
     * @notice Emit a transfer event on stake
     * @param staker The address of the staker
     * @param amount The amount of tokens staked
     * @dev Use on delegate as well
     */
    function _syncStake(address staker, uint256 amount) internal {
        emit TransferStake(address(0), staker, amount);
    }

    /**
     * @notice Emit a transfer event on unstake
     * @param amount The amount of tokens unstaked
     * @dev Use on undelegate as well
     */
    function _syncUnstake(address staker, uint256 amount) internal {
        emit TransferStake(staker, address(0), amount);
    }
}
