# RewardPool









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

### NATIVE_TOKEN_CONTRACT

```solidity
function NATIVE_TOKEN_CONTRACT() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### NATIVE_TRANSFER_PRECOMPILE

```solidity
function NATIVE_TRANSFER_PRECOMPILE() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### NATIVE_TRANSFER_PRECOMPILE_GAS

```solidity
function NATIVE_TRANSFER_PRECOMPILE_GAS() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### SYSTEM

```solidity
function SYSTEM() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### VALIDATOR_PKCHECK_PRECOMPILE

```solidity
function VALIDATOR_PKCHECK_PRECOMPILE() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### VALIDATOR_PKCHECK_PRECOMPILE_GAS

```solidity
function VALIDATOR_PKCHECK_PRECOMPILE_GAS() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### applyMaxReward

```solidity
function applyMaxReward(uint256 reward) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| reward | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### beforeTopUpParams

```solidity
function beforeTopUpParams(address, address) external view returns (uint256 rewardPerShare, uint256 balance, int256 correction)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |
| _1 | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| rewardPerShare | uint256 | undefined |
| balance | uint256 | undefined |
| correction | int256 | undefined |

### claimDelegatorReward

```solidity
function claimDelegatorReward(address validator, address delegator) external nonpayable returns (uint256)
```

Claims delegator rewards for sender.



#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | Validator to claim from |
| delegator | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | Delegator&#39;s rewards |

### claimValidatorReward

```solidity
function claimValidatorReward(uint256 rewardHistoryIndex) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| rewardHistoryIndex | uint256 | undefined |

### claimValidatorReward

```solidity
function claimValidatorReward() external nonpayable
```






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

### delegationPoolParamsHistory

```solidity
function delegationPoolParamsHistory(address, address, uint256) external view returns (uint256 balance, int256 correction, uint256 epochNum)
```

Historical Validator Delegation Pool&#39;s Params per delegator



#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |
| _1 | address | undefined |
| _2 | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| balance | uint256 | undefined |
| correction | int256 | undefined |
| epochNum | uint256 | undefined |

### delegationPools

```solidity
function delegationPools(address) external view returns (uint256 supply, uint256 virtualSupply, uint256 magnifiedRewardPerShare, address validator)
```

Keeps the delegation pools



#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| supply | uint256 | undefined |
| virtualSupply | uint256 | undefined |
| magnifiedRewardPerShare | uint256 | undefined |
| validator | address | undefined |

### delegationPositions

```solidity
function delegationPositions(address, address) external view returns (uint256 duration, uint256 start, uint256 end, uint256 base, uint256 vestBonus, uint256 rsiBonus)
```

The vesting positions for every delegator.



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

### getEpochMaxReward

```solidity
function getEpochMaxReward(uint256 totalStaked) external view returns (uint256 reward)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| totalStaked | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| reward | uint256 | undefined |

### getMacro

```solidity
function getMacro() external pure returns (uint256 nominator)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| nominator | uint256 | undefined |

### getMaxAPR

```solidity
function getMaxAPR() external view returns (uint256 nominator, uint256 denominator)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| nominator | uint256 | undefined |
| denominator | uint256 | undefined |

### getMaxRSI

```solidity
function getMaxRSI() external pure returns (uint256 nominator)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| nominator | uint256 | undefined |

### getRPSValues

```solidity
function getRPSValues(address validator, uint256 currentEpochId) external view returns (struct RPS[])
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | undefined |
| currentEpochId | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | RPS[] | undefined |

### getRSI

```solidity
function getRSI() external pure returns (uint256 nominator)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| nominator | uint256 | undefined |

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

### getValRewardsHistoryValues

```solidity
function getValRewardsHistoryValues(address validator) external view returns (struct ValRewardHistory[])
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | ValRewardHistory[] | undefined |

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

### getVestingBonus

```solidity
function getVestingBonus(uint256 weeksCount) external view returns (uint256 nominator)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| weeksCount | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| nominator | uint256 | undefined |

### historyRPS

```solidity
function historyRPS(address, uint256) external view returns (uint192 value, uint64 timestamp)
```

Keeps the history of the RPS for the validators



#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |
| _1 | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| value | uint192 | undefined |
| timestamp | uint64 | undefined |

### initialize

```solidity
function initialize(contract IValidatorSet newValidatorSet, address newRewardWallet, uint256 newMinDelegation) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| newValidatorSet | contract IValidatorSet | undefined |
| newRewardWallet | address | undefined |
| newMinDelegation | uint256 | undefined |

### isActiveDelegatePosition

```solidity
function isActiveDelegatePosition(address validator, address delegator) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | undefined |
| delegator | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

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

### isBalanceChangeMade

```solidity
function isBalanceChangeMade(address validator, address delegator, uint256 currentEpochNum) external view returns (bool)
```

Checks if balance change was already made in the current epoch



#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | Validator to delegate to |
| delegator | address | undefined |
| currentEpochNum | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### isMaturingDelegatePosition

```solidity
function isMaturingDelegatePosition(address validator, address delegator) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | undefined |
| delegator | address | undefined |

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





#### Parameters

| Name | Type | Description |
|---|---|---|
| staker | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### minDelegation

```solidity
function minDelegation() external view returns (uint256)
```

The minimum delegation amount to be delegated




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

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

### paidRewardPerEpoch

```solidity
function paidRewardPerEpoch(uint256) external view returns (uint256)
```

Mapping used to keep the paid rewards per epoch



#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### positions

```solidity
function positions(address) external view returns (uint256 duration, uint256 start, uint256 end, uint256 base, uint256 vestBonus, uint256 rsiBonus)
```

The vesting positions for every validator



#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| duration | uint256 | undefined |
| start | uint256 | undefined |
| end | uint256 | undefined |
| base | uint256 | undefined |
| vestBonus | uint256 | undefined |
| rsiBonus | uint256 | undefined |

### rewardWallet

```solidity
function rewardWallet() external view returns (address)
```

Reward Wallet




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

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

### valRewardHistory

```solidity
function valRewardHistory(address, uint256) external view returns (uint256 totalReward, uint256 epoch, uint256 timestamp)
```

Keeps the rewards history of the validators



#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |
| _1 | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| totalReward | uint256 | undefined |
| epoch | uint256 | undefined |
| timestamp | uint256 | undefined |

### valRewards

```solidity
function valRewards(address) external view returns (uint256 taken, uint256 total)
```

The validator rewards mapped to a validator&#39;s address



#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| taken | uint256 | undefined |
| total | uint256 | undefined |

### validatorSet

```solidity
function validatorSet() external view returns (contract IValidatorSet)
```

The address of the ValidatorSet contract




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IValidatorSet | undefined |

### vestingBonus

```solidity
function vestingBonus(uint256) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |



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

### Initialized

```solidity
event Initialized(uint8 version)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| version  | uint8 | undefined |

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



## Errors

### DelegateRequirement

```solidity
error DelegateRequirement(string src, string msg)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| src | string | undefined |
| msg | string | undefined |

### NoTokensDelegated

```solidity
error NoTokensDelegated(address validator)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | undefined |

### StakeRequirement

```solidity
error StakeRequirement(string src, string msg)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| src | string | undefined |
| msg | string | undefined |

### Unauthorized

```solidity
error Unauthorized(string only)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| only | string | undefined |


