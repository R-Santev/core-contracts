# CVSDelegation









## Methods

### ACTIVE_VALIDATOR_SET_SIZE

```solidity
function ACTIVE_VALIDATOR_SET_SIZE() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### DENOMINATOR

```solidity
function DENOMINATOR() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### DOMAIN

```solidity
function DOMAIN() external view returns (bytes32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined |

### EPOCHS_YEAR

```solidity
function EPOCHS_YEAR() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### MAX_COMMISSION

```solidity
function MAX_COMMISSION() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### WITHDRAWAL_WAIT_PERIOD

```solidity
function WITHDRAWAL_WAIT_PERIOD() external view returns (uint256)
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

### bls

```solidity
function bls() external view returns (contract IBLS)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IBLS | undefined |

### claimDelegatorReward

```solidity
function claimDelegatorReward(address validator, bool restake) external nonpayable
```

Don&#39;t execute in case reward after _applyCustomReward() is 0 because pool.claimRewards() will delete the accumulated reward but you will not receive anything



#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | Validator to claim from |
| restake | bool | Whether to redelegate the claimed rewards |

### currentEpochId

```solidity
function currentEpochId() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### delegate

```solidity
function delegate(address validator, bool restake) external payable
```

Delegates sent amount to validator. Claims rewards beforehand.



#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | Validator to delegate to |
| restake | bool | Whether to redelegate the claimed rewards |

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

### epochEndBlocks

```solidity
function epochEndBlocks(uint256) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### epochReward

```solidity
function epochReward() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### epochSize

```solidity
function epochSize() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### epochs

```solidity
function epochs(uint256) external view returns (uint256 startBlock, uint256 endBlock, bytes32 epochRoot)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| startBlock | uint256 | undefined |
| endBlock | uint256 | undefined |
| epochRoot | bytes32 | undefined |

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

### getDelegatorReward

```solidity
function getDelegatorReward(address validator, address delegator) external view returns (uint256)
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

### getValidator

```solidity
function getValidator(address validator) external view returns (uint256[4] blsKey, uint256 stake, uint256 totalStake, uint256 commission, uint256 withdrawableRewards, bool active)
```

Gets validator by address.



#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| blsKey | uint256[4] | BLS public key |
| stake | uint256 | self-stake |
| totalStake | uint256 | self-stake + delegation |
| commission | uint256 | commission |
| withdrawableRewards | uint256 | withdrawable rewards |
| active | bool | activity status |

### getValidatorTotalStake

```solidity
function getValidatorTotalStake(address validator) external view returns (uint256 stake, uint256 totalStake)
```

A function to return the total stake together with the pending stake H_MODIFY: Temporary fix to address the new way the node fetches the validators state It checks for transfer events and sync the stake change with the node But a check is made after every block and the changes are applied from the next epoch Also it doesn&#39;t update the balance of the validator based on the amount emmited in the event but fetches the balance from the contract. That&#39;s why we apply the pending balance here



#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | Address of the validator |

#### Returns

| Name | Type | Description |
|---|---|---|
| stake | uint256 | undefined |
| totalStake | uint256 | undefined |

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

### implementation

```solidity
function implementation() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### liquidToken

```solidity
function liquidToken() external view returns (address)
```

Returns the address of the liquidity token.




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### minDelegation

```solidity
function minDelegation() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### minStake

```solidity
function minStake() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### pendingWithdrawals

```solidity
function pendingWithdrawals(address account) external view returns (uint256)
```

Calculates how much is yet to become withdrawable for account.



#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | The account to calculate amount for |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | Amount not yet withdrawable (in MATIC wei) |

### powerExponent

```solidity
function powerExponent() external view returns (uint128 value, uint128 pendingValue)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| value | uint128 | undefined |
| pendingValue | uint128 | undefined |

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

### undelegate

```solidity
function undelegate(address validator, uint256 amount) external nonpayable
```

Undelegates amount from validator for sender. Claims rewards beforehand.



#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | Validator to undelegate from |
| amount | uint256 | The amount to undelegate |

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

### whitelist

```solidity
function whitelist(address) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### withdraw

```solidity
function withdraw(address to) external nonpayable
```

Withdraws sender&#39;s withdrawable amount to specified address.



#### Parameters

| Name | Type | Description |
|---|---|---|
| to | address | Address to withdraw to |

### withdrawable

```solidity
function withdrawable(address account) external view returns (uint256 amount)
```

Calculates how much can be withdrawn for account in this epoch.



#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | The account to calculate amount for |

#### Returns

| Name | Type | Description |
|---|---|---|
| amount | uint256 | Amount withdrawable (in MATIC wei) |



## Events

### Delegated

```solidity
event Delegated(address indexed delegator, address indexed validator, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| delegator `indexed` | address | undefined |
| validator `indexed` | address | undefined |
| amount  | uint256 | undefined |

### DelegatorRewardClaimed

```solidity
event DelegatorRewardClaimed(address indexed delegator, address indexed validator, bool indexed restake, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| delegator `indexed` | address | undefined |
| validator `indexed` | address | undefined |
| restake `indexed` | bool | undefined |
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

### Transfer

```solidity
event Transfer(address indexed from, address indexed to, uint256 value)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| from `indexed` | address | undefined |
| to `indexed` | address | undefined |
| value  | uint256 | undefined |

### Undelegated

```solidity
event Undelegated(address indexed delegator, address indexed validator, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| delegator `indexed` | address | undefined |
| validator `indexed` | address | undefined |
| amount  | uint256 | undefined |

### Withdrawal

```solidity
event Withdrawal(address indexed account, address indexed to, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account `indexed` | address | undefined |
| to `indexed` | address | undefined |
| amount  | uint256 | undefined |

### WithdrawalRegistered

```solidity
event WithdrawalRegistered(address indexed account, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account `indexed` | address | undefined |
| amount  | uint256 | undefined |



## Errors

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


