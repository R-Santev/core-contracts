import * as hre from "hardhat";
import { ethers } from "hardhat";
// eslint-disable-next-line node/no-extraneous-import
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import * as mcl from "../../../ts/mcl";
// eslint-disable-next-line node/no-extraneous-import
import { expect } from "chai";

// eslint-disable-next-line node/no-extraneous-import
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { commitEpoch, generateValBls, initValidators, setupVestManager } from "./helper";
import { LiquidityToken } from "../../../typechain-types";

describe("ChildValidatorSet StakeSyncer", () => {
  const epochReward = ethers.utils.parseEther("0.0000001");
  const minStake = ethers.utils.parseEther("1");
  const minDelegation = ethers.utils.parseEther("1");

  let accounts: SignerWithAddress[];
  let validators: SignerWithAddress[];
  let delegator: SignerWithAddress;
  let governance: SignerWithAddress;
  let liquidToken: LiquidityToken;

  before(async () => {
    // needed for the validators init
    await mcl.init();

    accounts = await ethers.getSigners();
    validators = initValidators(accounts);
    governance = accounts[4];
    delegator = accounts[5];
  });

  async function initValidatorSetFixture() {
    const ChildValidatorSet = await ethers.getContractFactory("ChildValidatorSet", governance);
    const childValidatorSet = await ChildValidatorSet.deploy();
    await childValidatorSet.deployed();

    const LiquidTokenFactory = await ethers.getContractFactory("LiquidityToken");
    liquidToken = await LiquidTokenFactory.deploy();
    await liquidToken.initialize("Liquidity Token", "LQT", governance.address, childValidatorSet.address);

    const bls = await (await ethers.getContractFactory("BLS")).deploy();
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

    const systemSigner = await ethers.getSigner("0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE");
    const systemChildValidatorSet = childValidatorSet.connect(systemSigner);

    await systemChildValidatorSet.initialize(
      { epochReward, minStake, minDelegation, epochSize: 64 },
      [],
      bls.address,
      governance.address,
      liquidToken.address
    );

    return { childValidatorSet, systemChildValidatorSet };
  }

  async function registerValidatorFixture() {
    const { childValidatorSet, systemChildValidatorSet } = await loadFixture(initValidatorSetFixture);
    await childValidatorSet.addToWhitelist([validators[0].address]);

    const blsData = generateValBls(validators[0]);
    await childValidatorSet.connect(validators[0]).register(blsData.signature, blsData.pubkey);

    return { systemChildValidatorSet, childValidatorSet, blsData, validator: validators[0] };
  }

  describe("Stake", () => {
    it("emit transfer event from zero addr on stake", async () => {
      const { childValidatorSet, validator } = await loadFixture(registerValidatorFixture);
      const validatorChildValidatorSet = childValidatorSet.connect(validator);

      await expect(validatorChildValidatorSet.stake({ value: minStake }))
        .to.emit(childValidatorSet, "Transfer")
        .withArgs(ethers.constants.AddressZero, validator.address, minStake);

      // ensure getValidatorTotalStake returns the proper staked amount
      const stakeData = await childValidatorSet.getValidatorTotalStake(validator.address);
      expect(stakeData.totalStake).to.equal(minStake);
    });

    it("emit transfer event from zero addr on opening a vested position", async () => {
      const { childValidatorSet, validator } = await loadFixture(registerValidatorFixture);
      const validatorChildValidatorSet = childValidatorSet.connect(validator);

      const vestingDuration = 12; // weeks
      await expect(validatorChildValidatorSet.openStakingPosition(vestingDuration, { value: minStake }))
        .to.emit(childValidatorSet, "Transfer")
        .withArgs(ethers.constants.AddressZero, validator.address, minStake);

      // ensure getValidatorTotalStake returns the proper staked amount
      const stakeData = await childValidatorSet.getValidatorTotalStake(validator.address);
      expect(stakeData.totalStake).to.equal(minStake);
    });

    it("emit transfer event from zero addr on top-up vested position", async () => {
      const { childValidatorSet, validator, systemChildValidatorSet } = await loadFixture(registerValidatorFixture);
      const validatorChildValidatorSet = childValidatorSet.connect(validator);
      const vestingDuration = 12; // weeks
      await validatorChildValidatorSet.openStakingPosition(vestingDuration, { value: minStake });
      await commitEpoch(systemChildValidatorSet, []);

      await expect(validatorChildValidatorSet.stake({ value: minStake.mul(2) }))
        .to.emit(childValidatorSet, "Transfer")
        .withArgs(ethers.constants.AddressZero, validator.address, minStake.mul(2));

      // ensure getValidatorTotalStake returns the proper staked amount
      const stakeData = await childValidatorSet.getValidatorTotalStake(validator.address);
      expect(stakeData.totalStake).to.equal(minStake.mul(3));
    });

    it("emit transfer event to zero addr on unstake", async () => {
      const { childValidatorSet, validator, systemChildValidatorSet } = await loadFixture(registerValidatorFixture);
      const validatorChildValidatorSet = childValidatorSet.connect(validator);
      await validatorChildValidatorSet.stake({ value: minStake });
      await commitEpoch(systemChildValidatorSet, []);

      await expect(validatorChildValidatorSet.unstake(minStake))
        .to.emit(childValidatorSet, "Transfer")
        .withArgs(validator.address, ethers.constants.AddressZero, minStake);
      // ensure getValidatorTotalStake returns the proper staked amount
      const stakeData = await childValidatorSet.getValidatorTotalStake(validator.address);
      expect(stakeData.totalStake).to.equal(0);
    });

    it("emit transfer event to zero addr on unstake from vested position", async () => {
      const { childValidatorSet, validator, systemChildValidatorSet } = await loadFixture(registerValidatorFixture);
      const validatorChildValidatorSet = childValidatorSet.connect(validator);
      const vestingDuration = 12; // weeks
      await validatorChildValidatorSet.openStakingPosition(vestingDuration, { value: minStake.mul(2) });
      await commitEpoch(systemChildValidatorSet, []);

      const unstakeAmount = ethers.BigNumber.from(minStake).div(3);
      await expect(validatorChildValidatorSet.unstake(unstakeAmount))
        .to.emit(childValidatorSet, "Transfer")
        .withArgs(validator.address, ethers.constants.AddressZero, unstakeAmount);
    });
  });

  describe("Delegation", () => {
    async function setupDelegationVestManagerFixture() {
      const { childValidatorSet, validator, systemChildValidatorSet } = await loadFixture(registerValidatorFixture);
      const vestManager = await setupVestManager(childValidatorSet, delegator);
      const delegatorVestManager = vestManager.connect(delegator);

      return { childValidatorSet, systemChildValidatorSet, validator, vestManager, delegatorVestManager };
    }

    it("emit transfer event from zero addr on delegate", async () => {
      const { childValidatorSet, validator } = await loadFixture(registerValidatorFixture);
      const { totalStake } = await childValidatorSet.getValidator(validator.address);

      const delegatorChildValidatorSet = childValidatorSet.connect(delegator);
      await expect(delegatorChildValidatorSet.delegate(validator.address, false, { value: minStake }))
        .to.emit(childValidatorSet, "Transfer")
        .withArgs(ethers.constants.AddressZero, validator.address, minStake);

      // to ensure that delegate is immediately applied on the validator stake
      expect((await childValidatorSet.getValidator(validator.address)).totalStake).to.equal(totalStake.add(minStake));
    });

    it("emit transfer event from zero addr on delegate", async () => {
      const { childValidatorSet, validator } = await loadFixture(registerValidatorFixture);
      const { totalStake } = await childValidatorSet.getValidator(validator.address);

      const delegatorChildValidatorSet = childValidatorSet.connect(delegator);
      await expect(delegatorChildValidatorSet.delegate(validator.address, false, { value: minStake }))
        .to.emit(childValidatorSet, "Transfer")
        .withArgs(ethers.constants.AddressZero, validator.address, minStake);

      // to ensure that undelegate is immediately applied on the validator stake
      expect((await childValidatorSet.getValidator(validator.address)).totalStake).to.equal(totalStake.add(minStake));
    });

    it("emit transfer event from zero addr on open vested position", async () => {
      const { childValidatorSet, validator, delegatorVestManager } = await loadFixture(
        setupDelegationVestManagerFixture
      );
      const { totalStake } = await childValidatorSet.getValidator(validator.address);
      const vestingDuration = 12; // weeks
      await expect(delegatorVestManager.openDelegatorPosition(validator.address, vestingDuration, { value: minStake }))
        .to.emit(childValidatorSet, "Transfer")
        .withArgs(ethers.constants.AddressZero, validator.address, minStake);
      // to ensure that delegate is immediately applied on the validator stake
      expect((await childValidatorSet.getValidator(validator.address)).totalStake).to.equal(totalStake.add(minStake));
    });

    it("emit transfer event from zero addr on top-up vested position", async () => {
      const { childValidatorSet, validator, delegatorVestManager, systemChildValidatorSet } = await loadFixture(
        setupDelegationVestManagerFixture
      );
      const vestingDuration = 12; // weeks
      await delegatorVestManager.openDelegatorPosition(validator.address, vestingDuration, { value: minStake });
      // because balance change can be made only once per epoch when vested delegation position
      await commitEpoch(systemChildValidatorSet, []);
      const { totalStake } = await childValidatorSet.getValidator(validator.address);

      await expect(delegatorVestManager.topUpPosition(validator.address, { value: minStake }))
        .to.emit(childValidatorSet, "Transfer")
        .withArgs(ethers.constants.AddressZero, validator.address, minStake);
      // to ensure that delegate is immediately applied on the validator stake
      expect((await childValidatorSet.getValidator(validator.address)).totalStake).to.equal(totalStake.add(minStake));
    });

    it("emit transfer event from zero addr on undelegate", async () => {
      const { childValidatorSet, validator } = await loadFixture(registerValidatorFixture);
      const delegatorChildValidatorSet = childValidatorSet.connect(delegator);
      await delegatorChildValidatorSet.delegate(validator.address, false, { value: minStake });
      const { totalStake } = await childValidatorSet.getValidator(validator.address);

      await expect(await delegatorChildValidatorSet.undelegate(validator.address, minStake))
        .to.emit(childValidatorSet, "Transfer")
        .withArgs(validator.address, ethers.constants.AddressZero, minStake);

      // to ensure that undelegate is immediately applied on the validator stake
      expect((await childValidatorSet.getValidator(validator.address)).totalStake).to.equal(totalStake.sub(minStake));
    });

    it("emit transfer event from zero addr on cut vested position", async () => {
      const { childValidatorSet, validator, delegatorVestManager, systemChildValidatorSet } = await loadFixture(
        setupDelegationVestManagerFixture
      );
      const vestingDuration = 12; // weeks
      await delegatorVestManager.openDelegatorPosition(validator.address, vestingDuration, { value: minStake });
      // because balance change can be made only once per epoch when vested delegation position
      await commitEpoch(systemChildValidatorSet, []);
      const { totalStake } = await childValidatorSet.getValidator(validator.address);

      await liquidToken.connect(delegator).approve(delegatorVestManager.address, minStake);
      await expect(delegatorVestManager.cutPosition(validator.address, minStake))
        .to.emit(childValidatorSet, "Transfer")
        .withArgs(validator.address, ethers.constants.AddressZero, minStake);
      // to ensure that undelegate is immediately applied on the validator stake
      expect((await childValidatorSet.getValidator(validator.address)).totalStake).to.equal(totalStake.sub(minStake));
    });
  });
});
