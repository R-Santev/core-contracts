// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./IValidatorSet.sol";
import "../../interfaces/IBLS.sol";
import "./../common/Errors.sol";

abstract contract ValidatorSetBase {
    event NewEpoch(uint256 indexed id, uint256 indexed startBlock, uint256 indexed endBlock, bytes32 epochRoot);

    bytes32 public constant DOMAIN = keccak256("DOMAIN_VALIDATOR_SET");

    // slither-disable-next-line naming-convention
    ValidatorTree internal _validators;

    uint256 public currentEpochId;

    //base implemetantion to be used by proxies
    address public implementation;

    IBLS public bls;

    // // Liquid Staking token given to stakers and delegators
    // address internal _liquidToken;

    // slither-disable-next-line unused-state,naming-convention
    uint256[50] private __gap;

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
}
