/* eslint-disable no-unused-vars */
/* eslint-disable node/no-extraneous-import */
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import * as hre from "hardhat";
import { BigNumber, BigNumberish } from "ethers";

import { blsFixture, liquidityTokenFixture, mockValidatorSetFixture } from "../loadConfiguration";
import * as mcl from "../../../ts/mcl";
import { LiquidityToken } from "../../../typechain-types/contracts/Hydra/LiquidityToken/LiquidityToken";
import { BLS, MockValidatorSet } from "../../../typechain-types";
import { CHAIN_ID, DOMAIN } from "../constants";

export function validatorSetTests(): void {
  let validatorSet: MockValidatorSet;
  let systemValidatorSet: MockValidatorSet;
  let liquidToken: LiquidityToken;
  let blsContract: BLS;
  let validatorSetSize: number;
  let validatorStake: BigNumber;
  let validatorInit: {
    addr: string;
    pubkey: [BigNumberish, BigNumberish, BigNumberish, BigNumberish];
    signature: [BigNumberish, BigNumberish];
    stake: BigNumberish;
  };

  before(async function () {
    const fixtures = await loadFixture(setupEnvFixtures);
    validatorSet = fixtures.validatorSetFixture;
    liquidToken = fixtures.liquidTokenFixture;
    blsContract = fixtures.blsContractFixture;

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
    expect(await validatorSet.minStake()).to.equal(0);
    expect(await validatorSet.minDelegation()).to.equal(0);
    expect(await validatorSet.currentEpochId()).to.equal(0);
    expect(await validatorSet.owner()).to.equal(hre.ethers.constants.AddressZero);
  });

  async function setupEnvFixtures() {
    const validatorSetFixture = await loadFixture(mockValidatorSetFixture);
    const liquidTokenFixture = await loadFixture(liquidityTokenFixture);
    const blsContractFixture = await loadFixture(blsFixture);

    return { validatorSetFixture, liquidTokenFixture, blsContractFixture };
  }
}
