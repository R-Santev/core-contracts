// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Faucet is Ownable {
    uint256 public withdrawalAmount = 100 * (10 ** 18);
    uint256 public lockTime = 2 hours; // Default cooling time
    mapping(address => uint256) public nextAccessTime;

    event Distribution(address indexed to, uint256 amount);
    event Received(address indexed from, uint256 amount);

    function requestHYDRA() public {
        require(msg.sender != address(0), "must be non-zero addr");

        require(block.timestamp > nextAccessTime[msg.sender], "insufficient cooldown");

        nextAccessTime[msg.sender] = block.timestamp + lockTime;

        sendHYDRA(msg.sender, withdrawalAmount);

        emit Distribution(msg.sender, withdrawalAmount);
    }

    function sendHYDRA(address to, uint256 amount) public {
        (bool sent, ) = payable(to).call{value: amount}("");
        require(sent, "Failed to send Ether");
    }

    /**
     * @notice Setting Withdrawal Amount.
     * @param amount amount of HYDRA to withdraw.
     *
     */
    function setWithdrawalAmount(uint256 amount) public onlyOwner {
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
    function claimHYDRA() public onlyOwner {
        sendHYDRA(owner(), address(this).balance);
    }

    /**
     * @notice Setting the cooling time.
     */
    function setLockTime(uint8 time) public onlyOwner {
        lockTime = time * 1 hours;
    }
}
