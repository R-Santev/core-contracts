// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

// import "./APR.sol";
// import "./Vesting.sol";

// import "./../modules/CVSDelegation.sol";

// error NoReward();

contract VestPosition is Initializable, OwnableUpgradeable {
    // struct VestData {
    //     uint256 amount;
    //     uint256 end;
    //     uint256 period; // in weeks
    //     uint256 bonus; // user apr params
    // }

    // struct TopUpData {
    //     uint256 balance;
    //     int256 correction;
    //     uint256 epochNum;
    // }

    address public staking;

    // mapping(address => VestData) public vestingPerVal;
    // mapping(address => TopUpData[]) public topUpPerVal;

    event Claimed(address indexed account, uint256 amount);

    constructor() {
        _disableInitializers();
    }

    function initialize(address _staking) public initializer {
        __Ownable_init();
        staking = _staking;
    }

    // function delegate(address validator, uint256 _period) external payable onlyOwner {
    //     // VestData storage data = vestingPerVal[validator];
    //     require(msg.value > 0, "VestPosition: no value");
    //     require(_period > 0 && _period < 53, "VestPosition: no period");
    //     require(data.end < block.timestamp, "VestPosition: not ended");

    //     // _claim();

    //     data.amount = msg.value;
    //     data.end = block.timestamp + (_period * 1 weeks);
    //     data.period = _period;

    //     (uint256 base, uint256 vestBonus, uint256 rsiBonus) = APR(staking).getUserParams();

    //     // TODO: check if it's correct
    //     data.bonus = base + (vestBonus * rsiBonus) / (10000 * 10000 * 10000);

    //     CVSDelegation(staking).delegate{value: msg.value}(validator, false);
    // }

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
