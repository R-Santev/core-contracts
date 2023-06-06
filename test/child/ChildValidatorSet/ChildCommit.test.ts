import * as hre from "hardhat";
import { ethers } from "hardhat";
import * as mcl from "../../../ts/mcl";
// eslint-disable-next-line node/no-extraneous-import
import { BigNumber, BigNumberish } from "ethers";
// eslint-disable-next-line node/no-extraneous-import
import { expect } from "chai";

import { BLS, ChildValidatorSet } from "../../../typechain-types";
import { genValSignature } from "./helper";

interface ValidatorInit {
  addr: string;
  pubkey: [BigNumberish, BigNumberish, BigNumberish, BigNumberish];
  signature: [BigNumberish, BigNumberish];
  stake: BigNumberish;
}

describe("ChildValidatorSet Initial Setup", () => {
  let bls: BLS,
    // eslint-disable-next-line no-unused-vars
    governance: string,
    childValidatorSet: ChildValidatorSet,
    systemChildValidatorSet: ChildValidatorSet,
    // eslint-disable-next-line no-unused-vars
    epochReward: BigNumber,
    minStake: number,
    minDelegation: number,
    id: number,
    epoch: any,
    uptime: any,
    validatorInit: ValidatorInit,
    validatorInitTwo: ValidatorInit,
    validatorInitThree: ValidatorInit,
    validatorInitFour: ValidatorInit,
    accounts: any[]; // we use any so we can access address directly from object

  before(async () => {
    await mcl.init();
    accounts = await ethers.getSigners();
    governance = accounts[0].address;
    epochReward = ethers.utils.parseEther("0.0000001");
    minStake = 10000;
    minDelegation = 10000;

    const ChildValidatorSet = await ethers.getContractFactory("ChildValidatorSet");
    childValidatorSet = await ChildValidatorSet.deploy();

    await childValidatorSet.deployed();

    bls = await (await ethers.getContractFactory("BLS")).deploy();
    await bls.deployed();

    await hre.network.provider.send("hardhat_setBalance", [
      "0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE",
      "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
    ]);

    // TODO: remove this once we have a better way to set balance from Polygon
    // Need othwerwise burn mechanism doesn't work
    await hre.network.provider.send("hardhat_setBalance", [
      childValidatorSet.address,
      "0x2CD76FE086B93CE2F768A00B22A00000000000",
    ]);

    await hre.network.provider.send("hardhat_setBalance", [
      "0x0000000000000000000000000000000000001001",
      "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
    ]);
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE"],
    });
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0x0000000000000000000000000000000000001001"],
    });

    const systemSigner = await ethers.getSigner("0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE");
    systemChildValidatorSet = childValidatorSet.connect(systemSigner);

    validatorInit = createValidatorInit(accounts[0]);
    validatorInitTwo = createValidatorInit(accounts[1]);
    validatorInitThree = createValidatorInit(accounts[2]);
    validatorInitFour = createValidatorInit(accounts[3]);

    await systemChildValidatorSet.initialize(
      { epochReward, minStake, minDelegation, epochSize: 10 },
      [validatorInit, validatorInitTwo, validatorInitThree, validatorInitFour],
      bls.address,
      governance
    );
  });

  it("should commitEpoch", async () => {
    id = 1;
    epoch = {
      startBlock: BigNumber.from(1),
      endBlock: BigNumber.from(10),
      epochRoot: ethers.constants.HashZero,
    };

    const currentEpochId = await childValidatorSet.currentEpochId();
    uptime = {
      epochId: currentEpochId,
      uptimeData: [
        { validator: accounts[0].address, signedBlocks: 8 },
        { validator: accounts[1].address, signedBlocks: 8 },
        { validator: accounts[2].address, signedBlocks: 8 },
        { validator: accounts[3].address, signedBlocks: 8 },
      ],
      totalBlocks: 8,
    };

    const tx = await systemChildValidatorSet.commitEpoch(id, epoch, uptime);

    await expect(tx)
      .to.emit(childValidatorSet, "NewEpoch")
      .withArgs(currentEpochId, epoch.startBlock, epoch.endBlock, ethers.utils.hexlify(epoch.epochRoot));

    const storedEpoch: any = await childValidatorSet.epochs(1);
    expect(storedEpoch.startBlock).to.equal(epoch.startBlock);
    expect(storedEpoch.endBlock).to.equal(epoch.endBlock);
    expect(storedEpoch.epochRoot).to.equal(ethers.utils.hexlify(epoch.epochRoot));
  });
});

function createValidatorInit(account: any): ValidatorInit {
  const keyPair = mcl.newKeyPair();
  const signature = genValSignature(account, keyPair);
  const validatorInit = {
    addr: account.address,
    pubkey: mcl.g2ToHex(keyPair.pubkey),
    signature: mcl.g1ToHex(signature),
    stake: ethers.BigNumber.from("0xd3c21bcecceda1000000"),
  };

  return validatorInit;
}
