import { ethers } from "hardhat";

export const DOMAIN = ethers.utils.arrayify(ethers.utils.solidityKeccak256(["string"], ["DOMAIN_CHILD_VALIDATOR_SET"]));
export const CHAIN_ID = 31337;
