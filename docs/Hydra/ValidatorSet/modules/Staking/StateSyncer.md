# StateSyncer



> StateSyncer

This contract is used to emit a specific event on stake, unstake, delegate and undelegate; Child chain listen for this event to sync the state of the validators




## Events

### TransferStake

```solidity
event TransferStake(address indexed from, address indexed to, uint256 value)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| from `indexed` | address | undefined |
| to `indexed` | address | undefined |
| value  | uint256 | undefined |



