import * as hre from "hardhat";
import { ethers } from "hardhat";
import * as mcl from "../../ts/mcl";
import { BigNumberish } from "ethers";

import { BLS, ChildValidatorSet } from "../../typechain-types";

const DOMAIN = ethers.utils.arrayify(ethers.utils.solidityKeccak256(["string"], ["DOMAIN_CHILD_VALIDATOR_SET"]));
const CHAIN_ID = 187;

interface ValidatorInit {
  addr: string;
  pubkey: [BigNumberish, BigNumberish, BigNumberish, BigNumberish];
  signature: [BigNumberish, BigNumberish];
  stake: BigNumberish;
}

describe.only("ChildValidatorSet", () => {
  const week = 60 * 60 * 24 * 7;

  let bls: BLS,
    // eslint-disable-next-line no-unused-vars
    rootValidatorSetAddress: string,
    governance: string,
    childValidatorSet: ChildValidatorSet,
    systemChildValidatorSet: ChildValidatorSet,
    validatorSetSize: number,
    // eslint-disable-next-line no-unused-vars
    validatorStake: BigNumber,
    epochReward: BigNumber,
    minStake: number,
    minDelegation: number,
    id: number,
    epoch: any,
    uptime: any,
    doubleSignerSlashingInput: any,
    childValidatorSetBalance: BigNumber,
    chainId: number,
    validatorInit: ValidatorInit,
    validatorInitTwo: ValidatorInit,
    validatorInitThree: ValidatorInit,
    validatorInitFour: ValidatorInit,
    accounts: any[]; // we use any so we can access address directly from object

  before(async () => {
    governance = accounts[0].address;
    epochReward = ethers.utils.parseEther("0.0000001");
    minStake = 10000;
    minDelegation = 10000;

    const ChildValidatorSet = await ethers.getContractFactory("ChildValidatorSet");
    childValidatorSet = await ChildValidatorSet.deploy();

    await childValidatorSet.deployed();

    const network = await ethers.getDefaultProvider().getNetwork();
    chainId = network.chainId;

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

    console.log("THEREEEE", await ethers.provider.getBalance(childValidatorSet.address));

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

  it("should commitEpoch", async () => {});
});

function createValidatorInit(accounts: any): ValidatorInit {
  const keyPair = mcl.newKeyPair();
  const signature = mcl.signValidatorMessage(DOMAIN, CHAIN_ID, accounts[0].address, keyPair.secret).signature;
  const validatorInit = {
    addr: accounts[0].address,
    pubkey: mcl.g2ToHex(keyPair.pubkey),
    signature: mcl.g1ToHex(signature),
    stake: ethers.BigNumber.from("0xd3c21bcecceda1000000"),
  };

  return validatorInit;
}
