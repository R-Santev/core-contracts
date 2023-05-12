# VestManager









## Methods

### claimPositionReward

```solidity
function claimPositionReward(address validator, uint256 epochNumber, uint256 topUpIndex) external payable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | undefined |
| epochNumber | uint256 | undefined |
| topUpIndex | uint256 | undefined |

### cutPosition

```solidity
function cutPosition(address validator, uint256 amount) external payable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | undefined |
| amount | uint256 | undefined |

### initialize

```solidity
function initialize(address owner) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| owner | address | undefined |

### openDelegatorPosition

```solidity
function openDelegatorPosition(address validator, uint256 durationWeeks) external payable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | undefined |
| durationWeeks | uint256 | undefined |

### owner

```solidity
function owner() external view returns (address)
```



*Returns the address of the current owner.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### renounceOwnership

```solidity
function renounceOwnership() external nonpayable
```



*Leaves the contract without owner. It will not be possible to call `onlyOwner` functions anymore. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby removing any functionality that is only available to the owner.*


### staking

```solidity
function staking() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### topUpPosition

```solidity
function topUpPosition(address validator) external payable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | undefined |

### transferOwnership

```solidity
function transferOwnership(address newOwner) external nonpayable
```



*Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| newOwner | address | undefined |

### withdraw

```solidity
function withdraw(address to) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| to | address | undefined |



## Events

### Claimed

```solidity
event Claimed(address indexed account, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account `indexed` | address | undefined |
| amount  | uint256 | undefined |

### Initialized

```solidity
event Initialized(uint8 version)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| version  | uint8 | undefined |

### OwnershipTransferred

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| previousOwner `indexed` | address | undefined |
| newOwner `indexed` | address | undefined |



