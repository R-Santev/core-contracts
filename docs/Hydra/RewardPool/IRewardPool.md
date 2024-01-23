# IRewardPool









## Methods

### claimDelegatorReward

```solidity
function claimDelegatorReward(address delegator, address validator) external nonpayable returns (uint256)
```

Claims delegator rewards for sender.



#### Parameters

| Name | Type | Description |
|---|---|---|
| delegator | address | undefined |
| validator | address | Validator to claim from |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | Delegator&#39;s rewards |

### delegationOf

```solidity
function delegationOf(address validator, address delegator) external view returns (uint256)
```

Gets amount delegated by delegator to validator.



#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | Address of validator |
| delegator | address | Address of delegator |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | Amount delegated (in MATIC wei) |

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

### getDelegatorReward

```solidity
function getDelegatorReward(address validator, address delegator) external view returns (uint256)
```

Gets delegators&#39;s unclaimed rewards including rewards



#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | Address of validator |
| delegator | address | Address of delegator |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | Delegator&#39;s unclaimed rewards with validator (in MATIC wei) |

### getRawDelegatorReward

```solidity
function getRawDelegatorReward(address validator, address delegator) external view returns (uint256)
```

Gets delegators&#39;s unclaimed rewards without rewards



#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | Address of validator |
| delegator | address | Address of delegator |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | Delegator&#39;s unclaimed rewards with validator (in MATIC wei) |

### getValidatorReward

```solidity
function getValidatorReward(address validator) external view returns (uint256)
```

Returns the generated rewards for a validator

*Applies penalty (slashing) if the vesting period is active and returns the updated amount*

#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | The address of the validator |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | Delgator&#39;s unclaimed rewards |

### onClaimPositionReward

```solidity
function onClaimPositionReward(address validator, address delegator, uint256 epochNumber, uint256 topUpIndex) external nonpayable returns (uint256 sumReward, uint256 remainder)
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
| sumReward | uint256 | undefined |
| remainder | uint256 | undefined |

### onCreatePool

```solidity
function onCreatePool(address validator) external nonpayable
```

Creates a pool

*Sets the validator of the pool*

#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | The address of the validator |

### onCutPosition

```solidity
function onCutPosition(address validator, address delegator, uint256 amount, uint256 currentEpochId) external nonpayable returns (uint256 penalty, uint256 fullReward)
```

Cuts a vesting position from the delegation pool

*Applies penalty (slashing) if the vesting period is active and returns the updated amount*

#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | The address of the validator |
| delegator | address | The address of the delegator |
| amount | uint256 | Amount to delegate |
| currentEpochId | uint256 | The currenct epoch number |

#### Returns

| Name | Type | Description |
|---|---|---|
| penalty | uint256 | The penalty which will be taken from the delgator&#39;s amount and burned, if the position is active |
| fullReward | uint256 | The full reward that is going to be burned, if the position is active |

### onDelegate

```solidity
function onDelegate(address validator, address delegator, uint256 amount) external nonpayable returns (uint256 reward)
```

Delegates to a validator delegation pool

*Claims rewards and returns it in order to make the withdrawal in the delegation contract*

#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | The address of the validator |
| delegator | address | The address of the delegator |
| amount | uint256 | Amount to delegate |

#### Returns

| Name | Type | Description |
|---|---|---|
| reward | uint256 | Calculates delegator&#39;s unclaimed rewards with validator |

### onNewDelegatePosition

```solidity
function onNewDelegatePosition(address validator, address delegator, uint256 durationWeeks, uint256 currentEpochId, uint256 amount) external nonpayable
```

Sets the reward params for the new vested delegation position



#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | The address of the validator |
| delegator | address | The address of the delegator |
| durationWeeks | uint256 | Vesting duration in weeks |
| currentEpochId | uint256 | The currenct epoch number |
| amount | uint256 | Delegate amount to open position with |

### onNewStakePosition

```solidity
function onNewStakePosition(address staker, uint256 durationWeeks) external nonpayable
```

Sets the reward params for the new vested position



#### Parameters

| Name | Type | Description |
|---|---|---|
| staker | address | Address of the staker |
| durationWeeks | uint256 | Vesting duration in weeks |

### onStake

```solidity
function onStake(address staker, uint256 amount, uint256 oldBalance) external nonpayable
```

Update the reward params for the vested position



#### Parameters

| Name | Type | Description |
|---|---|---|
| staker | address | Address of the staker |
| amount | uint256 | Amount to stake |
| oldBalance | uint256 | Balance before stake |

### onTopUpDelegatePosition

```solidity
function onTopUpDelegatePosition(address validator, address delegator, uint256 currentEpochId, uint256 amount) external nonpayable
```

Top up to a delegate positions



#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | The address of the validator |
| delegator | address | The address of the delegator |
| currentEpochId | uint256 | The currenct epoch number |
| amount | uint256 | Delegate amount to top-up with |

### onUndelegate

```solidity
function onUndelegate(address validator, address delegator, uint256 amount) external nonpayable returns (uint256 reward)
```

Undelegates from the delegation pools and claims rewards

*Returns the reward in order to make the withdrawal in the delegation contract*

#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | The address of the validator |
| delegator | address | The address of the delegator |
| amount | uint256 | Amount to delegate |

#### Returns

| Name | Type | Description |
|---|---|---|
| reward | uint256 | Calculates delegator&#39;s unclaimed rewards with validator |

### onUnstake

```solidity
function onUnstake(address staker, uint256 amountUnstaked, uint256 amountLeft) external nonpayable returns (uint256 amountToWithdraw)
```

Unstakes and updates the reward params for the vested position

*If vested position is active, then it will calculate a penalty in the returned amount*

#### Parameters

| Name | Type | Description |
|---|---|---|
| staker | address | Address of the staker |
| amountUnstaked | uint256 | Unstaked amount |
| amountLeft | uint256 | The staked amount left |

#### Returns

| Name | Type | Description |
|---|---|---|
| amountToWithdraw | uint256 | The calcualted amount to withdraw |

### totalDelegationOf

```solidity
function totalDelegationOf(address validator) external view returns (uint256)
```

Gets the total amount delegated to a validator.



#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | Address of validator |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | Amount delegated (in MATIC wei) |



## Events

### DelegatorRewardClaimed

```solidity
event DelegatorRewardClaimed(address indexed validator, address indexed delegator, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| validator `indexed` | address | undefined |
| delegator `indexed` | address | undefined |
| amount  | uint256 | undefined |

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



