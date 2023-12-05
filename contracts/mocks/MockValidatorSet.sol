// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./../Hydra/ValidatorSet/ValidatorSet.sol";

/**
 * @title MockValidatorSet
 * @dev Mock contract allowing improved testing of ValidatorSet
 * It just adds read functions to check the state of the ValidatorSet contract
 */
contract MockValidatorSet is ValidatorSet {
    // using ValidatorStorageLib for ValidatorTree;
    // using ValidatorQueueLib for ValidatorQueue;
    // using RewardPoolLib for RewardPool;
    using SafeMathUint for uint256;

    function getRawDelegatorReward(address validator, address delegator) external view returns (uint256) {
        // return validators.getDelegationPool(validator).claimableRewards(delegator);
        return 0;
    }
}
