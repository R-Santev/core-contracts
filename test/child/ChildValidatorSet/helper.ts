import * as hre from "hardhat";
import { ethers } from "hardhat";
import * as mcl from "../../../ts/mcl";
import { BigNumber, BigNumberish } from "ethers";
// eslint-disable-next-line node/no-extraneous-import
import { expect } from "chai";

import { BLS, ChildValidatorSet } from "../../../typechain-types";

const DOMAIN = ethers.utils.arrayify(ethers.utils.solidityKeccak256(["string"], ["DOMAIN_CHILD_VALIDATOR_SET"]));
const CHAIN_ID = 31337;

interface ValidatorInit {
  addr: string;
  pubkey: [BigNumberish, BigNumberish, BigNumberish, BigNumberish];
  signature: [BigNumberish, BigNumberish];
  stake: BigNumberish;
}

describe("ChildValidatorSet", () => {});
