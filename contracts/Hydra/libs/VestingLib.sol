// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./../interfaces/IValidatorSet.sol";

library VestingLib {
    function isActive(VestData memory position) internal view returns (bool) {
        return position.start < block.timestamp && block.timestamp < position.end;
    }
}
