import * as hre from "hardhat";
import { ethers } from "hardhat";
// eslint-disable-next-line node/no-extraneous-import
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
// eslint-disable-next-line node/no-extraneous-import
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as mcl from "../../../ts/mcl";
// eslint-disable-next-line node/no-extraneous-import
import { expect } from "chai";
import { commitEpoch, generateValBls, getMaxEpochReward, initValidators } from "./helper";
import { LiquidityToken } from "../../../typechain-types";
import { IChildValidatorSetBase } from "../../../typechain-types/contracts/child/ChildValidatorSet";

import { CHAIN_ID, DOMAIN } from "./constants";
import { alwaysTrueBytecode } from "../../constants";

describe("ChildValidatorSet Liquid Staking", () => {
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

  async function setupEnvFixture() {
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

    return { systemChildValidatorSet, childValidatorSet, bls };
  }

  async function initValidatorSetFixture() {
    const { systemChildValidatorSet, childValidatorSet, bls } = await loadFixture(setupEnvFixture);

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

  async function stakeFixture() {
    const fixtureData = await loadFixture(registerValidatorFixture);
    const validatorChildValidatorSet = fixtureData.childValidatorSet.connect(fixtureData.validator);
    await validatorChildValidatorSet.stake({ value: minStake });

    // eslint-disable-next-line node/no-unsupported-features/es-syntax
    return { ...fixtureData, stakedAmount: minStake };
  }

  async function commitEpochWithSlashFixture() {
    const fixtureData = await loadFixture(stakeFixture);

    await commitEpoch(fixtureData.systemChildValidatorSet, []);

    const epoch = {
      startBlock: 65,
      endBlock: 128,
      epochRoot: ethers.utils.randomBytes(32),
    };

    const currentEpochId = await fixtureData.childValidatorSet.currentEpochId();

    const uptime = {
      epochId: currentEpochId,
      uptimeData: [{ validator: accounts[2].address, signedBlocks: 1 }],
      totalBlocks: 1,
    };

    const blockNumber = 0;
    const pbftRound = 0;

    const doubleSignerSlashingInput = [
      {
        epochId: currentEpochId,
        eventRoot: ethers.utils.randomBytes(32),
        currentValidatorSetHash: ethers.utils.randomBytes(32),
        nextValidatorSetHash: ethers.utils.randomBytes(32),
        blockHash: ethers.utils.randomBytes(32),
        bitmap: "0x11",
        signature: "",
      },
      {
        epochId: currentEpochId,
        eventRoot: ethers.utils.randomBytes(32),
        currentValidatorSetHash: ethers.utils.randomBytes(32),
        nextValidatorSetHash: ethers.utils.randomBytes(32),
        blockHash: ethers.utils.randomBytes(32),
        bitmap: "0x11",
        signature: "",
      },
    ];
    for (let i = 0; i < doubleSignerSlashingInput.length; i++) {
      doubleSignerSlashingInput[i].signature = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["uint", "uint", "bytes32", "uint", "uint", "bytes32", "bytes32", "bytes32"],
          [
            CHAIN_ID,
            blockNumber,
            doubleSignerSlashingInput[i].blockHash,
            pbftRound,
            doubleSignerSlashingInput[i].epochId,
            doubleSignerSlashingInput[i].eventRoot,
            doubleSignerSlashingInput[i].currentValidatorSetHash,
            doubleSignerSlashingInput[i].nextValidatorSetHash,
          ]
        )
      );
    }

    await hre.network.provider.send("hardhat_setCode", [
      "0x0000000000000000000000000000000000002030",
      alwaysTrueBytecode,
    ]);

    const maxReward = await getMaxEpochReward(fixtureData.childValidatorSet);
    await fixtureData.systemChildValidatorSet.commitEpochWithDoubleSignerSlashing(
      currentEpochId,
      blockNumber,
      pbftRound,
      epoch,
      uptime,
      doubleSignerSlashingInput,
      { value: maxReward }
    );

    return fixtureData;
  }

  it("be properly initialized", async () => {
    const { childValidatorSet } = await loadFixture(initValidatorSetFixture);
    expect(await childValidatorSet.liquidToken()).to.be.equal(liquidToken.address);
  });

  it("mints proper amount of tokens on init", async () => {
    const { systemChildValidatorSet, bls } = await loadFixture(setupEnvFixture);

    const keyPair = mcl.newKeyPair();
    const signature = mcl.signValidatorMessage(DOMAIN, CHAIN_ID, accounts[0].address, keyPair.secret).signature;
    const validatorInit: IChildValidatorSetBase.ValidatorInitStruct = {
      addr: validators[0].address,
      pubkey: mcl.g2ToHex(keyPair.pubkey),
      signature: mcl.g1ToHex(signature),
      stake: minStake,
    };

    await systemChildValidatorSet.initialize(
      { epochReward, minStake, minDelegation, epochSize: 64 },
      [validatorInit],
      bls.address,
      governance.address,
      liquidToken.address
    );

    expect(await liquidToken.totalSupply()).to.be.equal(minStake);
  });

  describe("On Stake", () => {
    it("mints proper amount of tokens to the user", async () => {
      const { childValidatorSet, validator } = await loadFixture(registerValidatorFixture);
      const validatorChildValidatorSet = childValidatorSet.connect(validator);
      await validatorChildValidatorSet.stake({ value: minStake });
      await expect(validatorChildValidatorSet.stake({ value: minStake })).to.changeTokenBalance(
        liquidToken,
        validator,
        minStake
      );
    });
    it("keeps the right token supply", async () => {
      const { stakedAmount } = await loadFixture(stakeFixture);
      expect(await liquidToken.totalSupply()).to.be.equal(stakedAmount);
    });
  });

  describe("On Unstake", () => {
    it("burns proper amount of tokens from the user", async () => {
      const { childValidatorSet, validator, stakedAmount } = await loadFixture(stakeFixture);
      const validatorChildValidatorSet = childValidatorSet.connect(validator);
      await expect(validatorChildValidatorSet.unstake(stakedAmount)).to.changeTokenBalance(
        liquidToken,
        validator,
        ethers.BigNumber.from(0).sub(stakedAmount)
      );

      expect(await liquidToken.totalSupply()).to.be.equal(0);
    });

    it("burns usnstaked amount + slashed amount in case the validator is slashed", async () => {
      const { childValidatorSet, systemChildValidatorSet, validator, stakedAmount } = await loadFixture(
        commitEpochWithSlashFixture
      );
      let localStakedAmount = stakedAmount;

      const slashedAmount = stakedAmount.div(10); // Slashing is 10%
      const validatorChildValidatorSet = childValidatorSet.connect(validator);
      await validatorChildValidatorSet.stake({ value: minStake });
      localStakedAmount = localStakedAmount.add(minStake);
      await commitEpoch(systemChildValidatorSet, []);

      await expect(validatorChildValidatorSet.unstake(1)).to.changeTokenBalance(
        liquidToken,
        validator,
        ethers.BigNumber.from(0).sub(slashedAmount.add(1))
      );

      expect(await liquidToken.totalSupply()).to.be.equal(localStakedAmount.sub(1).sub(slashedAmount));
    });
  });

  describe("On Delegate", () => {
    it("mints proper amount of tokens to the user", async () => {
      const { childValidatorSet, validator } = await loadFixture(stakeFixture);
      const delegateAmount = minDelegation.add(1);
      await expect(
        await childValidatorSet.connect(delegator).delegate(validator.address, false, {
          value: delegateAmount,
        })
      ).to.changeTokenBalance(liquidToken, delegator, delegateAmount);
    });
  });

  describe("On Undelegate", () => {
    it("burns proper amount of tokens from the user", async () => {
      const { childValidatorSet, validator } = await loadFixture(stakeFixture);
      const delegateAmount = minDelegation.add(1);
      await childValidatorSet.connect(delegator).delegate(validator.address, false, {
        value: delegateAmount,
      });

      const undelegateAmount = delegateAmount.sub(minDelegation);
      await expect(
        childValidatorSet.connect(delegator).undelegate(validator.address, undelegateAmount)
      ).to.changeTokenBalance(liquidToken, delegator, ethers.BigNumber.from(0).sub(undelegateAmount));
      expect(await liquidToken.balanceOf(delegator.address)).to.be.equal(minDelegation);
    });

    it("reverts when insufficient liquid tokens balance", async () => {
      const { childValidatorSet, validator } = await loadFixture(stakeFixture);
      const delegateAmount = minDelegation.add(1);
      await childValidatorSet.connect(delegator).delegate(validator.address, false, {
        value: delegateAmount,
      });

      const undelegateAmount = delegateAmount.sub(minDelegation);
      await liquidToken.connect(delegator).transfer(accounts[6].address, delegateAmount);
      await expect(
        childValidatorSet.connect(delegator).undelegate(validator.address, undelegateAmount)
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });
  });
});
