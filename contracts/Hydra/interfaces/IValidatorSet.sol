// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

struct VestData {
    uint256 duration;
    uint256 start;
    uint256 end;
    uint256 base;
    uint256 vestBonus;
    uint256 rsiBonus;
}

interface IValidatorSet {
    function totalBlocks() external view returns (uint256);
}
