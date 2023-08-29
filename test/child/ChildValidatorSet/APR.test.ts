import * as hre from "hardhat";
import { ethers } from "hardhat";
// eslint-disable-next-line node/no-extraneous-import
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import * as mcl from "../../../ts/mcl";
// eslint-disable-next-line node/no-extraneous-import
import { expect } from "chai";

// eslint-disable-next-line node/no-extraneous-import
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { generateValBls, initValidators } from "./helper";

import { IChildValidatorSetBase } from "./../../../typechain-types/contracts/child/ChildValidatorSet";

describe("ChildValidatorSet APR module", () => {
  const epochReward = ethers.utils.parseEther("0.0000001");
  const minStake = ethers.utils.parseEther("1");
  const minDelegation = ethers.utils.parseEther("1");

  let accounts: SignerWithAddress[];
  let validators: SignerWithAddress[];
  let governance: SignerWithAddress;

  before(async () => {
    // needed for the validators init
    await mcl.init();

    accounts = await ethers.getSigners();
    validators = initValidators(accounts, 1);
    governance = accounts[4];
  });

  async function presetStateFixture() {
    const ChildValidatorSet = await ethers.getContractFactory("ChildValidatorSet", governance);
    const childValidatorSet = await ChildValidatorSet.deploy();
    await childValidatorSet.deployed();

    const bls = await (await ethers.getContractFactory("BLS")).deploy();
    await bls.deployed();
    await hre.network.provider.send("hardhat_setBalance", [
      "0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE",
      "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
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
    const systemChildValidatorSet = childValidatorSet.connect(systemSigner);
    const validatorInit: IChildValidatorSetBase.ValidatorInitStruct[] = [];
    for (const [index, val] of validators.entries()) {
      const blsValData = generateValBls(val);
      validatorInit[index] = {
        addr: val.address,
        pubkey: blsValData.pubkey,
        signature: blsValData.signature,
        stake: minStake,
      };
    }

    const liquidToken = await (await ethers.getContractFactory("LiquidityToken")).deploy();
    await liquidToken.initialize("Lydra", "LDR", governance.address, childValidatorSet.address);

    await systemChildValidatorSet.initialize(
      { epochReward, minStake, minDelegation, epochSize: 64 },
      validatorInit,
      bls.address,
      governance.address,
      liquidToken.address
    );

    return { childValidatorSet, systemChildValidatorSet };
  }

  describe("Reward injecting on commitEpoch", () => {
    // TODO: Ensure proper handling in case staked balance is too small so max potential epoch reward is zero
    it("getEpochMaxReward should properly calculate the max potential reward", async () => {
      const { systemChildValidatorSet } = await loadFixture(presetStateFixture);
      const maxEpochReward = 9564285714285; // wei
      const totalStake = await systemChildValidatorSet.totalActiveStake();
      const epochReward = await systemChildValidatorSet.getEpochMaxReward(totalStake);

      expect(epochReward).to.equal(maxEpochReward);
    });
    it("returns reward higher than zero when min stake only", async () => {
      // systemChildValidatorSet is needed to call the function only
      const { systemChildValidatorSet } = await loadFixture(presetStateFixture);
      const totalStake = ethers.utils.parseEther("1");
      const epochReward = await systemChildValidatorSet.getEpochMaxReward(totalStake);

      expect(epochReward).to.gt(0);
    });
  });
});
