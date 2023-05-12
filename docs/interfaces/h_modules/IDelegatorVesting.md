# IDelegatorVesting









## Methods

### claimPositionReward

```solidity
function claimPositionReward(address validator, uint256 epochNumber, uint256 topUpIndex) external nonpayable
```

Claims delegator rewards for sender.



#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | Validator to claim from |
| epochNumber | uint256 | Epoch where the last claimable reward is distributed. We need it because not all rewards are matured at the moment of claiming. |
| topUpIndex | uint256 | Whether to redelegate the claimed rewards |

### cutPosition

```solidity
function cutPosition(address validator, uint256 amount) external nonpayable
```

Undelegates amount from validator. Apply penalty in case vesting is not finished. Can be called by vesting positions&#39; managers only.



#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | Validator to undelegate from |
| amount | uint256 | Amount to be undelegated |

### newManager

```solidity
function newManager() external nonpayable
```

Creates new vesting manager which owner is the caller. Every new instance is proxy leading to base impl, so minimal fees are applied. Only Vesting manager can use the vesting functionality, so users need to create a manager first to be able to vest.




### openDelegatorPosition

```solidity
function openDelegatorPosition(address validator, uint256 durationWeeks) external payable
```

Delegates sent amount to validator. Set vesting position data. Delete old top-ups data if exists. Can be called by vesting positions&#39; managers only.



#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | Validator to delegate to |
| durationWeeks | uint256 | Duration of the vesting in weeks |

### topUpPosition

```solidity
function topUpPosition(address validator) external payable
```

Delegates sent amount to validator. Add top-up data. Modify vesting position data. Can be called by vesting positions&#39; managers only.



#### Parameters

| Name | Type | Description |
|---|---|---|
| validator | address | Validator to delegate to |



## Events

### PositionCut

```solidity
event PositionCut(address indexed manager, address indexed validator, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| manager `indexed` | address | undefined |
| validator `indexed` | address | undefined |
| amount  | uint256 | undefined |

### PositionOpened

```solidity
event PositionOpened(address indexed manager, address indexed validator, uint256 indexed weeksDuration, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| manager `indexed` | address | undefined |
| validator `indexed` | address | undefined |
| weeksDuration `indexed` | uint256 | undefined |
| amount  | uint256 | undefined |

### PositionRewardClaimed

```solidity
event PositionRewardClaimed(address indexed manager, address indexed validator, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| manager `indexed` | address | undefined |
| validator `indexed` | address | undefined |
| amount  | uint256 | undefined |

### PositionTopUp

```solidity
event PositionTopUp(address indexed manager, address indexed validator, uint256 indexed topUpIndex, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| manager `indexed` | address | undefined |
| validator `indexed` | address | undefined |
| topUpIndex `indexed` | uint256 | undefined |
| amount  | uint256 | undefined |



