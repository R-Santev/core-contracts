// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IStaking {
    event NewValidator(address indexed validator, uint256[4] blsKey);
    event CommissionUpdated(address indexed validator, uint256 oldCommission, uint256 newCommission);
    event Staked(address indexed validator, uint256 amount);
    event Unstaked(address indexed validator, uint256 amount);
    event ValidatorDeactivated(address indexed validator);

    /**
     * @notice Validates BLS signature with the provided pubkey and registers validators into the set.
     * @param signature Signature to validate message against
     * @param pubkey BLS public key of validator
     */
    function register(uint256[2] calldata signature, uint256[4] calldata pubkey) external;

    /**
     * @notice Opens vested staking position
     * @param durationWeeks Duration of position in weeks. Must be between 1 and 52.
     */
    function openVestedPosition(uint256 durationWeeks) external payable;

    /**
     * @notice Stakes sent amount.
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
     * @notice Gets all active validators.
     * @return Returns array of addresses of all active validators
     */
    function getValidators() external view returns (address[] memory);
}
