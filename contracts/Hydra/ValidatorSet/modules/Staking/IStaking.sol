// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IStaking {
    event NewValidator(address indexed validator, uint256[4] blsKey);
    event CommissionUpdated(address indexed validator, uint256 oldCommission, uint256 newCommission);
    event Staked(address indexed validator, uint256 amount);
    event Unstaked(address indexed validator, uint256 amount);
    event ValidatorRewardClaimed(address indexed validator, uint256 amount);
    event ValidatorRewardDistributed(address indexed validator, uint256 amount);
    event ValidatorDeactivated(address indexed validator);

    /**
     * @notice Validates BLS signature with the provided pubkey and registers validators into the set.
     * @param signature Signature to validate message against
     * @param pubkey BLS public key of validator
     */
    function register(uint256[2] calldata signature, uint256[4] calldata pubkey) external;

    /**
     * @notice Stakes sent amount. Claims rewards beforehand.
     */
    function stake() external payable;

    /**
     * @notice Unstakes amount for sender. Claims rewards beforehand.
     * @param amount Amount to unstake
     */
    function unstake(uint256 amount) external;

    /**
     * @notice Sets commission for validator.
     * @param newCommission New commission (100 = 100%)
     */
    function setCommission(uint256 newCommission) external;

    /**
     * @notice Calculates total stake in the network (self-stake + delegation).
     * @return Total stake (in MATIC wei)
     */
    function totalStake() external view returns (uint256);

    /**
     * @notice Gets validator's total stake (self-stake + delegation).
     * @param validator Address of validator
     * @return Validator's total stake (in MATIC wei)
     */
    function totalStakeOf(address validator) external view returns (uint256);
}
