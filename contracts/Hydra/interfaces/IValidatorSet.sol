// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

struct UptimeData {
    address validator;
    uint256 signedBlocks;
}

struct Uptime {
    uint256 epochId;
    UptimeData[] uptimeData;
    uint256 totalBlocks;
}

struct Epoch {
    uint256 startBlock;
    uint256 endBlock;
    bytes32 epochRoot;
}

struct VestData {
    uint256 duration;
    uint256 start;
    uint256 end;
    uint256 base;
    uint256 vestBonus;
    uint256 rsiBonus;
}

struct Validator {
    uint256[4] blsKey;
    uint256 stake;
    uint256 liquidDebt;
    uint256 commission;
    bool active;
}

interface IValidatorSet {
    function totalBlocks() external view returns (uint256);

    /// @notice returns a validator balance for a given epoch
    function balanceOfAt(address account, uint256 epochNumber) external view returns (uint256);

    /// @notice returns the total supply for a given epoch
    function totalSupplyAt(uint256 epochNumber) external view returns (uint256);

    function getDelegationPoolOf(address validator) external view returns (address);

    function stakePositionOf(address validator) external view returns (VestData memory);
}
