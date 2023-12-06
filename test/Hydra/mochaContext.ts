/* eslint-disable node/no-extraneous-import */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "ethers";

export interface Signers {
  accounts: SignerWithAddress[];
  admin: SignerWithAddress;
  validators: SignerWithAddress[];
  governance: SignerWithAddress;
  delegator: SignerWithAddress;
}

declare module "mocha" {
  export interface Context {
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
