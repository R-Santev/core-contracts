/* eslint-disable node/no-extraneous-import */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const { ethers } = require("hardhat");

export async function validatorSetFixture(governance: SignerWithAddress) {
  const ValidatorSet = await ethers.getContractFactory("ValidatorSet", governance);
  const validatorSet = await ValidatorSet.deploy();
  await validatorSet.deployed();

  return validatorSet;
}

export async function mockValidatorSetFixture() {
  const ValidatorSet = await ethers.getContractFactory("MockValidatorSet");
  const validatorSet = await ValidatorSet.deploy();
  await validatorSet.deployed();

  return validatorSet;
}

export async function liquidityTokenFixture() {
  const LiquidTokenFactory = await ethers.getContractFactory(
    "contracts/Hydra/LiquidityToken/LiquidityToken.sol:LiquidityToken"
  );
  const liquidToken = await LiquidTokenFactory.deploy();
  await liquidToken.deployed();

  return liquidToken;
}

export async function blsFixture() {
  const bls = await (await ethers.getContractFactory("BLS")).deploy();
  await bls.deployed();

  return bls;
}
