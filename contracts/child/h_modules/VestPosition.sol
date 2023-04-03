// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./APR.sol";

import "./../modules/CVSDelegation.sol";

// import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

contract VestPosition is Initializable, OwnableUpgradeable {
    struct VestData {
        uint256 amount;
        uint256 end;
        uint256 period; // in weeks
        uint256 bonus; // user apr params
    }

    address public staking;

    mapping(address => VestData) public vestingPerVal;

    event Claimed(address indexed account, uint256 amount);

    constructor() {
        _disableInitializers();
    }

    function initialize(address _staking) public initializer {
        __Ownable_init();
        staking = _staking;
    }

    function delegate(address validator, uint256 _period) external payable onlyOwner {
        VestData storage data = vestingPerVal[validator];
        require(msg.value > 0, "VestPosition: no value");
        require(_period > 0 && _period < 53, "VestPosition: no period");
        require(data.vestingEnd < block.timestamp, "VestPosition: not ended");

        _claim();

        data.amount = msg.value;
        data.end = block.timestamp + (_period * 1 weeks);
        data.period = _period;

        (uint256 base, uint256 vestBonus, uint256 rsiBonus) = APR(staking).getUserParams();

        // TODO: check if it's correct
        data.bonus = base + (vestBonus * rsiBonus) / (10000 * 10000 * 10000);

        CVSDelegation(staking).delegate{value: msg.value}(validator, false);
    }

    function claim(address validator) external onlyOwner {
        VestData storage data = vestingPerVal[validator];
        require(block.timestamp >= data.start, "VestPosition: not started");

        uint256 currentBalance = address(this).balance;
        CVSDelegation(staking).claimDelegatorReward(validator, false);
        uint256 reward = address(this).balance - currentBalance;
        require(reward > 0, "VestPosition: no reward");

        // CONTINUE HERE: calculate the actual reward, withdraw amount from staking

        uint256 amount = (vestingAmount / (vestingEnd - vestingStart)) * vestingInterval;
        vestingClaimed += amount;

        emit Claimed(msg.sender, amount);
        // slither-disable-next-line low-level-calls
        (bool success, ) = msg.sender.call{value: amount}(""); // solhint-disable-line avoid-low-level-calls
        require(success, "VestPosition: claim failed");
    }

    function _claim() private {
        if (vestingClaimed < vestingAmount) {
            uint256 amount = (vestingAmount / (vestingEnd - vestingStart)) * vestingInterval;
            vestingClaimed += amount;

            emit Claimed(msg.sender, amount);
            // slither-disable-next-line low-level-calls
            (bool success, ) = msg.sender.call{value: amount}(""); // solhint-disable-line avoid-low-level-calls
            require(success, "VestPosition: claim failed");
        }
    }
}
