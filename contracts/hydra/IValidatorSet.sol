// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

struct ValidatorInit {
    address addr;
    uint256 stake;
}

struct Epoch {
    uint256 startBlock;
    uint256 endBlock;
    bytes32 epochRoot;
}

/**
    @title IValidatorSet
    @author Based on Polygon Technology (@gretzke)'s IValidatorSet contract
    @notice Manages voting power for validators and commits epochs for child chains
 */
interface IValidatorSet {
    event NewEpoch(uint256 indexed id, uint256 indexed startBlock, uint256 indexed endBlock, bytes32 epochRoot);
    event Slashed(uint256 indexed exitId, address[] validators);
    event WithdrawalRegistered(address indexed account, uint256 amount);
    event Withdrawal(address indexed account, uint256 amount);

    /// @notice commits a new epoch
    /// @dev system call
    function commitEpoch(uint256 id, Epoch calldata epoch, uint256 epochSize) external;

    /// @notice initialises slashing process
    /// @dev system call,
    /// @dev given list of validators are slashed on L2
    /// subsequently after their stake is slashed on L1
    /// @param validators list of validators to be slashed
    function slash(address[] calldata validators) external;

    /// @notice allows a validator to announce their intention to withdraw a given amount of tokens
    /// @dev initializes a waiting period before the tokens can be withdrawn
    function unstake(uint256 amount) external;

    /// @notice allows a validator to complete a withdrawal
    /// @dev calls the bridge to release the funds on root
    function withdraw() external;

    /// @notice total amount of blocks in a given epoch
    function totalBlocks(uint256 epochId) external view returns (uint256 length);

    /// @notice returns a validator balance for a given epoch
    function balanceOfAt(address account, uint256 epochNumber) external view returns (uint256);

    /// @notice returns the total supply for a given epoch
    function totalSupplyAt(uint256 epochNumber) external view returns (uint256);

    /**
     * @notice Calculates how much can be withdrawn for account in this epoch.
     * @param account The account to calculate amount for
     * @return Amount withdrawable (in MATIC wei)
     */
    function withdrawable(address account) external view returns (uint256);

    /**
     * @notice Calculates how much is yet to become withdrawable for account.
     * @param account The account to calculate amount for
     * @return Amount not yet withdrawable (in MATIC wei)
     */
    function pendingWithdrawals(address account) external view returns (uint256);
}
