/* eslint-disable node/no-extraneous-import */
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

import {
  SYSTEM,
  NATIVE_TOKEN_CONTRACT,
  NATIVE_TRANSFER_PRECOMPILE,
  NATIVE_TRANSFER_PRECOMPILE_GAS,
  VALIDATOR_PKCHECK_PRECOMPILE,
  VALIDATOR_PKCHECK_PRECOMPILE_GAS,
} from "../constants";

export function RunSystemTests(): void {
  it("should initialize the System contract", async function () {
    const systemContract = await loadFixture(this.fixtures.systemFixture);

    expect(await systemContract.SYSTEM()).to.equal(SYSTEM);
    expect(await systemContract.NATIVE_TOKEN_CONTRACT()).to.equal(NATIVE_TOKEN_CONTRACT);
    expect(await systemContract.NATIVE_TRANSFER_PRECOMPILE()).to.equal(NATIVE_TRANSFER_PRECOMPILE);
    expect(await systemContract.NATIVE_TRANSFER_PRECOMPILE_GAS()).to.equal(NATIVE_TRANSFER_PRECOMPILE_GAS);
    expect(await systemContract.VALIDATOR_PKCHECK_PRECOMPILE()).to.equal(VALIDATOR_PKCHECK_PRECOMPILE);
    expect(await systemContract.VALIDATOR_PKCHECK_PRECOMPILE_GAS()).to.equal(VALIDATOR_PKCHECK_PRECOMPILE_GAS);
  });
}
