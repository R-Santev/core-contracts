/* eslint-disable node/no-extraneous-import */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
<<<<<<< HEAD
import { BigNumber, Contract } from "ethers";
=======
import { BigNumber } from "ethers";
>>>>>>> 232c201 (re-structure the tests - create mocha context, create a test that initializing the context and separate each fixture to be responsible for 1 contract;)

export interface Signers {
  accounts: SignerWithAddress[];
  admin: SignerWithAddress;
  validators: SignerWithAddress[];
  governance: SignerWithAddress;
  delegator: SignerWithAddress;
}

<<<<<<< HEAD
export interface Fixtures {
  validatorSetFixture: { (): Promise<Contract> };
}

declare module "mocha" {
  export interface Context {
    fixtures: Fixtures;
=======
declare module "mocha" {
  export interface Context {
>>>>>>> 232c201 (re-structure the tests - create mocha context, create a test that initializing the context and separate each fixture to be responsible for 1 contract;)
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
