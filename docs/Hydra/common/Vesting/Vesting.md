# Vesting









## Methods

### DOMAIN

```solidity
function DOMAIN() external view returns (bytes32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined |

### balanceOfAt

```solidity
function balanceOfAt(address account, uint256 epochNumber) external view returns (uint256)
```

returns a validator balance for a given epoch



#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined |
| epochNumber | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### bls

```solidity
function bls() external view returns (contract IBLS)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IBLS | undefined |

### currentEpochId

```solidity
function currentEpochId() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### getDelegationPoolOf

```solidity
function getDelegationPoolOf(address validator) external view returns (address)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### onRewardClaimed

```solidity
function onRewardClaimed(address validator, uint256 amount) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | undefined |
| amount | uint256 | undefined |

### rewardPool

```solidity
function rewardPool() external view returns (contract IRewardPool)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IRewardPool | undefined |

### totalBlocks

```solidity
function totalBlocks(uint256 epochId) external view returns (uint256 length)
```

total amount of blocks in a given epoch



#### Parameters

| Name | Type | Description |
|---|---|---|
| epochId | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| length | uint256 | undefined |

### totalSupplyAt

```solidity
function totalSupplyAt(uint256 epochNumber) external view returns (uint256)
```

returns the total supply for a given epoch



#### Parameters

| Name | Type | Description |
|---|---|---|
| epochNumber | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### validators

```solidity
function validators(address) external view returns (uint256 liquidDebt, uint256 commission, bool active, bool whitelisted)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| liquidDebt | uint256 | undefined |
| commission | uint256 | undefined |
| active | bool | undefined |
| whitelisted | bool | undefined |



## Events

### Initialized

```solidity
event Initialized(uint8 version)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| version  | uint8 | undefined |

### NewEpoch

```solidity
event NewEpoch(uint256 indexed id, uint256 indexed startBlock, uint256 indexed endBlock, bytes32 epochRoot)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| id `indexed` | uint256 | undefined |
| startBlock `indexed` | uint256 | undefined |
| endBlock `indexed` | uint256 | undefined |
| epochRoot  | bytes32 | undefined |



