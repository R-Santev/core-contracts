// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "../lib/GenesisLib.sol";

struct Validator {
    uint256[4] blsKey;
    uint256 stake;
    bool isWhitelisted;
    bool isActive;
}

/**
    @title IStakeManager
    @author Based on Polygon Technology (@gretzke)'s IValidatorSet contract
    @notice Manages stakes for all child chains
 */
interface IStakeManager {
    event StakeAdded(uint256 indexed id, address indexed validator, uint256 amount);
    event StakeRemoved(uint256 indexed id, address indexed validator, uint256 amount);
    event StakeWithdrawn(address indexed validator, address indexed recipient, uint256 amount);
    event ValidatorSlashed(uint256 indexed id, address indexed validator, uint256 amount);

    event AddedToWhitelist(address indexed validator);
    event RemovedFromWhitelist(address indexed validator);
    event ValidatorRegistered(address indexed validator, uint256[4] blsKey);
    event ValidatorDeactivated(address indexed validator);
    event GenesisFinalized(uint256 amountValidators);
    event StakingEnabled();

    error Unauthorized(string message);
    error InvalidSignature(address validator);

    /// @notice called by validator to stake
    function stake(uint256 id, uint256 amount) external;

    /// @notice called by validator to release its stake
    function releaseStake(uint256 amount) external;

    /// @notice allows a validator to withdraw released stake
    function withdrawStake(address to, uint256 amount) external;

    /// @notice called by child manager contract to slash a validator's stake
    /// @notice manager collects slashed amount
    function slashStakeOf(address validator, uint256 amount) external;

    /// @notice returns the amount of stake a validator can withdraw
    function withdrawableStake(address validator) external view returns (uint256 amount);

    /// @notice returns the total amount staked
    function totalStake() external view returns (uint256 amount);

    /// @notice returns the amount staked by a validator
    function stakeOf(address validator) external view returns (uint256 amount);

    /// @notice returns the child id for a child chain manager contract
    function idFor(address manager) external view returns (uint256 id);

    /// @notice Allows to whitelist validators that are allowed to stake
    /// @dev only callable by owner
    function whitelistValidators(address[] calldata validators_) external;

    /// @notice registers the public key of a validator
    function register(uint256[2] calldata signature, uint256[4] calldata pubkey) external;

    /// @notice finalizes initial genesis validator set
    /// @dev only callable by owner
    function finalizeGenesis() external;

    /// @notice enables staking after successful initialisation of the child chain
    /// @dev only callable by owner
    function enableStaking() external;

    /// @notice Withdraws slashed MATIC of slashed validators
    /// @dev only callable by owner
    function withdrawSlashedStake(address to) external;

    /// @notice returns the genesis validator set with their balances
    function genesisSet() external view returns (GenesisValidator[] memory);

    /// @notice returns validator instance based on provided address
    function getValidator(address validator_) external view returns (Validator memory);
}
