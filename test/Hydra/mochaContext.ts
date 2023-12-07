/* eslint-disable node/no-extraneous-import */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
<<<<<<< HEAD
<<<<<<< HEAD
import { BigNumber, Contract } from "ethers";
=======
import { BigNumber } from "ethers";
>>>>>>> 232c201 (re-structure the tests - create mocha context, create a test that initializing the context and separate each fixture to be responsible for 1 contract;)
=======
import { BigNumber, Contract } from "ethers";
>>>>>>> f7701b1 ([OPTIMIZE] optimize the current architechture with a better one - use context and fixtures combined;)

export interface Signers {
  accounts: SignerWithAddress[];
  admin: SignerWithAddress;
  validators: SignerWithAddress[];
  governance: SignerWithAddress;
  delegator: SignerWithAddress;
}

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> f7701b1 ([OPTIMIZE] optimize the current architechture with a better one - use context and fixtures combined;)
export interface Fixtures {
  validatorSetFixture: { (): Promise<Contract> };
}

declare module "mocha" {
  export interface Context {
    fixtures: Fixtures;
<<<<<<< HEAD
=======
declare module "mocha" {
  export interface Context {
>>>>>>> 232c201 (re-structure the tests - create mocha context, create a test that initializing the context and separate each fixture to be responsible for 1 contract;)
=======
>>>>>>> f7701b1 ([OPTIMIZE] optimize the current architechture with a better one - use context and fixtures combined;)
    signers: Signers;
    epochReward: BigNumber;
    minStake: BigNumber;
    minDelegation: BigNumber;
    epochsInYear: number;
    chainId: number;
  }
}

export function initValidators(accounts: SignerWithAddress[], num: number = 4) {
  if (num > accounts.length) {
    throw new Error("Too many validators");
  }

  const vals: SignerWithAddress[] = [];
  for (let i = 0; i < num; i++) {
    vals[i] = accounts[i];
  }

  return vals;
}
