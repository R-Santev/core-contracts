# IRewardPool









## Methods

### claimDelegatorReward

```solidity
function claimDelegatorReward(address delegator, address validator, bool restake) external nonpayable returns (uint256)
```

Claims delegator rewards for sender.



#### Parameters

| Name | Type | Description |
|---|---|---|
| delegator | address | undefined |
| validator | address | Validator to claim from |
| restake | bool | Whether to redelegate the claimed rewards |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

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

### getDelegationPoolSupplyOf

```solidity
function getDelegationPoolSupplyOf(address validator) external view returns (uint256)
```

returns the supply of the delegation pool of the requested validator



#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | the address of the validator whose pool is being queried |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | supply of the delegation pool |

### getValidatorReward

```solidity
function getValidatorReward(address validator) external view returns (uint256)
```

Returns the generated rewards for a validator



#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | Address of the staker |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### onClaimPositionReward

```solidity
function onClaimPositionReward(address validator, address delegator, uint256 epochNumber, uint256 topUpIndex) external nonpayable returns (uint256)
```

Claims delegator rewards for sender.



#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | Validator to claim from |
| delegator | address | Delegator to claim for |
| epochNumber | uint256 | Epoch where the last claimable reward is distributed. We need it because not all rewards are matured at the moment of claiming. |
| topUpIndex | uint256 | Whether to redelegate the claimed rewards |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### onCutPosition

```solidity
function onCutPosition(address validator, address delegator, uint256 amount, uint256 delegatedAmount, uint256 currentEpochId) external nonpayable returns (uint256)
```

cuts a vesting position from the delegation pool

*applies penalty (slashing) if the vesting period is active and returns the updated amount*

#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | undefined |
| delegator | address | undefined |
| amount | uint256 | undefined |
| delegatedAmount | uint256 | undefined |
| currentEpochId | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### onGetDelegatorReward

```solidity
function onGetDelegatorReward(address validator, address delegator) external view returns (uint256)
```

Gets delegators&#39;s unclaimed rewards with validator.



#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | Address of validator |
| delegator | address | Address of delegator |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | Delegator&#39;s unclaimed rewards with validator (in MATIC wei) |

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
function onStake(address staker, uint256 amount, uint256 oldBalance) external nonpayable
```

update the reward params for the vested position



#### Parameters

| Name | Type | Description |
|---|---|---|
| staker | address | undefined |
| amount | uint256 | undefined |
| oldBalance | uint256 | undefined |

### onTopUpDelegatePosition

```solidity
function onTopUpDelegatePosition(address validator, address delegator, uint256 newBalance, uint256 currentEpochId) external nonpayable
```

top up to a delegate positions



#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | undefined |
| delegator | address | undefined |
| newBalance | uint256 | undefined |
| currentEpochId | uint256 | undefined |

### onUndelegate

```solidity
function onUndelegate(address delegator, address validator, uint256 amount) external nonpayable returns (uint256 reward)
```

withdraws from the delegation pools and claims rewards

*returns the reward in order to make the withdrawal in the delegation contract*

#### Parameters

| Name | Type | Description |
|---|---|---|
| delegator | address | undefined |
| validator | address | undefined |
| amount | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| reward | uint256 | undefined |

### onUnstake

```solidity
function onUnstake(address staker, uint256 amountUnstaked, uint256 amountLeft) external nonpayable returns (uint256 amountToWithdraw)
```

update the reward params for the new vested position



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



