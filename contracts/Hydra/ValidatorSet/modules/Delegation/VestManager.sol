// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./IDelegation.sol";
import "./../Withdrawal/IWithdrawal.sol";
import "./../Staking/ILiquidStaking.sol";

contract VestManager is Initializable, OwnableUpgradeable {
    using SafeERC20 for IERC20;

    /// @notice The staking address
    address public staking;

    // _______________ Events _______________

    event Claimed(address indexed account, uint256 amount);

    constructor() {
        _disableInitializers();
    }

    // _______________ Initializer _______________

    function initialize(address owner) public initializer {
        _transferOwnership(owner);
        staking = msg.sender;
    }

    // _______________ External functions _______________

    function openDelegatorPosition(address validator, uint256 durationWeeks) external payable onlyOwner {
        IDelegation(staking).openDelegatePosition{value: msg.value}(validator, durationWeeks);

        _sendLiquidTokens(msg.sender, msg.value);
    }

    function topUpPosition(address validator) external payable onlyOwner {
        IDelegation(staking).topUpDelegatePosition{value: msg.value}(validator);

        _sendLiquidTokens(msg.sender, msg.value);
    }

    function cutPosition(address validator, uint256 amount) external payable onlyOwner {
        _fulfillLiquidTokens(msg.sender, amount);

        IDelegation(staking).cutDelegatePosition(validator, amount);
    }

    function claimPositionReward(
        address validator,
        uint256 epochNumber,
        uint256 topUpIndex
    ) external payable onlyOwner {
        IDelegation(staking).claimPositionReward(validator, epochNumber, topUpIndex);
    }

    function withdraw(address to) external {
        IWithdrawal(staking).withdraw(to);
    }

    // _______________ Public functions _______________

    // _______________ Internal functions _______________

    // _______________ Private functions _______________

    /**
     * Sends the received after stake liquid tokens to the position owner
     * @param positionOwner Owner of the position (respectively of the position manager)
     * @param amount staked amount
     */
    function _sendLiquidTokens(address positionOwner, uint256 amount) private onlyOwner {
        address liquidToken = ILiquidStaking(staking).liquidToken();
        IERC20(liquidToken).safeTransfer(positionOwner, amount);
    }

    /**
     * Fulfill position with the needed liquid tokens
     * @param positionOwner Owner of the position (respectively of the position manager)
     * @param amount Amount to be unstaked
     */
    function _fulfillLiquidTokens(address positionOwner, uint256 amount) private onlyOwner {
        address liquidToken = ILiquidStaking(staking).liquidToken();
        IERC20(liquidToken).safeTransferFrom(positionOwner, address(this), amount);
    }
}
