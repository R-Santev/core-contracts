// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

contract APR {
    uint256 public constant DENOMINATOR = 10000;
    uint256 public constant EPOCHS_YEAR = 31450;

    // TODO: fetch from oracles when they are ready
    function getBase() internal pure returns (uint256 nominator) {
        return 50000;
    }

    // TODO: fetch from oracles when they are ready
    function getVestingBonus(uint256 weeksCount) internal pure returns (uint256 nominator) {
        // Currently represents a week bonus
        return 1000 * weeksCount;
    }

    // TODO: fetch from oracles when they are ready
    function getMacro() internal pure returns (uint256 nominator) {
        return 8000;
    }

    // TODO: fetch from oracles when they are ready
    function getRSI() internal pure returns (uint256 nominator) {
        return 11000;
    }

    // TODO: Ensure the fetched from oracles value is smaller or equal to this
    function getMaxRSI() internal pure returns (uint256 nominator) {
        return 15000;
    }

    function getUserParams() public pure returns (uint256 base, uint256 vesting, uint256 rsi) {
        base = getBase();
        vesting = getVestingBonus(52);
        rsi = getRSI();
    }

    // TODO: fetch from oracles when they are ready
    function getMaxAPR() internal pure returns (uint256 nominator, uint256 denominator) {
        // TODO: Base + vesting and RSI must return the max possible value nere
        uint256 base = getBase();
        uint256 vesting = getVestingBonus(52);
        uint256 rsiBonusFactor = getRSI();
        // TODO: Macro must return the right value for that epoch
        uint256 macroFactor = getMacro();

        uint256 result = ((((((base + vesting) * magnitude()) / 10000) * macroFactor) / 10000) * rsiBonusFactor) /
            10000;

        return (result, magnitude());
    }

    function getEpochReward(uint256 totalStaked) internal pure returns (uint256 reward) {
        uint256 nominator;
        uint256 denominator;

        (nominator, denominator) = getMaxAPR();

        // Divide to 100 because nominator represents a percent value
        return (totalStaked * nominator) / denominator / 100 / EPOCHS_YEAR;
    }

    function applyMacro(uint256 totalStaked) internal pure returns (uint256 reward) {
        uint256 macroFactor = getMacro();

        return (totalStaked * macroFactor) / DENOMINATOR;
    }

    function _applyBaseAPR(uint256 amount) internal pure returns (uint256) {
        uint256 base = getBase();
        return (amount * base) / DENOMINATOR;
    }

    function magnitude() internal pure returns (uint256) {
        return 1e18;
    }
}
