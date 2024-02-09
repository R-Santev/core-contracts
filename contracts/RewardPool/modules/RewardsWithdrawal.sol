// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

contract RewardsWithdrawal {
    event RewardsWithdrawn(address indexed account, uint256 amount);

    function _withdrawRewards(address to, uint256 amount) internal {
        (bool success, ) = to.call{value: amount}("");
        require(success, "WITHDRAWAL_FAILED");

        emit RewardsWithdrawn(to, amount);
    }
}
