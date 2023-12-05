/* eslint-disable node/no-extraneous-import */
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";

import { mockValidatorSetFixture } from "../loadConfiguration";
import { ValidatorSet } from "../../../typechain-types";

const { ethers } = require("hardhat");

describe("ValidatorSet", () => {
  let accounts: SignerWithAddress[];
  let deployerSigner: SignerWithAddress;
  let validatorSetContract: ValidatorSet;
  before(async () => {
    accounts = await ethers.getSigners();

    // const { deployer, validatorSet } = await mockValidatorSetFixture();
    // deployerSigner = deployer;
    // validatorSetContract = validatorSet;
  });

  it("should successfully load the mocked validator set fixture", async () => {
    const { deployer, validatorSet } = await loadFixture(setupEnvFixture);

    expect(deployer.address).to.be.equal(accounts[0].address);
    expect(deployerSigner.address).to.be.equal(deployer.address);
    expect(validatorSet.address).to.be.equal(validatorSetContract.address);
  });

  async function setupEnvFixture() {
    const { deployer, validatorSet } = await loadFixture(mockValidatorSetFixture);
    deployerSigner = deployer;
    validatorSetContract = validatorSet;

    return { deployer, validatorSet };
  }
});
