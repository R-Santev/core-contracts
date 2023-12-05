/* eslint-disable node/no-extraneous-import */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ValidatorSet } from "../../typechain-types";

const { ethers } = require("hardhat");

export async function validatorSetFixture() {
  const accounts = await ethers.getSigners();
  const validators = initValidators(accounts);
  const governance = accounts[4];
  const delegator = accounts[5];

  const ValidatorSet = await ethers.getContractFactory("ValidatorSet", governance);
  const validatorSet = await ValidatorSet.deploy();

  await validatorSet.deployed();

  return { accounts, validators, governance, delegator, validatorSet };
}

export async function mockValidatorSetFixture() {
  const [deployer] = await ethers.getSigners();

  const ValidatorSet = await ethers.getContractFactory("MockValidatorSet");
  const validatorSet = await ValidatorSet.deploy();

  await validatorSet.deployed();

  return { deployer, validatorSet };
}

export async function liquidityTokenFixture(governance: string, validatorSet: ValidatorSet) {
  const LiquidTokenFactory = await ethers.getContractFactory("LiquidityToken");
  const liquidToken = await LiquidTokenFactory.deploy();
  await liquidToken.initialize("Lydra", "LDR", governance, validatorSet.address);

  return liquidToken;
}

function initValidators(accounts: SignerWithAddress[], num: number = 4) {
  if (num > accounts.length) {
    throw new Error("Too many validators");
  }

  const vals: SignerWithAddress[] = [];
  for (let i = 0; i < num; i++) {
    vals[i] = accounts[i];
  }

  return vals;
}
