// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

contract APR {
    uint256 public constant DENOMINATOR = 10000;
    uint256 public constant EPOCHS_YEAR = 31500;

    uint256[52] public vestingBonus = [
        6,
        16,
        30,
        46,
        65,
        85,
        108,
        131,
        157,
        184,
        212,
        241,
        272,
        304,
        338,
        372,
        407,
        444,
        481,
        520,
        559,
        599,
        641,
        683,
        726,
        770,
        815,
        861,
        907,
        955,
        1003,
        1052,
        1101,
        1152,
        1203,
        1255,
        1307,
        1361,
        1415,
        1470,
        1525,
        1581,
        1638,
        1696,
        1754,
        1812,
        1872,
        1932,
        1993,
        2054,
        2116,
        2178
    ];

    // TODO: fetch from oracles when they are ready
    function getBase() public pure returns (uint256 nominator) {
        return 500;
    }

    function getVestingBonus(uint256 weeksCount) public view returns (uint256 nominator) {
        return vestingBonus[weeksCount - 1];
    }

    // TODO: fetch from oracles when they are ready
    function getMacro() public pure returns (uint256 nominator) {
        return 7500;
    }

    // TODO: fetch from oracles when they are ready
    function getRSI() public pure returns (uint256 nominator) {
        return 11000;
    }

    function getDefaultRSI() public pure returns (uint256 nominator) {
        return DENOMINATOR;
    }

    // TODO: Ensure the fetched from oracles value is smaller or equal to this
    function getMaxRSI() public pure returns (uint256 nominator) {
        return 15000;
    }

    function getMaxAPR() public view returns (uint256 nominator, uint256 denominator) {
        // TODO: Base + vesting and RSI must return the max possible value here (implement max base)
        uint256 base = getBase();
        uint256 vesting = getVestingBonus(52);
        uint256 rsiBonusFactor = getMaxRSI();
        // TODO: Macro must return the right value for that epoch
        uint256 macroFactor = getMacro();

        nominator = (base + vesting) * macroFactor * rsiBonusFactor;
        denominator = 10000 * 10000 * 10000;
    }

    function applyMaxReward(uint256 reward) public view returns (uint256) {
        // TODO: Consider setting max base
        uint256 base = getBase();
        uint256 rsi = getMaxRSI();
        // max vesting bonus is 52 weeks
        uint256 vestBonus = getVestingBonus(52);

        uint256 bonus = (base + vestBonus) * rsi;

        return (reward * bonus) / (10000 * 10000);
    }

    // TODO: Apply EPOCHS_IN_YEAR everywhere it is needed

    function getEpochMaxReward(uint256 totalStaked) public view returns (uint256 reward) {
        uint256 nominator;
        uint256 denominator;

        (nominator, denominator) = getMaxAPR();

        // Divide to EPOCHS_YEAR because result is yearly
        return (totalStaked * nominator) / denominator / EPOCHS_YEAR;
    }

    // TODO: Calculate per epoch - currently yearly reward is used
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

    function _applyCustomReward(uint256 reward) internal pure returns (uint256) {
        return _applyBaseAPR(reward);
    }
}
