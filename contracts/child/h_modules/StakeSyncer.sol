// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./../modules/CVSStorage.sol";

/**
 * @title StakeSyncer
 * @notice This contract is used to emit a specific event on stake, unstake, delegate and undelegate;
 * Child chain listen for this event to sync the state of the validators
 */
abstract contract StakeSyncer is CVSStorage {
    event StakeChanged(address indexed validator, uint256 newStake);

    /**
     * @notice Emit a StakeChanged event on stake
     * @param staker The address of the staker
     * @dev Use on delegate as well
     */
    function _syncStake(address staker) internal {
        (, uint256 totalStake) = getValidatorTotalStake(staker);
        emit StakeChanged(staker, totalStake);
    }
}
