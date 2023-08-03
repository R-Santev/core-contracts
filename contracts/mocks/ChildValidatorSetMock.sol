// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./../child/ChildValidatorSet.sol";

/**
 * @title ChildValidatorSetMock
 * @dev Mock contract allowing improved testing of ChildValidatorSet
 * It just adds read functions to check the state of the ChildValidatorSet contract
 */
contract ChildValidatorSetMock is ChildValidatorSet {
    using ValidatorStorageLib for ValidatorTree;
    using ValidatorQueueLib for ValidatorQueue;
    using RewardPoolLib for RewardPool;
    using SafeMathUint for uint256;

    function getRawDelegatorReward(address validator, address delegator) external view returns (uint256) {
        return _validators.getDelegationPool(validator).claimableRewards(delegator);
    }
}
