// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "../../interfaces/modules/ICVSWithdrawal.sol";
import "../../interfaces/h_modules/IDelegationVesting.sol";

contract VestManager is Initializable, OwnableUpgradeable {
    address public staking;

    event Claimed(address indexed account, uint256 amount);

    constructor() {
        _disableInitializers();
    }

    function initialize(address owner) public initializer {
        _transferOwnership(owner);
        staking = msg.sender;
    }

    function openDelegatorPosition(address validator, uint256 durationWeeks) external payable onlyOwner {
        IDelegationVesting(staking).openDelegatorPosition{value: msg.value}(validator, durationWeeks);
    }

    function topUpPosition(address validator) external payable onlyOwner {
        IDelegationVesting(staking).topUpPosition{value: msg.value}(validator);
    }

    function cutPosition(address validator, uint256 amount) external payable onlyOwner {
        IDelegationVesting(staking).cutPosition(validator, amount);
    }

    function claimPositionReward(
        address validator,
        uint256 epochNumber,
        uint256 topUpIndex
    ) external payable onlyOwner {
        IDelegationVesting(staking).claimPositionReward(validator, epochNumber, topUpIndex);
    }

    function withdraw(address to) external {
        ICVSWithdrawal(staking).withdraw(to);
    }
}
