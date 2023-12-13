# RewardPoolContract









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






### delegationPoolParamsHistory

```solidity
function delegationPoolParamsHistory(address, address, uint256) external view returns (uint256 balance, int256 correction, uint256 epochNum)
```





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

### getRSI

```solidity
function getRSI() external pure returns (uint256 nominator)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| nominator | uint256 | undefined |

### getValidatorReward

```solidity
function getValidatorReward(address validator) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

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
function initialize(contract IValidatorSet newValidatorSet, address newRewardWallet) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| newValidatorSet | contract IValidatorSet | undefined |
| newRewardWallet | address | undefined |

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
function isBalanceChangeMade(address validator, uint256 currentEpochNum) external view returns (bool)
```

Checks if balance change was already made in the current epoch



#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | Validator to delegate to |
| currentEpochNum | uint256 | undefined |

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

### paidRewardPerEpoch

```solidity
function paidRewardPerEpoch(uint256) external view returns (uint256)
```





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






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### valRewardHistory

```solidity
function valRewardHistory(address, uint256) external view returns (uint256 totalReward, uint256 epoch, uint256 timestamp)
```





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


