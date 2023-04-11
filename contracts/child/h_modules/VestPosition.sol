// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "../../interfaces/h_modules/IVesting.sol";

contract VestPosition is Initializable, OwnableUpgradeable {
    address public staking;

    event Claimed(address indexed account, uint256 amount);

    constructor() {
        _disableInitializers();
    }

    function initialize(address owner) public initializer {
        _transferOwnership(owner);
        staking = msg.sender;
    }

    function delegate(address validator) external payable onlyOwner {
        IVesting(staking).vestDelegate{value: msg.value}(validator);
    }

    // function undelegate(
    //     address validator,
    //     uint256 amount,
    //     uint256 epochNumber,
    //     uint256 topUpIndex
    // ) external payable onlyOwner {
    //     IVesting(staking).undelegate(validator, amount, epochNumber, topUpIndex);
    // }

    function claimDelegatorReward(
        address validator,
        uint256 epochNumber,
        uint256 topUpIndex
    ) external payable onlyOwner {
        IVesting(staking).vestClaimReward(validator, epochNumber, topUpIndex);
    }

    // function handleTopUp(
    //     address validator,
    //     uint256 epochNumber,
    //     uint256 topUpIndex
    // ) internal returns (TopUpData memory) {
    //     if (topUpIndex >= topUpPerVal[validator].length) {
    //         revert();
    //     }

    //     TopUpData memory topUp = topUpPerVal[validator][topUpIndex];

    //     if (topUp.epochNum > epochNumber) {
    //         revert();
    //     } else if (topUp.epochNum == epochNumber) {
    //         // If topUp is made exactly in the before epoch - it is the valid one for sure
    //     } else {
    //         // This is the case where the topUp is made more than 1 epoch before the handled one (epochNumber)
    //         if (topUpIndex == topUpPerVal[validator].length - 1) {
    //             // If it is the last topUp - don't check does the next one can be better
    //         } else {
    //             // If it is not the last topUp - check does the next one can be better
    //             TopUpData memory nextTopUp = topUpPerVal[validator][topUpIndex + 1];
    //             if (nextTopUp.epochNum < epochNumber) {
    //                 // If the next topUp is made in an epoch before the handled one
    //                 // and is bigger than the provided top - the provided one is not valid
    //                 revert();
    //             }
    //         }
    //     }

    //     return topUp;
    // }

    // function claim(address validator, uint256 epochNumber, uint256 topUpIndex) external onlyOwner {
    //     VestData storage data = vestingPerVal[validator];
    //     uint256 start = data.end - data.period * 1 weeks;
    //     require(block.timestamp >= start, "VestPosition: not started");

    //     if (data.end > block.timestamp) {
    //         revert NoReward();
    //     }

    //     uint256 maturePeriod = block.timestamp - data.end;
    //     uint256 matureTimestamp = start + maturePeriod;

    //     (uint256 epochRPS, uint256 timestamp) = Vesting(staking).historyRPS(validator, epochNumber);
    //     if (timestamp > matureTimestamp) {
    //         revert NoReward();
    //     }

    //     TopUpData memory topUp = handleTopUp(validator, epochNumber, topUpIndex);

    //     uint256 currentBalance = address(this).balance;
    //     CVSDelegation(staking).claimDelegatorReward(validator, false, epochRPS, topUp.balance, topUp.correction);
    //     uint256 reward = address(this).balance - currentBalance;
    //     require(reward > 0, "VestPosition: no reward");

    //     uint256 bonusReward = Vesting(staking).claimBonus(validator);

    //     uint256 amount = reward + bonusReward;

    //     emit Claimed(msg.sender, amount);

    //     (bool success, ) = msg.sender.call{value: amount}("");
    //     require(success, "VestPosition: claim failed");
    // }
}
