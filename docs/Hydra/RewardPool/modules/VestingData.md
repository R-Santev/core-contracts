# VestingData









## Methods

### DEFAULT_ADMIN_ROLE

```solidity
function DEFAULT_ADMIN_ROLE() external view returns (bytes32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined |

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

### MANAGER_ROLE

```solidity
function MANAGER_ROLE() external view returns (bytes32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined |

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

### base

```solidity
function base() external view returns (uint256)
```






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

### getRoleAdmin

```solidity
function getRoleAdmin(bytes32 role) external view returns (bytes32)
```



*Returns the admin role that controls `role`. See {grantRole} and {revokeRole}. To change a role&#39;s admin, use {_setRoleAdmin}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role | bytes32 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined |

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



#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | Address of the staker |

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

### grantRole

```solidity
function grantRole(bytes32 role, address account) external nonpayable
```



*Grants `role` to `account`. If `account` had not been already granted `role`, emits a {RoleGranted} event. Requirements: - the caller must have ``role``&#39;s admin role. May emit a {RoleGranted} event.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role | bytes32 | undefined |
| account | address | undefined |

### hasRole

```solidity
function hasRole(bytes32 role, address account) external view returns (bool)
```



*Returns `true` if `account` has been granted `role`.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role | bytes32 | undefined |
| account | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

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

### macroFactor

```solidity
function macroFactor() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

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

### renounceRole

```solidity
function renounceRole(bytes32 role, address account) external nonpayable
```



*Revokes `role` from the calling account. Roles are often managed via {grantRole} and {revokeRole}: this function&#39;s purpose is to provide a mechanism for accounts to lose their privileges if they are compromised (such as when a trusted device is misplaced). If the calling account had been revoked `role`, emits a {RoleRevoked} event. Requirements: - the caller must be `account`. May emit a {RoleRevoked} event.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role | bytes32 | undefined |
| account | address | undefined |

### revokeRole

```solidity
function revokeRole(bytes32 role, address account) external nonpayable
```



*Revokes `role` from `account`. If `account` had been granted `role`, emits a {RoleRevoked} event. Requirements: - the caller must have ``role``&#39;s admin role. May emit a {RoleRevoked} event.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role | bytes32 | undefined |
| account | address | undefined |

### rsi

```solidity
function rsi() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### setBase

```solidity
function setBase(uint256 newBase) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| newBase | uint256 | undefined |

### setMacro

```solidity
function setMacro(uint256 newMacroFactor) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| newMacroFactor | uint256 | undefined |

### setRSI

```solidity
function setRSI(uint256 newRSI) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| newRSI | uint256 | undefined |

### supportsInterface

```solidity
function supportsInterface(bytes4 interfaceId) external view returns (bool)
```



*See {IERC165-supportsInterface}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| interfaceId | bytes4 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

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

### RoleAdminChanged

```solidity
event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| role `indexed` | bytes32 | undefined |
| previousAdminRole `indexed` | bytes32 | undefined |
| newAdminRole `indexed` | bytes32 | undefined |

### RoleGranted

```solidity
event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| role `indexed` | bytes32 | undefined |
| account `indexed` | address | undefined |
| sender `indexed` | address | undefined |

### RoleRevoked

```solidity
event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| role `indexed` | bytes32 | undefined |
| account `indexed` | address | undefined |
| sender `indexed` | address | undefined |

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



