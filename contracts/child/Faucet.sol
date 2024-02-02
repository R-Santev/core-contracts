// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/Errors.sol";

error InsufficientCooldown();

contract Faucet is AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("manager_role");

    uint256 public withdrawalAmount = 100 * (10 ** 18);
    uint256 public lockTime = 2 hours; // Default cooling time
    mapping(address => uint256) public nextAccessTime;

    event Distribution(address indexed to, uint256 amount);
    event Received(address indexed from, uint256 amount);

    constructor(address manager) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, manager);
    }

    function requestHYDRA(address account) public onlyRole(MANAGER_ROLE) {
        if (account == address(0)) revert ZeroAddress();

        if (block.timestamp < nextAccessTime[account]) revert InsufficientCooldown();

        nextAccessTime[account] = block.timestamp + lockTime;

        _sendHYDRA(account, withdrawalAmount);

        emit Distribution(account, withdrawalAmount);
    }

    function _sendHYDRA(address to, uint256 amount) private {
        (bool sent, ) = payable(to).call{value: amount}("");
        if (!sent) revert SendFailed();
    }

    /**
     * @notice Setting Withdrawal Amount.
     * @param amount amount of HYDRA to withdraw.
     *
     */
    function setWithdrawalAmount(uint256 amount) public onlyRole(DEFAULT_ADMIN_ROLE) {
        withdrawalAmount = amount * (10 ** 18);
    }

    /**
     * @notice Users can send HYDRA to the contract.
     */
    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    /**
     * @notice Claim the whole HYDRA balance.
     */
    function claimHYDRA() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _sendHYDRA(msg.sender, address(this).balance);
    }

    /**
     * @notice Setting the cooling time.
     */
    function setLockTime(uint8 time) public onlyRole(DEFAULT_ADMIN_ROLE) {
        lockTime = time * 1 hours;
    }
}
