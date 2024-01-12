# Faucet









## Methods

### claimHYDRA

```solidity
function claimHYDRA() external nonpayable
```

Claim the whole HYDRA balance.




### lockTime

```solidity
function lockTime() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### nextAccessTime

```solidity
function nextAccessTime(address) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

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



*Leaves the contract without owner. It will not be possible to call `onlyOwner` functions. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby disabling any functionality that is only available to the owner.*


### requestHYDRA

```solidity
function requestHYDRA() external nonpayable
```






### sendHYDRA

```solidity
function sendHYDRA(address to, uint256 amount) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| to | address | undefined |
| amount | uint256 | undefined |

### setLockTime

```solidity
function setLockTime(uint8 time) external nonpayable
```

Setting the cooling time.



#### Parameters

| Name | Type | Description |
|---|---|---|
| time | uint8 | undefined |

### setWithdrawalAmount

```solidity
function setWithdrawalAmount(uint256 amount) external nonpayable
```

Setting Withdrawal Amount.



#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | amount of HYDRA to withdraw. |

### transferOwnership

```solidity
function transferOwnership(address newOwner) external nonpayable
```



*Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| newOwner | address | undefined |

### withdrawalAmount

```solidity
function withdrawalAmount() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |



## Events

### Distribution

```solidity
event Distribution(address indexed to, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| to `indexed` | address | undefined |
| amount  | uint256 | undefined |

### OwnershipTransferred

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| previousOwner `indexed` | address | undefined |
| newOwner `indexed` | address | undefined |

### Received

```solidity
event Received(address indexed from, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| from `indexed` | address | undefined |
| amount  | uint256 | undefined |



