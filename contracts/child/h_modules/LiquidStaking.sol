// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./../modules/CVSStorage.sol";
import "../../libs/ValidatorStorage.sol";
import "./../../interfaces/ILiquidityToken.sol";

abstract contract LiquidStaking is CVSStorage {
    using ValidatorStorageLib for ValidatorTree;

    function _onStake(address staker, uint256 stakedAmount) internal {
        _mintTokens(staker, stakedAmount);
    }

    function _onUnstake(address staker, uint256 unstakedAmount) internal {
        // User needs to burn the liquid tokens for slashed stake as well
        uint256 liquidDebt = _validators.get(msg.sender).liquidDebt;
        if (liquidDebt > 0) {
            _validators.get(msg.sender).liquidDebt = 0;
            unstakedAmount += liquidDebt;
        }

        _burnTokens(staker, unstakedAmount);
    }

    function _onDelegate(address staker, uint256 stakedAmount) internal {
        _mintTokens(staker, stakedAmount);
    }

    function _onUndelegate(address staker, uint256 unstakedAmount) internal {
        _burnTokens(staker, unstakedAmount);
    }

    function _mintTokens(address account, uint256 amount) private {
        ILiquidityToken(liquidToken).mint(account, amount);
    }

    function _burnTokens(address account, uint256 amount) private {
        ILiquidityToken(liquidToken).burn(account, amount);
    }
}
