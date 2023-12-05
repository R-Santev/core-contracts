# IRewardPool









## Methods

### distributeRewardsFor

```solidity
function distributeRewardsFor(uint256 epochId, Epoch epoch, Uptime[] uptime, uint256 epochSize) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| epochId | uint256 | undefined |
| epoch | Epoch | undefined |
| uptime | Uptime[] | undefined |
| epochSize | uint256 | undefined |

### isActivePosition

```solidity
function isActivePosition(address staker) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| staker | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### isMaturingPosition

```solidity
function isMaturingPosition(address staker) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| staker | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### isStakerInVestingCycle

```solidity
function isStakerInVestingCycle(address staker) external view returns (bool)
```

Returns true if the staker is an active vesting position or not all rewards from the latest  active position are matured yet



#### Parameters

| Name | Type | Description |
|---|---|---|
| staker | address | Address of the staker |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### onNewDelegatePosition

```solidity
function onNewDelegatePosition(address validator, address delegator, uint256 durationWeeks, uint256 currentEpochId, uint256 newBalance) external nonpayable
```

sets the reward params for the new vested delegation position



#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | undefined |
| delegator | address | undefined |
| durationWeeks | uint256 | undefined |
| currentEpochId | uint256 | undefined |
| newBalance | uint256 | undefined |

### onNewPosition

```solidity
function onNewPosition(address staker, uint256 durationWeeks) external nonpayable
```

sets the reward params for the new vested position



#### Parameters

| Name | Type | Description |
|---|---|---|
| staker | address | undefined |
| durationWeeks | uint256 | undefined |

### onStake

```solidity
function onStake(address staker, uint256 oldBalance) external nonpayable
```

update the reward params for the vested position



#### Parameters

| Name | Type | Description |
|---|---|---|
| staker | address | undefined |
| oldBalance | uint256 | undefined |

### onTopUpDelegatePosition

```solidity
function onTopUpDelegatePosition(address validator, address delegator, uint256 newBalance, uint256 currentEpochId) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | undefined |
| delegator | address | undefined |
| newBalance | uint256 | undefined |
| currentEpochId | uint256 | undefined |

### onUnstake

```solidity
function onUnstake(address staker, uint256 amountUnstaked, uint256 amountLeft) external nonpayable returns (uint256 amountToWithdraw)
```

update the reward params for the new vested position.



#### Parameters

| Name | Type | Description |
|---|---|---|
| staker | address | undefined |
| amountUnstaked | uint256 | undefined |
| amountLeft | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| amountToWithdraw | uint256 | undefined |



## Events

### DelegatorRewardDistributed

```solidity
event DelegatorRewardDistributed(address indexed validator, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| validator `indexed` | address | undefined |
| amount  | uint256 | undefined |

### ValidatorRewardClaimed

```solidity
event ValidatorRewardClaimed(address indexed validator, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| validator `indexed` | address | undefined |
| amount  | uint256 | undefined |

### ValidatorRewardDistributed

```solidity
event ValidatorRewardDistributed(address indexed validator, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| validator `indexed` | address | undefined |
| amount  | uint256 | undefined |



