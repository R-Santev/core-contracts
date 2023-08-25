// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./../modules/CVSStorage.sol";
import "./../../interfaces/ILiquidityToken.sol";

abstract contract LiquidStaking is CVSStorage {
    function onStake(address staker, uint256 stakedAmount) internal {
        ILiquidityToken(liquidToken).mint(staker, stakedAmount);
    }

    function onUnstake(address staker, uint256 unstakedAmount) internal {
        ILiquidityToken(liquidToken).burn(staker, unstakedAmount);
    }
}
