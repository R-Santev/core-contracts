// eslint-disable-next-line node/no-extraneous-import
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
// eslint-disable-next-line node/no-extraneous-import
import { BigNumberish } from "ethers";

import * as mcl from "../../../ts/mcl";
import { ChildValidatorSet, VestManager } from "../../../typechain-types";
import { CHAIN_ID, DOMAIN } from "./constants";
import { ValidatorBLS } from "./types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

export function initValidators(accounts: SignerWithAddress[]) {
  const vals: SignerWithAddress[] = [];
  for (let i = 0; i < 4; i++) {
    vals[i] = accounts[i];
  }

  return vals;
}

// eslint-disable-next-line no-unused-vars
export async function commitEpoch(systemChildValidatorSet: ChildValidatorSet, accounts: any[]): Promise<BigNumberish> {
  const input = await genCommitEpochInput(systemChildValidatorSet, accounts);
  await systemChildValidatorSet.commitEpoch(...input);

  return input[0];
}

export async function genCommitEpochInput(systemChildValidatorSet: ChildValidatorSet, accounts: any[]) {
  const currentEpochId = await systemChildValidatorSet.currentEpochId();

  const previousEpoch = await systemChildValidatorSet.epochs(currentEpochId.sub(1));
  const startBlock = previousEpoch.endBlock.add(1);
  const validatorSet = await systemChildValidatorSet.getCurrentValidatorSet();

  const newEpoch = {
    startBlock,
    endBlock: startBlock.add(63),
    epochRoot: ethers.utils.randomBytes(32),
    validatorSet: validatorSet,
  };

  const valsUptime = [];
  for (const acc of accounts) {
    valsUptime.push({ validator: acc.address, signedBlocks: 64 });
  }

  const newUptime = {
    epochId: currentEpochId,
    uptimeData: valsUptime,
    totalBlocks: 64,
  };

  return [currentEpochId, newEpoch, newUptime] as const;
}

/**
 *  Generate BLS pubkey and signature for validator
 * @param account ethersjs signer
 * @returns ValidatorBLS object with pubkey and signature
 */
export function generateValBls(account: SignerWithAddress): ValidatorBLS {
  const keyPair = mcl.newKeyPair();
  const signature = genValSignature(account, keyPair);

  const bls = {
    pubkey: mcl.g2ToHex(keyPair.pubkey),
    signature: mcl.g1ToHex(signature),
  };

  return bls;
}

export function genValSignature(account: SignerWithAddress, keyPair: mcl.keyPair) {
  return mcl.signValidatorMessage(DOMAIN, CHAIN_ID, account.address, keyPair.secret).signature;
}

export async function getUserManager(
  childValidatorSet: ChildValidatorSet,
  account: any,
  VestManagerFactory: any
): Promise<VestManager> {
  // Find user vesting position based on the emited  events
  const filter = childValidatorSet.filters.NewClone(account.address);
  const positionAddr = (await childValidatorSet.queryFilter(filter))[0].args.newClone;
  const manager = VestManagerFactory.attach(positionAddr);

  return manager.connect(account);
}

export async function setupVestManager(childValidatorSet: ChildValidatorSet, delegator: SignerWithAddress) {
  const VestManagerFactory = await ethers.getContractFactory("VestManager");
  const tx = await childValidatorSet.connect(delegator).newManager();
  const receipt = await tx.wait();
  const event = receipt.events?.find((e) => e.event === "NewClone");
  const address = event?.args?.newClone;

  return VestManagerFactory.attach(address);
}

export async function getMaxEpochReward(hre: HardhatRuntimeEnvironment, childValidatorSet: ChildValidatorSet) {
  const totalStake = await childValidatorSet.totalActiveStake();
  await hre.network.provider.send("hardhat_setBalance", [
    childValidatorSet.address,
    formatBigNumberHex(totalStake.toHexString()),
  ]);

  return childValidatorSet.getEpochReward(totalStake);
}

// Ethers BigNumber adds leading zeros when using toHexString, so we need to remove them
function formatBigNumberHex(numHex: string) {
  return numHex.replace(/^0x0*/, "0x");
}
