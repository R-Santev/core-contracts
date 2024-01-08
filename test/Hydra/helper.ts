/* eslint-disable node/no-extraneous-import */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import * as hre from "hardhat";
import { BigNumber } from "ethers";

import * as mcl from "../../ts/mcl";
import { RewardPool, ValidatorSet } from "../../typechain-types";
import { CHAIN_ID, DOMAIN } from "./constants";

interface RewardParams {
  timestamp: BigNumber;
}

export async function getMaxEpochReward(validatorSet: ValidatorSet, epochId: BigNumber) {
  const totalStake = await validatorSet.totalSupplyAt(epochId);
  return totalStake;
}

export async function commitEpochs(
  systemValidatorSet: ValidatorSet,
  rewardPool: RewardPool,
  validators: SignerWithAddress[],
  numOfEpochsToCommit: number,
  epochSize: BigNumber
) {
  if (epochSize.isZero() || numOfEpochsToCommit === 0) return;

  for (let i = 0; i < numOfEpochsToCommit; i++) {
    const currEpochId = await systemValidatorSet.currentEpochId();
    const prevEpochId = currEpochId.sub(1);
    const previousEpoch = await systemValidatorSet.epochs(prevEpochId);
    const newEpoch = {
      startBlock: previousEpoch.endBlock.add(1),
      endBlock: previousEpoch.endBlock.add(epochSize),
      epochRoot: hre.ethers.utils.randomBytes(32),
    };

    const validatorsUptime = [];
    for (const validator of validators) {
      validatorsUptime.push({ validator: validator.address, signedBlocks: 64 });
    }

    const maxReward = await getMaxEpochReward(systemValidatorSet, prevEpochId);
    await systemValidatorSet.commitEpoch(currEpochId, newEpoch, epochSize, {
      value: maxReward,
    });

    await rewardPool
      .connect(systemValidatorSet.signer)
      .distributeRewardsFor(currEpochId, newEpoch, validatorsUptime, epochSize);
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

export async function registerValidator(validatorSet: ValidatorSet, governance: any, account: any) {
  await validatorSet.connect(governance).addToWhitelist([account.address]);
  const keyPair = mcl.newKeyPair();
  const signature = mcl.signValidatorMessage(DOMAIN, CHAIN_ID, account.address, keyPair.secret).signature;

  const tx = await validatorSet.connect(account).register(mcl.g1ToHex(signature), mcl.g2ToHex(keyPair.pubkey));
  const txReceipt = await tx.wait();

  if (txReceipt.status !== 1) {
    throw new Error("Cannot register address");
  }
}

export async function getValidatorReward(validatorSet: ValidatorSet, validatorAddr: string) {
  const validator = await validatorSet.getValidator(validatorAddr);

  return validator.withdrawableRewards;
}

export function findProperRPSIndex<T extends RewardParams>(arr: T[], timestamp: BigNumber): number {
  let left = 0;
  let right = arr.length - 1;
  let closestTimestamp: null | BigNumber = null;
  let closestIndex: null | number = null;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midValue = arr[mid].timestamp;

    if (midValue.eq(timestamp)) {
      // Timestamp found
      return mid;
    } else if (midValue.lt(timestamp)) {
      // Check if the timestamp is closer to the mid
      if (closestTimestamp === null || timestamp.sub(midValue).abs().lt(timestamp.sub(closestTimestamp).abs())) {
        closestTimestamp = midValue;
        closestIndex = mid;
      }
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  if (closestIndex === null) {
    throw new Error("Invalid timestamp");
  }

  return closestIndex;
}
