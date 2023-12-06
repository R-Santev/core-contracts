// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./../Hydra/ValidatorSet/ValidatorSet.sol";

/**
 * @title MockValidatorSet
 * @dev Mock contract allowing improved testing of ValidatorSet
 * It just adds read functions to check the state of the ValidatorSet contract
 */
contract MockValidatorSet is ValidatorSet {
    using SafeMathUint for uint256;

    function getRawDelegatorReward(address validator, address delegator) external view returns (uint256) {
        // TODO: get the claimable rewards
        // old code: return validators.getDelegationPool(validator).claimableRewards(delegator);
        return 0;
    }
}
