// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./ILiquidStaking.sol";
import "./../../ValidatorSetBase.sol";
import "./../../../LiquidityToken/ILiquidityToken.sol";

abstract contract LiquidStaking is ILiquidStaking, ValidatorSetBase {
    /// Liquid Staking token given to stakers and delegators
    address internal _liquidToken;

    function __LiquidStaking_init(address newLiquidToken) internal onlyInitializing {
        __LiquidStaking_init_unchained(newLiquidToken);
    }

    function __LiquidStaking_init_unchained(address newLiquidToken) internal onlyInitializing {
        _liquidToken = newLiquidToken;
    }

    function liquidToken() external view override returns (address) {
        return _liquidToken;
    }

    function _distributeTokens(address staker, uint256 stakedAmount) internal {
        _mintTokens(staker, stakedAmount);
    }

    function _collectTokens(address staker, uint256 unstakedAmount) internal {
        // User needs to burn the liquid tokens for slashed stake as well
        uint256 liquidDebt = validators[msg.sender].liquidDebt;
        if (liquidDebt > 0) {
            validators[msg.sender].liquidDebt = 0;
            unstakedAmount += liquidDebt;
        }

        _burnTokens(staker, unstakedAmount);
    }

    function _onDelegate(address delegator, uint256 stakedAmount) internal {
        _mintTokens(delegator, stakedAmount);
    }

    function _onUndelegate(address delegator, uint256 unstakedAmount) internal {
        _burnTokens(delegator, unstakedAmount);
    }

    function _mintTokens(address account, uint256 amount) private {
        ILiquidityToken(_liquidToken).mint(account, amount);
    }

    function _burnTokens(address account, uint256 amount) private {
        ILiquidityToken(_liquidToken).burn(account, amount);
    }

    // slither-disable-next-line unused-state,naming-convention
    uint256[50] private __gap;
}
