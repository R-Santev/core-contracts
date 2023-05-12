# Vesting









## Methods

### DENOMINATOR

```solidity
function DENOMINATOR() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### EPOCHS_YEAR

```solidity
function EPOCHS_YEAR() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### applyMaxReward

```solidity
function applyMaxReward(uint256 reward) external pure returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| reward | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### getBase

```solidity
function getBase() external pure returns (uint256 nominator)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| nominator | uint256 | undefined |

### getDefaultRSI

```solidity
function getDefaultRSI() external pure returns (uint256 nominator)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| nominator | uint256 | undefined |

### getMacro

```solidity
function getMacro() external pure returns (uint256 nominator)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| nominator | uint256 | undefined |

### getMaxRSI

```solidity
function getMaxRSI() external pure returns (uint256 nominator)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| nominator | uint256 | undefined |

### getRSI

```solidity
function getRSI() external pure returns (uint256 nominator)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| nominator | uint256 | undefined |

### getUserParams

```solidity
function getUserParams() external pure returns (uint256 base, uint256 vesting, uint256 rsi)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| base | uint256 | undefined |
| vesting | uint256 | undefined |
| rsi | uint256 | undefined |

### getVestingBonus

```solidity
function getVestingBonus(uint256 weeksCount) external pure returns (uint256 nominator)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| weeksCount | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| nominator | uint256 | undefined |

### isActivePosition

```solidity
function isActivePosition(Vesting.VestData position) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| position | Vesting.VestData | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### isMaturingPosition

```solidity
function isMaturingPosition(Vesting.VestData position) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| position | Vesting.VestData | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### vestings

```solidity
function vestings(address, address) external view returns (uint256 duration, uint256 start, uint256 end, uint256 base, uint256 vestBonus, uint256 rsiBonus)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |
| _1 | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| duration | uint256 | undefined |
| start | uint256 | undefined |
| end | uint256 | undefined |
| base | uint256 | undefined |
| vestBonus | uint256 | undefined |
| rsiBonus | uint256 | undefined |




