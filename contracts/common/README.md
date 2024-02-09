# Common

##### Base contracts inherited by more than one contract

This directory contains a number of base contracts which are inherited in more than one contract.

The contracts in this directory are:

- `BN256G2.sol`: BN256 curve functions (this is the curve we use for BLS)

There is extensive natspec on the contracts, along with markdown docs automatically generated from the natspec in the [`docs/`](../../docs/) directory at the project root. We'll provide a high-level overview of the contracts here.

## `BN256G2.sol`

BLS needs a curve. We use the BN256 curve. This contract exposes the mathematical functions needed to interact with the curve.
