// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./IValidatorSet.sol";
import "../../interfaces/IBLS.sol";
import "./../common/Errors.sol";
import "./../RewardPool/IRewardPool.sol";

//base implemetantion to be used by proxies
// address public implementation;

// H_MODIFY: Set base implementation for VestFactory
// implementation = address(new VestManager());

abstract contract ValidatorSetBase is Initializable {
    bytes32 public constant DOMAIN = keccak256("DOMAIN_VALIDATOR_SET");

    // slither-disable-next-line naming-convention
    mapping(address => Validator) public validators;

    IBLS public bls;
    IRewardPool public rewardPool;

    uint256 public currentEpochId;

    function __ValidatorSetBase_init(IBLS newBls, IRewardPool newRewardPool) internal onlyInitializing {
        __ValidatorSetBase_init(newBls, newRewardPool);
    }

    function __ValidatorSetBase_init_unchained(IBLS newBls, IRewardPool newRewardPool) internal onlyInitializing {
        bls = newBls;
        rewardPool = newRewardPool;
        currentEpochId = 1;
    }

    event NewEpoch(uint256 indexed id, uint256 indexed startBlock, uint256 indexed endBlock, bytes32 epochRoot);

    function _verifyValidatorRegistration(
        address signer,
        uint256[2] calldata signature,
        uint256[4] calldata pubkey
    ) internal view {
        // slither-disable-next-line calls-loop
        (bool result, bool callSuccess) = bls.verifySingle(signature, pubkey, message(signer));
        if (!callSuccess || !result) revert InvalidSignature(signer);
    }

    /// @notice Message to sign for registration
    function message(address signer) internal view returns (uint256[2] memory) {
        // slither-disable-next-line calls-loop
        return bls.hashToPoint(DOMAIN, abi.encodePacked(signer, block.chainid));
    }

    // slither-disable-next-line unused-state,naming-convention
    uint256[50] private __gap;
}
