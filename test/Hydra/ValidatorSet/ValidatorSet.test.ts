/* eslint-disable no-unused-vars */
/* eslint-disable node/no-extraneous-import */
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import * as hre from "hardhat";
import { BigNumberish } from "ethers";

import * as mcl from "../../../ts/mcl";
import { Fixtures, Signers, initValidators } from "../mochaContext";
import { CHAIN_ID, DOMAIN } from "../constants";
import { generateFixtures } from "../fixtures";

describe("ValidatorSet", function () {
  /** Variables */
  let systemValidatorSet;
  let validatorInit: {
    addr: string;
    pubkey: [BigNumberish, BigNumberish, BigNumberish, BigNumberish];
    signature: [BigNumberish, BigNumberish];
    stake: BigNumberish;
  };

  // * Method used to initialize the parameters of the mocha context, e.g., the signers
  async function initializeContext(context: any) {
    context.signers = {} as Signers;
    context.fixtures = {} as Fixtures;

    const signers = await hre.ethers.getSigners();
    context.signers.accounts = signers;
    context.signers.admin = signers[0];
    context.signers.validators = initValidators(signers, 4);
    context.signers.governance = signers[4];
    context.signers.delegator = signers[5];
    context.epochReward = hre.ethers.utils.parseEther("0.0000001");
    context.minStake = hre.ethers.utils.parseEther("1");
    context.minDelegation = hre.ethers.utils.parseEther("1");
    context.epochsInYear = 31500;

    const network = await hre.ethers.getDefaultProvider().getNetwork();
    context.chainId = network.chainId;
  }

  before(async function () {
    // * Initialize the this context of mocha
    await initializeContext(this);

    /** Generate and initialize the context fixtures */
    await generateFixtures(this);

    const validatorSet = await loadFixture(this.fixtures.validatorSetFixture);

    await mcl.init();

    await hre.network.provider.send("hardhat_setBalance", [
      "0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE",
      "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
    ]);

    // TODO: remove this once we have a better way to set balance from Polygon
    // Need otherwise burn mechanism doesn't work
    await hre.network.provider.send("hardhat_setBalance", [
      validatorSet.address,
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

    const systemSigner = await hre.ethers.getSigner("0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE");
    systemValidatorSet = validatorSet.connect(systemSigner);

    const keyPair = mcl.newKeyPair();
    const signature = mcl.signValidatorMessage(DOMAIN, CHAIN_ID, this.signers.admin.address, keyPair.secret).signature;
    validatorInit = {
      addr: this.signers.admin.address,
      pubkey: mcl.g2ToHex(keyPair.pubkey),
      signature: mcl.g1ToHex(signature),
      stake: this.minStake.mul(2),
    };
  });

  it("should validate validator set initialization", async function () {
    const validatorSet = await loadFixture(this.fixtures.validatorSetFixture);

    expect(validatorSet.deployTransaction.from).to.equal(this.signers.admin.address);
    expect(await validatorSet.minStake()).to.equal(0);
    expect(await validatorSet.minDelegation()).to.equal(0);
    expect(await validatorSet.currentEpochId()).to.equal(0);
    expect(await validatorSet.owner()).to.equal(hre.ethers.constants.AddressZero);
  });

  // * Main tests for the ValidatorSet with the loaded context and all child fixtures
});
