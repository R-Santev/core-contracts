// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract APR is Initializable, AccessControl {
    uint256 public constant DENOMINATOR = 10000;
    uint256 public constant EPOCHS_YEAR = 31500;
    bytes32 public constant MANAGER_ROLE = keccak256("manager_role");

    uint256 public base;
    uint256 public macroFactor;
    uint256 public rsi;
    uint256[52] public vestingBonus;

    function __APR_init(address manager) internal onlyInitializing {
        initializeVestingBonus();

        _grantRole(DEFAULT_ADMIN_ROLE, manager);
        _grantRole(MANAGER_ROLE, manager);
    }

    function setBase(uint256 newBase) public onlyRole(MANAGER_ROLE) {
        base = newBase;
    }

    function getVestingBonus(uint256 weeksCount) public view returns (uint256 nominator) {
        return vestingBonus[weeksCount - 1];
    }

    function setMacro(uint256 newMacroFactor) public onlyRole(MANAGER_ROLE) {
        macroFactor = newMacroFactor;
    }

    function setRSI(uint256 newRSI) public onlyRole(MANAGER_ROLE) {
        require(newRSI <= getMaxRSI(), "TOO_HIGH_RSI");

        rsi = newRSI;
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
        uint256 vesting = getVestingBonus(52);
        uint256 rsiBonusFactor = getMaxRSI();

        nominator = (base + vesting) * macroFactor * rsiBonusFactor;
        denominator = 10000 * 10000 * 10000;
    }

    function applyMaxReward(uint256 reward) public view returns (uint256) {
        // TODO: Consider setting max base
        // max vesting bonus is 52 weeks
        uint256 maxRSI = getMaxRSI();
        uint256 vestBonus = getVestingBonus(52);

        uint256 bonus = (base + vestBonus) * maxRSI;

        return ((reward * bonus) / (10000 * 10000)) / EPOCHS_YEAR;
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
    function applyMacro(uint256 totalStaked) internal view returns (uint256 reward) {
        return (totalStaked * macroFactor) / DENOMINATOR;
    }

    function magnitude() internal pure returns (uint256) {
        return 1e18;
    }

    function _applyCustomReward(uint256 reward) internal view returns (uint256) {
        return _applyBaseAPR(reward) / EPOCHS_YEAR;
    }

    function _applyBaseAPR(uint256 amount) private view returns (uint256) {
        return (amount * base) / DENOMINATOR;
    }

    function initializeVestingBonus() private {
        vestingBonus[0] = 6;
        vestingBonus[1] = 16;
        vestingBonus[2] = 30;
        vestingBonus[3] = 46;
        vestingBonus[4] = 65;
        vestingBonus[5] = 85;
        vestingBonus[6] = 108;
        vestingBonus[7] = 131;
        vestingBonus[8] = 157;
        vestingBonus[9] = 184;
        vestingBonus[10] = 212;
        vestingBonus[11] = 241;
        vestingBonus[12] = 272;
        vestingBonus[13] = 304;
        vestingBonus[14] = 338;
        vestingBonus[15] = 372;
        vestingBonus[16] = 407;
        vestingBonus[17] = 444;
        vestingBonus[18] = 481;
        vestingBonus[19] = 520;
        vestingBonus[20] = 559;
        vestingBonus[21] = 599;
        vestingBonus[22] = 641;
        vestingBonus[23] = 683;
        vestingBonus[24] = 726;
        vestingBonus[25] = 770;
        vestingBonus[26] = 815;
        vestingBonus[27] = 861;
        vestingBonus[28] = 907;
        vestingBonus[29] = 955;
        vestingBonus[30] = 1003;
        vestingBonus[31] = 1052;
        vestingBonus[32] = 1101;
        vestingBonus[33] = 1152;
        vestingBonus[34] = 1203;
        vestingBonus[35] = 1255;
        vestingBonus[36] = 1307;
        vestingBonus[37] = 1361;
        vestingBonus[38] = 1415;
        vestingBonus[39] = 1470;
        vestingBonus[40] = 1525;
        vestingBonus[41] = 1581;
        vestingBonus[42] = 1638;
        vestingBonus[43] = 1696;
        vestingBonus[44] = 1754;
        vestingBonus[45] = 1812;
        vestingBonus[46] = 1872;
        vestingBonus[47] = 1932;
        vestingBonus[48] = 1993;
        vestingBonus[49] = 2054;
        vestingBonus[50] = 2116;
        vestingBonus[51] = 2178;
    }
}
