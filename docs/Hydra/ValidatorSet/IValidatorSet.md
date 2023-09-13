# IValidatorSet









## Methods

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

### stakePositionOf

```solidity
function stakePositionOf(address validator) external view returns (struct VestData)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | VestData | undefined |

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



## Events

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



