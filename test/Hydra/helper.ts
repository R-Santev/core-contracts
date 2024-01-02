/* eslint-disable node/no-extraneous-import */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import * as hre from "hardhat";
import { BigNumber } from "ethers";

import { RewardPool, ValidatorSet } from "../../typechain-types";

export async function getMaxEpochReward(validatorSet: ValidatorSet, epochId: BigNumber) {
  const totalStake = await validatorSet.totalSupplyAt(epochId);
  return totalStake;
}

export async function commitMultipleEpochs(
  systemValidatorSet: ValidatorSet,
  epochSize: BigNumber,
  numOfEpochsToCommit: number,
  rewardPool: RewardPool,
  validators: SignerWithAddress[]
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

    const uptime = [
      {
        validator: validators[0].address,
        signedBlocks: hre.ethers.BigNumber.from(10),
      },
      {
        validator: validators[1].address,
        signedBlocks: hre.ethers.BigNumber.from(20),
      },
    ];

    const maxReward = await getMaxEpochReward(systemValidatorSet, currEpochId.sub(1));
    await systemValidatorSet.commitEpoch(currEpochId, newEpoch, epochSize, {
      value: maxReward,
    });

    await rewardPool.connect(systemValidatorSet.signer).distributeRewardsFor(currEpochId, newEpoch, uptime, epochSize);
  }
}
