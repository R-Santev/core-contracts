/* eslint-disable node/no-extraneous-import */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber, BigNumberish, ContractTransaction } from "ethers";
import { BLS, LiquidityToken, RewardPool, System, ValidatorSet } from "../../typechain-types";

export interface Signers {
  accounts: SignerWithAddress[];
  admin: SignerWithAddress;
  validators: SignerWithAddress[];
  governance: SignerWithAddress;
  delegator: SignerWithAddress;
  rewardWallet: SignerWithAddress;
  system: SignerWithAddress;
}

export interface Fixtures {
  systemFixture: { (): Promise<System> };
  presetValidatorSetStateFixture: {
    (): Promise<{
      validatorSet: ValidatorSet;
      systemValidatorSet: ValidatorSet;
      bls: BLS;
      rewardPool: RewardPool;
      liquidToken: LiquidityToken;
    }>;
  };
  initializedValidatorSetStateFixture: {
    (): Promise<{
      validatorSet: ValidatorSet;
      systemValidatorSet: ValidatorSet;
      bls: BLS;
      rewardPool: RewardPool;
      liquidToken: LiquidityToken;
    }>;
  };
  commitEpochTxFixture: {
    (): Promise<{
      validatorSet: ValidatorSet;
      systemValidatorSet: ValidatorSet;
      bls: BLS;
      rewardPool: RewardPool;
      liquidToken: LiquidityToken;
      commitEpochTx: ContractTransaction;
    }>;
  };
  whitelistedValidatorsStateFixture: {
    (): Promise<{
      validatorSet: ValidatorSet;
      systemValidatorSet: ValidatorSet;
      bls: BLS;
      rewardPool: RewardPool;
      liquidToken: LiquidityToken;
    }>;
  };
  registeredValidatorsStateFixture: {
    (): Promise<{
      validatorSet: ValidatorSet;
      systemValidatorSet: ValidatorSet;
      bls: BLS;
      rewardPool: RewardPool;
      liquidToken: LiquidityToken;
    }>;
  };
  stakedValidatorsStateFixture: {
    (): Promise<{
      validatorSet: ValidatorSet;
      systemValidatorSet: ValidatorSet;
      bls: BLS;
      rewardPool: RewardPool;
      liquidToken: LiquidityToken;
    }>;
  };
  withdrawableFixture: {
    (): Promise<{
      validatorSet: ValidatorSet;
      systemValidatorSet: ValidatorSet;
      bls: BLS;
      rewardPool: RewardPool;
      liquidToken: LiquidityToken;
    }>;
  };
}

declare module "mocha" {
  export interface Context {
    fixtures: Fixtures;
    signers: Signers;
    uptime: any;
    epochId: BigNumber;
    epochSize: BigNumber;
    epochReward: BigNumber;
    epoch: {
      startBlock: BigNumber;
      endBlock: BigNumber;
      epochRoot: Uint8Array;
    };
    minStake: BigNumber;
    minDelegation: BigNumber;
    epochsInYear: number;
    chainId: number;
    validatorInit: {
      addr: string;
      pubkey: [BigNumberish, BigNumberish, BigNumberish, BigNumberish];
      signature: [BigNumberish, BigNumberish];
      stake: BigNumberish;
    };
  }
}

export function initValidators(accounts: SignerWithAddress[], from: number = 0, to: number = 4) {
  if (to > accounts.length) {
    throw new Error("Too many validators");
  }

  const validators: SignerWithAddress[] = [];
  for (let i = from; i <= to; i++) {
    validators.push(accounts[i]);
  }

  return validators;
}
