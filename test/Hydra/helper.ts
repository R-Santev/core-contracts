/* eslint-disable camelcase */
/* eslint-disable node/no-extraneous-import */
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import * as hre from "hardhat";
import { BigNumber, ContractTransaction } from "ethers";

import * as mcl from "../../ts/mcl";
import { ValidatorSet } from "../../typechain-types/contracts/Hydra/ValidatorSet";
import { RewardPool } from "../../typechain-types/contracts/Hydra/RewardPool";
import { VestManager } from "../../typechain-types/contracts/Hydra/ValidatorSet/modules/Delegation";
import { VestManager__factory } from "../../typechain-types/factories/contracts/Hydra/ValidatorSet/modules/Delegation";
import { CHAIN_ID, DOMAIN } from "./constants";

interface RewardParams {
  timestamp: BigNumber;
}

export async function getMaxEpochReward(validatorSet: ValidatorSet, epochId: BigNumber) {
  const totalStake = await validatorSet.totalSupplyAt(epochId);
  return totalStake;
}

export async function commitEpoch(
  systemValidatorSet: ValidatorSet,
  rewardPool: RewardPool,
  validators: SignerWithAddress[],
  epochSize: BigNumber
): Promise<{ commitEpochTx: ContractTransaction; distributeRewardsTx: ContractTransaction }> {
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
  const commitEpochTx = await systemValidatorSet.commitEpoch(currEpochId, newEpoch, epochSize, {
    value: maxReward,
  });

  const distributeRewardsTx = await rewardPool
    .connect(systemValidatorSet.signer)
    .distributeRewardsFor(currEpochId, newEpoch, validatorsUptime, epochSize);

  return { commitEpochTx, distributeRewardsTx };
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
    await commitEpoch(systemValidatorSet, rewardPool, validators, epochSize);
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

export async function calculatePenalty(position: any, amount: BigNumber) {
  const latestTimestamp = await time.latest();
  const nextTimestamp = latestTimestamp + 2;
  await time.setNextBlockTimestamp(nextTimestamp);
  const duration = position.duration;
  const leftDuration = position.end.sub(nextTimestamp);
  const penalty = amount.mul(leftDuration).div(duration);
  return penalty;
}

export async function getUserManager(
  validatorSet: ValidatorSet,
  account: any,
  VestManagerFactory: any
): Promise<VestManager> {
  // Find user vesting position based on the emitted  events
  const filter = validatorSet.filters.NewClone(account.address);
  const positionAddr = (await validatorSet.queryFilter(filter))[0].args.newClone;
  const manager = VestManagerFactory.attach(positionAddr);

  return manager.connect(account);
}

export async function claimPositionRewards(
  validatorSet: ValidatorSet,
  rewardPool: RewardPool,
  vestManager: VestManager,
  validator: string
) {
  const position = await rewardPool.delegationPositions(validator, vestManager.address);
  const currentEpochId = await validatorSet.currentEpochId();
  const rpsValues = await rewardPool.getRPSValues(validator, currentEpochId);
  const rpsIndex = findProperRPSIndex(rpsValues, position.end);
  await vestManager.claimVestedPositionReward(validator, rpsIndex, 0);
}

export async function createNewVestManager(validatorSet: ValidatorSet, owner: SignerWithAddress) {
  const tx = await validatorSet.connect(owner).newManager();
  const receipt = await tx.wait();
  const event = receipt.events?.find((e) => e.event === "NewClone");
  const address = event?.args?.newClone;

  const VestManagerFactory = new VestManager__factory(owner);
  const vestManager: VestManager = VestManagerFactory.attach(address);

  return { newManagerFactory: VestManagerFactory, newManager: vestManager };
}

export async function retrieveRPSData(
  validatorSet: ValidatorSet,
  rewardPool: RewardPool,
  validator: string,
  manager: string
) {
  const position = await rewardPool.delegationPositions(validator, manager);
  const end = position.end;
  const currentEpochId = await validatorSet.currentEpochId();
  const rpsValues = await rewardPool.getRPSValues(validator, currentEpochId);
  const epochNum = findProperRPSIndex(rpsValues, end);
  const topUpIndex = 0;

  return { position, epochNum, topUpIndex };
}

export async function calculateExpectedBaseReward(rewardPool: RewardPool, reward: BigNumber, epochsInYear: number) {
  // calculate base reward
  const base = await rewardPool.getBase();
  const vestBonus = await rewardPool.getVestingBonus(1);
  const rsi = await rewardPool.getRSI();
  const expectedReward = base
    .add(vestBonus)
    .mul(rsi)
    .mul(reward)
    .div(10000 * 10000)
    .div(epochsInYear);

  return expectedReward;
}

export async function calculateExpectedMaxBaseReward(rewardPool: RewardPool, reward: BigNumber, epochsInYear: number) {
  // calculate max reward
  const base = await rewardPool.getBase();
  const maxVestBonus = await rewardPool.getVestingBonus(52);
  const maxRSI = await rewardPool.getMaxRSI();
  const maxReward = base
    .add(maxVestBonus)
    .mul(maxRSI)
    .mul(reward)
    .div(10000 * 10000)
    .div(epochsInYear);

  return maxReward;
}
