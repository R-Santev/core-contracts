import { Signers, initValidators } from "../mochaContext";
import { validatorSetTests } from "./ValidatorSet.test";

const { ethers } = require("hardhat");

describe("Configuring ValidatorSet Context for Integration tests", function () {
  this.beforeAll(async function () {
    this.signers = {} as Signers;

    const signers = await ethers.getSigners();
    this.signers.accounts = signers;
    this.signers.admin = signers[0];
    this.signers.validators = initValidators(signers, 4);
    this.signers.governance = signers[4];
    this.signers.delegator = signers[5];
    this.epochReward = ethers.utils.parseEther("0.0000001");
    this.minStake = ethers.utils.parseEther("1");
    this.minDelegation = ethers.utils.parseEther("1");
    this.epochsInYear = 31500;

    const network = await ethers.getDefaultProvider().getNetwork();
    this.chainId = network.chainId;
  });

  describe("ValidatorSet", function () {
    validatorSetTests();
  });
});
