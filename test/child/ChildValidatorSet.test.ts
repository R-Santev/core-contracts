/* eslint-disable camelcase */
/* eslint-disable node/no-extraneous-import */
import { setBalance, impersonateAccount, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { BigNumber, BigNumberish } from "ethers";
import * as hre from "hardhat";
import { ethers } from "hardhat";
import * as mcl from "../../ts/mcl";
// eslint-disable-next-line camelcase
import { BLS, ChildValidatorSet, VestManager__factory, VestManager } from "../../typechain-types";
import { alwaysFalseBytecode, alwaysTrueBytecode } from "../constants";
import { log } from "console";
import { child } from "../../typechain-types/factories/contracts";
import { LogDescription } from "ethers/lib/utils";

const DOMAIN = ethers.utils.arrayify(ethers.utils.solidityKeccak256(["string"], ["DOMAIN_CHILD_VALIDATOR_SET"]));
const CHAIN_ID = 31337;

const MAX_COMMISSION = 100;
const DOUBLE_SIGNING_SLASHING_PERCENT = 10;

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
    validatorInit: {
      addr: string;
      pubkey: [BigNumberish, BigNumberish, BigNumberish, BigNumberish];
      signature: [BigNumberish, BigNumberish];
      stake: BigNumberish;
    },
    accounts: any[]; // we use any so we can access address directly from object

  before(async () => {
    await mcl.init();
    accounts = await ethers.getSigners();

    rootValidatorSetAddress = ethers.Wallet.createRandom().address;

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
    systemChildValidatorSet = childValidatorSet.connect(systemSigner);
    const keyPair = mcl.newKeyPair();
    const signature = mcl.signValidatorMessage(DOMAIN, CHAIN_ID, accounts[0].address, keyPair.secret).signature;
    validatorInit = {
      addr: accounts[0].address,
      pubkey: mcl.g2ToHex(keyPair.pubkey),
      signature: mcl.g1ToHex(signature),
      stake: minStake * 2,
    };
  });

  describe("Voting Power Exponent", async () => {
    it("initial value must be", async () => {
      const powerExp = await childValidatorSet.powerExponent();
      expect(powerExp.value).to.equal(8500);
      expect(powerExp.pendingValue).to.equal(0);

      const powerExpRes = await childValidatorSet.getExponent();
      expect(powerExpRes.numerator).to.equal(8500);
      expect(powerExpRes.denominator).to.equal(10000);
    });
  });

  it("Initialize without system call", async () => {
    await expect(
      childValidatorSet.initialize(
        { epochReward, minStake, minDelegation, epochSize: 64 },
        [validatorInit],
        bls.address,
        governance
      )
    )
      .to.be.revertedWithCustomError(childValidatorSet, "Unauthorized")
      .withArgs("SYSTEMCALL");
  });
  it("Initialize with invalid signature", async () => {
    validatorSetSize = Math.floor(Math.random() * (5 - 1) + 5); // Randomly pick 5-9
    validatorStake = ethers.utils.parseEther(String(Math.floor(Math.random() * (10000 - 1000) + 1000)));
    const epochValidatorSet = [];

    for (let i = 0; i < validatorSetSize; i++) {
      epochValidatorSet.push(accounts[i].address);
    }

    expect(await childValidatorSet.totalActiveStake()).to.equal(0);

    await expect(
      systemChildValidatorSet.initialize(
        { epochReward, minStake, minDelegation, epochSize: 64 },
        // eslint-disable-next-line node/no-unsupported-features/es-syntax
        [{ ...validatorInit, addr: accounts[1].address }],
        bls.address,
        governance
      )
    )
      .to.be.revertedWithCustomError(childValidatorSet, "InvalidSignature")
      .withArgs(accounts[1].address);
  });
  it("Initialize and validate initialization", async () => {
    // TODO: use random set size and stake in tests
    validatorSetSize = Math.floor(Math.random() * (5 - 1) + 5); // Randomly pick 5-9
    validatorStake = ethers.utils.parseEther(String(Math.floor(Math.random() * (10000 - 1000) + 1000)));
    const epochValidatorSet = [];

    for (let i = 0; i < validatorSetSize; i++) {
      epochValidatorSet.push(accounts[i].address);
    }

    expect(await childValidatorSet.totalActiveStake()).to.equal(0);

    await systemChildValidatorSet.initialize(
      { epochReward, minStake, minDelegation, epochSize: 64 },
      [validatorInit],
      bls.address,
      governance
    );

    expect(await childValidatorSet.epochReward()).to.equal(epochReward);
    expect(await childValidatorSet.minStake()).to.equal(minStake);
    expect(await childValidatorSet.minDelegation()).to.equal(minDelegation);
    expect(await childValidatorSet.currentEpochId()).to.equal(1);
    expect(await childValidatorSet.owner()).to.equal(accounts[0].address);

    const currentEpochId = await childValidatorSet.currentEpochId();
    expect(currentEpochId).to.equal(1);

    expect(await childValidatorSet.whitelist(accounts[0].address)).to.equal(false);
    const validator = await childValidatorSet.getValidator(accounts[0].address);
    expect(validator.blsKey.map((x) => x.toHexString())).to.deep.equal(validatorInit.pubkey);
    expect(validator.stake).to.equal(minStake * 2);
    expect(await childValidatorSet.totalDelegationOf(accounts[0].address)).to.equal(0);
    expect(validator.commission).to.equal(0);
    expect(await childValidatorSet.bls()).to.equal(bls.address);
    expect(await childValidatorSet.totalActiveStake()).to.equal(minStake * 2);
  });

  it("Attempt reinitialization", async () => {
    await expect(
      systemChildValidatorSet.initialize(
        { epochReward, minStake, minDelegation, epochSize: 64 },
        [validatorInit],
        bls.address,
        governance
      )
    ).to.be.revertedWith("Initializable: contract is already initialized");
  });

  it("Commit epoch without system call", async () => {
    id = 0;
    epoch = {
      startBlock: 0,
      endBlock: 0,
      epochRoot: ethers.utils.randomBytes(32),
    };

    uptime = {
      epochId: 0,
      uptimeData: [{ validator: accounts[0].address, signedBlocks: 0 }],
      totalBlocks: 0,
    };

    await expect(childValidatorSet.commitEpoch(id, epoch, uptime))
      .to.be.revertedWithCustomError(childValidatorSet, "Unauthorized")
      .withArgs("SYSTEMCALL");
  });
  it("Commit epoch with unexpected id", async () => {
    id = 0;
    epoch = {
      startBlock: 0,
      endBlock: 0,
      epochRoot: ethers.utils.randomBytes(32),
    };

    uptime = {
      epochId: 0,
      uptimeData: [{ validator: accounts[0].address, signedBlocks: 0 }],
      totalBlocks: 0,
    };

    await expect(systemChildValidatorSet.commitEpoch(id, epoch, uptime)).to.be.revertedWith("UNEXPECTED_EPOCH_ID");
  });
  it("Commit epoch with no blocks committed", async () => {
    id = 1;
    epoch = {
      startBlock: 0,
      endBlock: 0,
      epochRoot: ethers.utils.randomBytes(32),
    };

    uptime = {
      epochId: 0,
      uptimeData: [{ validator: accounts[0].address, signedBlocks: 0 }],
      totalBlocks: 0,
    };

    await expect(systemChildValidatorSet.commitEpoch(id, epoch, uptime)).to.be.revertedWith("NO_BLOCKS_COMMITTED");
  });
  it("Commit epoch with incomplete epochSize", async () => {
    id = 1;
    epoch = {
      startBlock: 1,
      endBlock: 63,
      epochRoot: ethers.utils.randomBytes(32),
    };

    uptime = {
      epochId: 0,
      uptimeData: [{ validator: accounts[0].address, signedBlocks: 0 }],
      totalBlocks: 0,
    };

    await expect(systemChildValidatorSet.commitEpoch(id, epoch, uptime)).to.be.revertedWith(
      "EPOCH_MUST_BE_DIVISIBLE_BY_EPOCH_SIZE"
    );
  });
  it("Commit epoch with not committed epoch", async () => {
    id = 1;
    epoch = {
      startBlock: 1,
      endBlock: 64,
      epochRoot: ethers.utils.randomBytes(32),
    };

    uptime = {
      epochId: 2,
      uptimeData: [{ validator: accounts[0].address, signedBlocks: 0 }],
      totalBlocks: 0,
    };

    await expect(systemChildValidatorSet.commitEpoch(id, epoch, uptime)).to.be.revertedWith("EPOCH_NOT_COMMITTED");
  });
  it("Commit epoch with invalid length", async () => {
    id = 1;
    epoch = {
      startBlock: 1,
      endBlock: 64,
      epochRoot: ethers.utils.randomBytes(32),
    };

    const currentEpochId = await childValidatorSet.currentEpochId();
    uptime = {
      epochId: currentEpochId,
      uptimeData: [
        { validator: accounts[0].address, signedBlocks: 0 },
        { validator: accounts[0].address, signedBlocks: 0 },
      ],
      totalBlocks: 0,
    };

    await expect(systemChildValidatorSet.commitEpoch(id, epoch, uptime)).to.be.revertedWith("INVALID_LENGTH");
  });
  it("Commit epoch", async () => {
    id = 1;
    epoch = {
      startBlock: BigNumber.from(1),
      endBlock: BigNumber.from(64),
      epochRoot: ethers.utils.randomBytes(32),
      validatorSet: [accounts[0].address],
    };

    const currentEpochId = await childValidatorSet.currentEpochId();

    uptime = {
      epochId: currentEpochId,
      uptimeData: [{ validator: accounts[0].address, signedBlocks: 1000000000000 }],
      totalBlocks: 1,
    };

    const tx = await systemChildValidatorSet.commitEpoch(id, epoch, uptime);

    await expect(tx)
      .to.emit(childValidatorSet, "NewEpoch")
      .withArgs(currentEpochId, epoch.startBlock, epoch.endBlock, ethers.utils.hexlify(epoch.epochRoot));

    const storedEpoch: any = await childValidatorSet.epochs(1);
    expect(storedEpoch.startBlock).to.equal(epoch.startBlock);
    expect(storedEpoch.endBlock).to.equal(epoch.endBlock);
    expect(storedEpoch.epochRoot).to.equal(ethers.utils.hexlify(epoch.epochRoot));
  });

  it("Commit epoch with old block", async () => {
    const epoch = {
      startBlock: 64,
      endBlock: 127,
      epochRoot: ethers.utils.randomBytes(32),
    };

    uptime = {
      epochId: 0,
      uptimeData: [{ validator: accounts[0].address, signedBlocks: 0 }],
      totalBlocks: 1,
    };

    await expect(systemChildValidatorSet.commitEpoch(2, epoch, uptime)).to.be.revertedWith("INVALID_START_BLOCK");
  });

  it("Get current validators", async () => {
    expect(await childValidatorSet.getCurrentValidatorSet()).to.deep.equal([accounts[0].address]);
  });
  it("Get epoch by block", async () => {
    const storedEpoch = await childValidatorSet.getEpochByBlock(64);
    expect(storedEpoch.startBlock).to.equal(epoch.startBlock);
    expect(storedEpoch.endBlock).to.equal(epoch.endBlock);
    expect(storedEpoch.epochRoot).to.equal(ethers.utils.hexlify(epoch.epochRoot));
  });
  it("Get non-existent epoch by block", async () => {
    const storedEpoch = await childValidatorSet.getEpochByBlock(65);
    expect(storedEpoch.startBlock).to.equal(ethers.constants.Zero);
    expect(storedEpoch.endBlock).to.equal(ethers.constants.Zero);
    expect(storedEpoch.epochRoot).to.equal(ethers.constants.HashZero);
  });

  it("Commit epoch for validator without staking", async () => {
    id = 2;
    epoch = {
      startBlock: 65,
      endBlock: 128,
      epochRoot: ethers.utils.randomBytes(32),
      validatorSet: [accounts[1].address],
    };

    const currentEpochId = await childValidatorSet.currentEpochId();

    uptime = {
      epochId: currentEpochId,
      uptimeData: [{ validator: accounts[1].address, signedBlocks: 1000000000000 }],
      totalBlocks: 1,
    };

    const tx = await systemChildValidatorSet.commitEpoch(id, epoch, uptime);
    await expect(tx)
      .to.emit(childValidatorSet, "NewEpoch")
      .withArgs(currentEpochId, epoch.startBlock, epoch.endBlock, ethers.utils.hexlify(epoch.epochRoot));

    const storedEpoch: any = await childValidatorSet.epochs(2);
    expect(storedEpoch.startBlock).to.equal(epoch.startBlock);
    expect(storedEpoch.endBlock).to.equal(epoch.endBlock);
    expect(storedEpoch.epochRoot).to.equal(ethers.utils.hexlify(epoch.epochRoot));
  });

  describe("whitelist", async () => {
    it("only owner should be able to modify whitelist", async () => {
      await expect(childValidatorSet.connect(accounts[1]).addToWhitelist([accounts[1].address])).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
      await expect(
        childValidatorSet.connect(accounts[1]).removeFromWhitelist([accounts[1].address])
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("should be able to add to whitelist", async () => {
      await expect(childValidatorSet.addToWhitelist([accounts[1].address, accounts[2].address])).to.not.be.reverted;
      expect(await childValidatorSet.whitelist(accounts[1].address)).to.be.true;
      expect(await childValidatorSet.whitelist(accounts[2].address)).to.be.true;
    });
    it("should be able to remove from whitelist", async () => {
      await expect(childValidatorSet.removeFromWhitelist([accounts[1].address])).to.not.be.reverted;
      expect(await childValidatorSet.whitelist(accounts[1].address)).to.be.false;
    });
  });

  describe("register", async () => {
    it("only whitelisted should be able to register", async () => {
      await expect(childValidatorSet.connect(accounts[1]).register([0, 0], [0, 0, 0, 0]))
        .to.be.revertedWithCustomError(childValidatorSet, "Unauthorized")
        .withArgs("WHITELIST");
    });
    it("invalid signature / should not be able to replay signature", async () => {
      const keyPair = mcl.newKeyPair();
      const signature = mcl.signValidatorMessage(DOMAIN, CHAIN_ID, accounts[0].address, keyPair.secret).signature;

      await expect(childValidatorSet.connect(accounts[2]).register(mcl.g1ToHex(signature), mcl.g2ToHex(keyPair.pubkey)))
        .to.be.revertedWithCustomError(childValidatorSet, "InvalidSignature")
        .withArgs(accounts[2].address);
    });
    it("register", async () => {
      const keyPair = mcl.newKeyPair();
      const signature = mcl.signValidatorMessage(DOMAIN, CHAIN_ID, accounts[2].address, keyPair.secret).signature;

      const tx = await childValidatorSet
        .connect(accounts[2])
        .register(mcl.g1ToHex(signature), mcl.g2ToHex(keyPair.pubkey));

      await expect(tx)
        .to.emit(childValidatorSet, "NewValidator")
        .withArgs(
          accounts[2].address,
          mcl.g2ToHex(keyPair.pubkey).map((x) => BigNumber.from(x))
        );

      expect(await childValidatorSet.whitelist(accounts[2].address)).to.be.false;
      const validator = await childValidatorSet.getValidator(accounts[2].address);
      expect(validator.stake).to.equal(0);
      expect(await childValidatorSet.totalDelegationOf(accounts[2].address)).to.equal(0);
      expect(validator.commission).to.equal(0);
      expect(validator.active).to.equal(true);
      expect(validator.blsKey.map((x) => x.toHexString())).to.deep.equal(mcl.g2ToHex(keyPair.pubkey));
    });
  });

  describe("stake", async () => {
    it("only whitelisted validators should be able to stake", async () => {
      await expect(childValidatorSet.connect(accounts[1]).stake({ value: minStake }))
        .to.be.revertedWithCustomError(childValidatorSet, "Unauthorized")
        .withArgs("VALIDATOR");
    });

    it("should revert if min amount not reached", async () => {
      await expect(childValidatorSet.connect(accounts[2]).stake({ value: minStake - 1 }))
        .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
        .withArgs("stake", "STAKE_TOO_LOW");
    });

    it("should be able to stake", async () => {
      const tx = childValidatorSet.connect(accounts[2]).stake({ value: minStake * 2 });

      await expect(tx)
        .to.emit(childValidatorSet, "Staked")
        .withArgs(accounts[2].address, minStake * 2);
      expect(await childValidatorSet.totalActiveStake()).to.equal(minStake * 2);
    });

    it("Get 0 sortedValidators", async () => {
      const validatorAddresses = await childValidatorSet.sortedValidators(0);
      expect(validatorAddresses).to.deep.equal([]);
    });
  });

  describe("queue processing", async () => {
    it("should be able to process queue", async () => {
      let validator = await childValidatorSet.getValidator(accounts[2].address);
      expect(validator.stake).to.equal(0);
      await expect(
        systemChildValidatorSet.commitEpoch(
          3,
          { startBlock: 129, endBlock: 192, epochRoot: ethers.constants.HashZero },
          { epochId: 3, uptimeData: [{ validator: accounts[0].address, signedBlocks: 1 }], totalBlocks: 1 }
        )
      ).to.not.be.reverted;
      validator = await childValidatorSet.getValidator(accounts[2].address);
      expect(validator.stake).to.equal(minStake * 2);
    });

    it("Get 2 sortedValidators ", async () => {
      const validatorAddresses = await childValidatorSet.sortedValidators(3);
      expect(validatorAddresses).to.deep.equal([accounts[2].address, accounts[0].address]);
    });
  });

  describe("unstake", async () => {
    it("non validators should not be able to unstake due to insufficient balance", async () => {
      await expect(childValidatorSet.connect(accounts[1]).unstake(1))
        .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
        .withArgs("unstake", "INSUFFICIENT_BALANCE");
    });

    it("should not be able to exploit int overflow", async () => {
      await expect(childValidatorSet.connect(accounts[1]).unstake(ethers.constants.MaxInt256.add(1))).to.be.reverted;
    });

    it("should not be able to unstake more than staked", async () => {
      await expect(childValidatorSet.unstake(minStake * 2 + 1))
        .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
        .withArgs("unstake", "INSUFFICIENT_BALANCE");
    });

    it("should not be able to unstake so that less than minstake is left", async () => {
      await expect(childValidatorSet.unstake(minStake + 1))
        .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
        .withArgs("unstake", "STAKE_TOO_LOW");
    });

    it("should be able to partially unstake", async () => {
      const tx = await childValidatorSet.connect(accounts[2]).unstake(minStake);
      await expect(tx).to.emit(childValidatorSet, "Unstaked").withArgs(accounts[2].address, minStake);
    });

    it("should take pending unstakes into account", async () => {
      await expect(childValidatorSet.connect(accounts[2]).unstake(minStake + 1))
        .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
        .withArgs("unstake", "INSUFFICIENT_BALANCE");
      await expect(childValidatorSet.connect(accounts[2]).unstake(1))
        .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
        .withArgs("unstake", "STAKE_TOO_LOW");
    });

    it("should be able to completely unstake", async () => {
      const tx = childValidatorSet.connect(accounts[2]).unstake(minStake);
      await expect(tx).to.emit(childValidatorSet, "Unstaked").withArgs(accounts[2].address, minStake);
    });

    it("should place in withdrawal queue", async () => {
      expect(await childValidatorSet.pendingWithdrawals(accounts[2].address)).to.equal(minStake * 2);
      expect(await childValidatorSet.withdrawable(accounts[2].address)).to.equal(0);
    });

    it("should reflect balance after queue processing", async () => {
      let validator = await childValidatorSet.getValidator(accounts[2].address);
      expect(validator.stake).to.equal(minStake * 2);
      await expect(
        systemChildValidatorSet.commitEpoch(
          4,
          { startBlock: 193, endBlock: 256, epochRoot: ethers.constants.HashZero },
          {
            epochId: 4,
            uptimeData: [
              { validator: accounts[0].address, signedBlocks: 1 },
              { validator: accounts[2].address, signedBlocks: 1 },
            ],
            totalBlocks: 2,
          }
        )
      ).to.not.be.reverted;

      validator = await childValidatorSet.getValidator(accounts[2].address);
      expect(validator.stake).to.equal(0);

      expect(await childValidatorSet.pendingWithdrawals(accounts[2].address)).to.equal(0);
      expect(await childValidatorSet.withdrawable(accounts[2].address)).to.equal(minStake * 2);
    });
  });

  describe("Withdraw", async () => {
    it("withdrawal failed", async () => {
      childValidatorSetBalance = await ethers.provider.getBalance(childValidatorSet.address);
      await setBalance(childValidatorSet.address, 0);

      await expect(childValidatorSet.connect(accounts[2]).withdraw(accounts[0].address)).to.be.revertedWith(
        "WITHDRAWAL_FAILED"
      );
    });

    it("withdraw", async () => {
      await setBalance(childValidatorSet.address, childValidatorSetBalance);
      const tx = await childValidatorSet.connect(accounts[2]).withdraw(accounts[2].address);
      expect(await childValidatorSet.pendingWithdrawals(accounts[2].address)).to.equal(0);
      expect(await childValidatorSet.withdrawable(accounts[2].address)).to.equal(0);

      await expect(tx)
        .to.emit(childValidatorSet, "Withdrawal")
        .withArgs(accounts[2].address, accounts[2].address, minStake * 2);
    });
  });

  describe("delegate", async () => {
    it("should only be able to delegate to validators", async () => {
      const restake = false;

      await expect(childValidatorSet.delegate(accounts[1].address, restake, { value: minDelegation }))
        .to.be.revertedWithCustomError(childValidatorSet, "Unauthorized")
        .withArgs("INVALID_VALIDATOR");
    });

    it("Delegate less amount than minDelegation", async () => {
      const restake = false;

      await expect(childValidatorSet.delegate(accounts[0].address, restake, { value: 100 }))
        .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
        .withArgs("delegate", "DELEGATION_TOO_LOW");
    });

    it("Delegate for the first time", async () => {
      const delegateAmount = minDelegation + 1;
      const restake = false;

      // Register accounts[2] as validator
      await childValidatorSet.addToWhitelist([accounts[2].address]);
      const keyPair = mcl.newKeyPair();
      const signature = mcl.signValidatorMessage(DOMAIN, CHAIN_ID, accounts[2].address, keyPair.secret).signature;

      await childValidatorSet.connect(accounts[2]).register(mcl.g1ToHex(signature), mcl.g2ToHex(keyPair.pubkey));
      await childValidatorSet.connect(accounts[2]).stake({ value: minStake });
      const tx = await childValidatorSet.connect(accounts[3]).delegate(accounts[2].address, restake, {
        value: delegateAmount,
      });

      await expect(tx)
        .to.emit(childValidatorSet, "Delegated")
        .withArgs(accounts[3].address, accounts[2].address, delegateAmount);

      const delegation = await childValidatorSet.delegationOf(accounts[2].address, accounts[3].address);
      expect(delegation).to.equal(delegateAmount);
    });

    it("Delegate again without restake", async () => {
      const delegateAmount = minDelegation + 1;
      const restake = false;

      const tx = await childValidatorSet.connect(accounts[3]).delegate(accounts[2].address, restake, {
        value: delegateAmount,
      });

      await expect(tx)
        .to.emit(childValidatorSet, "Delegated")
        .withArgs(accounts[3].address, accounts[2].address, delegateAmount);
    });

    it("Delegate again with restake", async () => {
      const delegateAmount = minDelegation + 1;
      const restake = true;

      const tx = await childValidatorSet.connect(accounts[3]).delegate(accounts[2].address, restake, {
        value: delegateAmount,
      });

      await expect(tx)
        .to.emit(childValidatorSet, "Delegated")
        .withArgs(accounts[3].address, accounts[2].address, delegateAmount);
    });
  });

  describe("Claim", async () => {
    it("Claim validator reward", async () => {
      const reward = await childValidatorSet.getValidatorReward(accounts[0].address);
      const tx = await childValidatorSet.claimValidatorReward();

      const receipt = await tx.wait();
      const event = receipt.events?.find((log) => log.event === "ValidatorRewardClaimed");
      expect(event?.args?.validator).to.equal(accounts[0].address);
      expect(event?.args?.amount).to.equal(reward);

      await expect(tx).to.emit(childValidatorSet, "WithdrawalRegistered").withArgs(accounts[0].address, reward);
    });

    it("Claim delegatorReward with restake", async () => {
      await expect(
        systemChildValidatorSet.commitEpoch(
          5,
          { startBlock: 257, endBlock: 320, epochRoot: ethers.constants.HashZero },
          {
            epochId: 5,
            uptimeData: [{ validator: accounts[2].address, signedBlocks: 1 }],
            totalBlocks: 2,
          }
        )
      ).to.not.be.reverted;

      await expect(
        systemChildValidatorSet.commitEpoch(
          6,
          { startBlock: 321, endBlock: 384, epochRoot: ethers.constants.HashZero },
          {
            epochId: 6,
            uptimeData: [{ validator: accounts[2].address, signedBlocks: 1 }],
            totalBlocks: 2,
          }
        )
      ).to.not.be.reverted;

      const reward = await childValidatorSet.getDelegatorReward(accounts[2].address, accounts[3].address);

      // Claim with restake
      const tx = await childValidatorSet.connect(accounts[3]).claimDelegatorReward(accounts[2].address, true);

      const receipt = await tx.wait();
      const event = receipt.events?.find((log) => log.event === "DelegatorRewardClaimed");
      expect(event?.args?.delegator).to.equal(accounts[3].address);
      expect(event?.args?.validator).to.equal(accounts[2].address);
      expect(event?.args?.restake).to.equal(true);
      expect(event?.args?.amount).to.equal(reward);

      await expect(tx)
        .to.emit(childValidatorSet, "Delegated")
        .withArgs(accounts[3].address, accounts[2].address, reward);
    });

    it("Claim delegatorReward without restake", async () => {
      await expect(
        systemChildValidatorSet.commitEpoch(
          7,
          { startBlock: 385, endBlock: 448, epochRoot: ethers.constants.HashZero },
          {
            epochId: 7,
            uptimeData: [{ validator: accounts[2].address, signedBlocks: 1 }],
            totalBlocks: 2,
          }
        )
      ).to.not.be.reverted;

      await expect(
        systemChildValidatorSet.commitEpoch(
          8,
          { startBlock: 449, endBlock: 512, epochRoot: ethers.constants.HashZero },
          {
            epochId: 8,
            uptimeData: [{ validator: accounts[2].address, signedBlocks: 1 }],
            totalBlocks: 2,
          }
        )
      ).to.not.be.reverted;

      const reward = await childValidatorSet.getDelegatorReward(accounts[2].address, accounts[3].address);
      // Claim without restake
      const tx = await childValidatorSet.connect(accounts[3]).claimDelegatorReward(accounts[2].address, false);

      const receipt = await tx.wait();
      const event = receipt.events?.find((log) => log.event === "DelegatorRewardClaimed");
      expect(event?.args?.delegator).to.equal(accounts[3].address);
      expect(event?.args?.validator).to.equal(accounts[2].address);
      expect(event?.args?.restake).to.equal(false);
      expect(event?.args?.amount).to.equal(reward);

      await expect(tx).to.emit(childValidatorSet, "WithdrawalRegistered").withArgs(accounts[3].address, reward);
    });
  });

  describe("commitEpochWithDoubleSignerSlashing", async () => {
    it("failed by invalid length", async () => {
      id = 9;
      epoch = {
        startBlock: 513,
        endBlock: 577,
        epochRoot: ethers.utils.randomBytes(32),
      };

      const currentEpochId = await childValidatorSet.currentEpochId();

      uptime = {
        epochId: currentEpochId,
        uptimeData: [{ validator: accounts[2].address, signedBlocks: 1 }],
        totalBlocks: 2,
      };

      const blockNumber = 0;
      const pbftRound = 0;

      doubleSignerSlashingInput = [
        {
          epochId: 0,
          eventRoot: ethers.utils.randomBytes(32),
          currentValidatorSetHash: ethers.utils.randomBytes(32),
          nextValidatorSetHash: ethers.utils.randomBytes(32),
          blockHash: ethers.utils.randomBytes(32),
          bitmap: "0x",
          signature: "",
        },
      ];
      const signature = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["uint", "uint", "bytes32", "uint", "uint", "bytes32", "bytes32", "bytes32"],
          [
            chainId,
            blockNumber,
            doubleSignerSlashingInput[0].blockHash,
            pbftRound,
            doubleSignerSlashingInput[0].epochId,
            doubleSignerSlashingInput[0].eventRoot,
            doubleSignerSlashingInput[0].currentValidatorSetHash,
            doubleSignerSlashingInput[0].nextValidatorSetHash,
          ]
        )
      );
      doubleSignerSlashingInput[0].signature = signature;

      await expect(
        systemChildValidatorSet.commitEpochWithDoubleSignerSlashing(
          currentEpochId,
          blockNumber,
          pbftRound,
          epoch,
          uptime,
          doubleSignerSlashingInput
        )
      ).to.be.revertedWith("INVALID_LENGTH");
    });

    it("failed by blockhash not unique", async () => {
      id = 9;
      epoch = {
        startBlock: 513,
        endBlock: 577,
        epochRoot: ethers.utils.randomBytes(32),
      };

      const currentEpochId = await childValidatorSet.currentEpochId();

      uptime = {
        epochId: currentEpochId,
        uptimeData: [{ validator: accounts[2].address, signedBlocks: 1 }],
        totalBlocks: 2,
      };

      const blockNumber = 0;
      const pbftRound = 0;

      const blockHash = ethers.utils.randomBytes(32);
      doubleSignerSlashingInput = [
        {
          epochId: 0,
          eventRoot: ethers.utils.randomBytes(32),
          currentValidatorSetHash: ethers.utils.randomBytes(32),
          nextValidatorSetHash: ethers.utils.randomBytes(32),
          blockHash,
          bitmap: "0x",
          signature: "",
        },
        {
          epochId: 0,
          eventRoot: ethers.utils.randomBytes(32),
          currentValidatorSetHash: ethers.utils.randomBytes(32),
          nextValidatorSetHash: ethers.utils.randomBytes(32),
          blockHash,
          bitmap: "0x",
          signature: "",
        },
      ];
      for (let i = 0; i < doubleSignerSlashingInput.length; i++) {
        doubleSignerSlashingInput[i].signature = ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ["uint", "uint", "bytes32", "uint", "uint", "bytes32", "bytes32", "bytes32"],
            [
              chainId,
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

      await expect(
        systemChildValidatorSet.commitEpochWithDoubleSignerSlashing(
          currentEpochId,
          blockNumber,
          pbftRound,
          epoch,
          uptime,
          doubleSignerSlashingInput
        )
      ).to.be.revertedWith("BLOCKHASH_NOT_UNIQUE");
    });

    it("failed by signature verification failed", async () => {
      id = 9;
      epoch = {
        startBlock: 513,
        endBlock: 577,
        epochRoot: ethers.utils.randomBytes(32),
      };

      const currentEpochId = await childValidatorSet.currentEpochId();

      uptime = {
        epochId: currentEpochId,
        uptimeData: [{ validator: accounts[2].address, signedBlocks: 1 }],
        totalBlocks: 2,
      };

      const blockNumber = 0;
      const pbftRound = 0;

      doubleSignerSlashingInput = [
        {
          epochId: 0,
          eventRoot: ethers.utils.randomBytes(32),
          currentValidatorSetHash: ethers.utils.randomBytes(32),
          nextValidatorSetHash: ethers.utils.randomBytes(32),
          blockHash: ethers.utils.randomBytes(32),
          bitmap: "0x",
          signature: "",
        },
        {
          epochId: 0,
          eventRoot: ethers.utils.randomBytes(32),
          currentValidatorSetHash: ethers.utils.randomBytes(32),
          nextValidatorSetHash: ethers.utils.randomBytes(32),
          blockHash: ethers.utils.randomBytes(32),
          bitmap: "0x",
          signature: "",
        },
      ];
      for (let i = 0; i < doubleSignerSlashingInput.length; i++) {
        doubleSignerSlashingInput[i].signature = ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ["uint", "uint", "bytes32", "uint", "uint", "bytes32", "bytes32", "bytes32"],
            [
              chainId,
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
      doubleSignerSlashingInput[1].signature = doubleSignerSlashingInput[0].signature; // For signature verification failed

      await hre.network.provider.send("hardhat_setCode", [
        "0x0000000000000000000000000000000000002030",
        alwaysFalseBytecode,
      ]);

      await expect(
        systemChildValidatorSet.commitEpochWithDoubleSignerSlashing(
          currentEpochId,
          blockNumber,
          pbftRound,
          epoch,
          uptime,
          doubleSignerSlashingInput
        )
      ).to.be.revertedWith("SIGNATURE_VERIFICATION_FAILED");
    });

    it("failed by unexpected epoch id", async () => {
      id = 8;
      epoch = {
        startBlock: 513,
        endBlock: 577,
        epochRoot: ethers.utils.randomBytes(32),
      };

      const currentEpochId = await childValidatorSet.currentEpochId();

      uptime = {
        epochId: currentEpochId,
        uptimeData: [{ validator: accounts[2].address, signedBlocks: 1 }],
        totalBlocks: 2,
      };

      const blockNumber = 0;
      const pbftRound = 0;

      doubleSignerSlashingInput = [
        {
          epochId: 0,
          eventRoot: ethers.utils.randomBytes(32),
          currentValidatorSetHash: ethers.utils.randomBytes(32),
          nextValidatorSetHash: ethers.utils.randomBytes(32),
          blockHash: ethers.utils.randomBytes(32),
          bitmap: "0x",
          signature: "",
        },
        {
          epochId: 0,
          eventRoot: ethers.utils.randomBytes(32),
          currentValidatorSetHash: ethers.utils.randomBytes(32),
          nextValidatorSetHash: ethers.utils.randomBytes(32),
          blockHash: ethers.utils.randomBytes(32),
          bitmap: "0x",
          signature: "",
        },
      ];
      for (let i = 0; i < doubleSignerSlashingInput.length; i++) {
        doubleSignerSlashingInput[i].signature = ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ["uint", "uint", "bytes32", "uint", "uint", "bytes32", "bytes32", "bytes32"],
            [
              chainId,
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

      await expect(
        systemChildValidatorSet.commitEpochWithDoubleSignerSlashing(
          0,
          blockNumber,
          pbftRound,
          epoch,
          uptime,
          doubleSignerSlashingInput
        )
      ).to.be.revertedWith("UNEXPECTED_EPOCH_ID");
    });

    it("failed by no blocks committed", async () => {
      id = 9;
      epoch = {
        startBlock: 513,
        endBlock: 513,
        epochRoot: ethers.utils.randomBytes(32),
      };

      const currentEpochId = await childValidatorSet.currentEpochId();

      uptime = {
        epochId: currentEpochId,
        uptimeData: [{ validator: accounts[2].address, signedBlocks: 1 }],
        totalBlocks: 2,
      };

      const blockNumber = 0;
      const pbftRound = 0;

      doubleSignerSlashingInput = [
        {
          epochId: currentEpochId,
          eventRoot: ethers.utils.randomBytes(32),
          currentValidatorSetHash: ethers.utils.randomBytes(32),
          nextValidatorSetHash: ethers.utils.randomBytes(32),
          blockHash: ethers.utils.randomBytes(32),
          bitmap: "0x",
          signature: "",
        },
        {
          epochId: currentEpochId,
          eventRoot: ethers.utils.randomBytes(32),
          currentValidatorSetHash: ethers.utils.randomBytes(32),
          nextValidatorSetHash: ethers.utils.randomBytes(32),
          blockHash: ethers.utils.randomBytes(32),
          bitmap: "0x",
          signature: "",
        },
      ];
      for (let i = 0; i < doubleSignerSlashingInput.length; i++) {
        doubleSignerSlashingInput[i].signature = ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ["uint", "uint", "bytes32", "uint", "uint", "bytes32", "bytes32", "bytes32"],
            [
              chainId,
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

      await expect(
        systemChildValidatorSet.commitEpochWithDoubleSignerSlashing(
          currentEpochId,
          blockNumber,
          pbftRound,
          epoch,
          uptime,
          doubleSignerSlashingInput
        )
      ).to.be.revertedWith("NO_BLOCKS_COMMITTED");
    });

    it("failed by invalid length", async () => {
      id = 9;
      epoch = {
        startBlock: 513,
        endBlock: 577,
        epochRoot: ethers.utils.randomBytes(32),
      };

      const currentEpochId = await childValidatorSet.currentEpochId();

      uptime = {
        epochId: currentEpochId,
        uptimeData: [
          { validator: accounts[2].address, signedBlocks: 1 },
          { validator: accounts[2].address, signedBlocks: 1 },
          { validator: accounts[2].address, signedBlocks: 1 },
        ],
        totalBlocks: 2,
      };

      const blockNumber = 0;
      const pbftRound = 0;

      doubleSignerSlashingInput = [
        {
          epochId: currentEpochId,
          eventRoot: ethers.utils.randomBytes(32),
          currentValidatorSetHash: ethers.utils.randomBytes(32),
          nextValidatorSetHash: ethers.utils.randomBytes(32),
          blockHash: ethers.utils.randomBytes(32),
          bitmap: "0x",
          signature: "",
        },
        {
          epochId: currentEpochId,
          eventRoot: ethers.utils.randomBytes(32),
          currentValidatorSetHash: ethers.utils.randomBytes(32),
          nextValidatorSetHash: ethers.utils.randomBytes(32),
          blockHash: ethers.utils.randomBytes(32),
          bitmap: "0x",
          signature: "",
        },
      ];
      for (let i = 0; i < doubleSignerSlashingInput.length; i++) {
        doubleSignerSlashingInput[i].signature = ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ["uint", "uint", "bytes32", "uint", "uint", "bytes32", "bytes32", "bytes32"],
            [
              chainId,
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

      await expect(
        systemChildValidatorSet.commitEpochWithDoubleSignerSlashing(
          currentEpochId,
          blockNumber,
          pbftRound,
          epoch,
          uptime,
          doubleSignerSlashingInput
        )
      ).to.be.revertedWith("INVALID_LENGTH");
    });

    it("success", async () => {
      id = 9;
      epoch = {
        startBlock: 513,
        endBlock: 577,
        epochRoot: ethers.utils.randomBytes(32),
      };

      const currentEpochId = await childValidatorSet.currentEpochId();

      uptime = {
        epochId: currentEpochId,
        uptimeData: [{ validator: accounts[2].address, signedBlocks: 1 }],
        totalBlocks: 2,
      };

      const blockNumber = 0;
      const pbftRound = 0;

      doubleSignerSlashingInput = [
        {
          epochId: currentEpochId,
          eventRoot: ethers.utils.randomBytes(32),
          currentValidatorSetHash: ethers.utils.randomBytes(32),
          nextValidatorSetHash: ethers.utils.randomBytes(32),
          blockHash: ethers.utils.randomBytes(32),
          bitmap: "0x000000000000000000000000",
          signature: "",
        },
        {
          epochId: currentEpochId,
          eventRoot: ethers.utils.randomBytes(32),
          currentValidatorSetHash: ethers.utils.randomBytes(32),
          nextValidatorSetHash: ethers.utils.randomBytes(32),
          blockHash: ethers.utils.randomBytes(32),
          bitmap: "0x000000000000000000000000",
          signature: "",
        },
      ];
      for (let i = 0; i < doubleSignerSlashingInput.length; i++) {
        doubleSignerSlashingInput[i].signature = ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ["uint", "uint", "bytes32", "uint", "uint", "bytes32", "bytes32", "bytes32"],
            [
              chainId,
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

      await systemChildValidatorSet.commitEpochWithDoubleSignerSlashing(
        currentEpochId,
        blockNumber,
        pbftRound,
        epoch,
        uptime,
        doubleSignerSlashingInput
      );
    });

    it("failed by old block", async () => {
      id = 10;
      epoch = {
        startBlock: 576,
        endBlock: 600,
        epochRoot: ethers.utils.randomBytes(32),
      };

      const currentEpochId = await childValidatorSet.currentEpochId();

      uptime = {
        epochId: currentEpochId,
        uptimeData: [{ validator: accounts[2].address, signedBlocks: 1 }],
        totalBlocks: 2,
      };

      const blockNumber = 0;
      const pbftRound = 0;

      doubleSignerSlashingInput = [
        {
          epochId: currentEpochId,
          eventRoot: ethers.utils.randomBytes(32),
          currentValidatorSetHash: ethers.utils.randomBytes(32),
          nextValidatorSetHash: ethers.utils.randomBytes(32),
          blockHash: ethers.utils.randomBytes(32),
          bitmap: "0x",
          signature: "",
        },
        {
          epochId: currentEpochId,
          eventRoot: ethers.utils.randomBytes(32),
          currentValidatorSetHash: ethers.utils.randomBytes(32),
          nextValidatorSetHash: ethers.utils.randomBytes(32),
          blockHash: ethers.utils.randomBytes(32),
          bitmap: "0x",
          signature: "",
        },
      ];
      for (let i = 0; i < doubleSignerSlashingInput.length; i++) {
        doubleSignerSlashingInput[i].signature = ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ["uint", "uint", "bytes32", "uint", "uint", "bytes32", "bytes32", "bytes32"],
            [
              chainId,
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

      await expect(
        systemChildValidatorSet.commitEpochWithDoubleSignerSlashing(
          currentEpochId,
          blockNumber,
          pbftRound,
          epoch,
          uptime,
          doubleSignerSlashingInput
        )
      ).to.be.revertedWith("INVALID_START_BLOCK");
    });

    it("success with fuzzy bitmap for fuzzy length of validators", async () => {
      const newValidatorsCount = Math.floor(Math.random() * 4 + 6); // Randomly pick 6-10
      for (let i = 0; i < newValidatorsCount; i++) {
        const signer = new ethers.Wallet(ethers.Wallet.createRandom(), ethers.provider);
        await setBalance(signer.address, ethers.utils.parseEther("1000000"));
        await expect(childValidatorSet.addToWhitelist([signer.address])).to.not.be.reverted;

        const keyPair = mcl.newKeyPair();
        const signature = mcl.signValidatorMessage(DOMAIN, CHAIN_ID, signer.address, keyPair.secret).signature;

        await childValidatorSet.connect(signer).register(mcl.g1ToHex(signature), mcl.g2ToHex(keyPair.pubkey));
        await childValidatorSet.connect(signer).stake({ value: minStake * 2 });
        const validator = await childValidatorSet.getValidator(signer.address);

        expect(validator.active).to.equal(true);

        epoch = {
          startBlock: BigNumber.from(578 + i * 64),
          endBlock: BigNumber.from(641 + i * 64),
          epochRoot: ethers.utils.randomBytes(32),
          validatorSet: [signer.address],
        };

        const currentEpochId = await childValidatorSet.currentEpochId();

        uptime = {
          epochId: currentEpochId,
          uptimeData: [{ validator: signer.address, signedBlocks: 1000000000000 }],
          totalBlocks: 1,
        };

        await systemChildValidatorSet.commitEpoch(id, epoch, uptime);
        id++;
      }

      epoch = {
        startBlock: parseInt(epoch.startBlock, 10) + 64,
        endBlock: parseInt(epoch.endBlock, 10) + 64,
        epochRoot: ethers.utils.randomBytes(32),
      };

      const currentEpochId = await childValidatorSet.currentEpochId();

      uptime = {
        epochId: currentEpochId,
        uptimeData: [{ validator: accounts[2].address, signedBlocks: 1 }],
        totalBlocks: 2,
      };

      const blockNumber = 0;
      const pbftRound = 0;

      // eslint-disable-next-line no-loss-of-precision
      const bitmap = Math.floor(Math.random() * 0xffffffffffffffff);
      let bitmapStr = bitmap.toString(16);
      const bitmapLength = bitmapStr.length;
      for (let j = 0; j < 16 - bitmapLength; j++) {
        bitmapStr = "0" + bitmapStr;
      }

      doubleSignerSlashingInput = [
        {
          epochId: currentEpochId,
          eventRoot: ethers.utils.randomBytes(32),
          currentValidatorSetHash: ethers.utils.randomBytes(32),
          nextValidatorSetHash: ethers.utils.randomBytes(32),
          blockHash: ethers.utils.randomBytes(32),
          bitmap: "0xff",
          signature: "",
        },
        {
          epochId: currentEpochId,
          eventRoot: ethers.utils.randomBytes(32),
          currentValidatorSetHash: ethers.utils.randomBytes(32),
          nextValidatorSetHash: ethers.utils.randomBytes(32),
          blockHash: ethers.utils.randomBytes(32),
          bitmap: `0x${bitmapStr}`,
          signature: "",
        },
        {
          epochId: currentEpochId,
          eventRoot: ethers.utils.randomBytes(32),
          currentValidatorSetHash: ethers.utils.randomBytes(32),
          nextValidatorSetHash: ethers.utils.randomBytes(32),
          blockHash: ethers.utils.randomBytes(32),
          bitmap: "0xffffffffffffffff",
          signature: "",
        },
      ];

      for (let i = 0; i < doubleSignerSlashingInput.length; i++) {
        doubleSignerSlashingInput[i].signature = ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ["uint", "uint", "bytes32", "uint", "uint", "bytes32", "bytes32", "bytes32"],
            [
              chainId,
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
      const validators = await childValidatorSet.getCurrentValidatorSet();
      const validatorsInfoBeforeCommitSlash = [];
      for (let i = 0; i < validators.length; i++) {
        validatorsInfoBeforeCommitSlash.push(await childValidatorSet.getValidator(validators[i]));
      }

      const tx = await systemChildValidatorSet.commitEpochWithDoubleSignerSlashing(
        currentEpochId,
        blockNumber,
        pbftRound,
        epoch,
        uptime,
        doubleSignerSlashingInput
      );

      await expect(tx)
        .to.emit(childValidatorSet, "NewEpoch")
        .withArgs(currentEpochId, epoch.startBlock, epoch.endBlock, ethers.utils.hexlify(epoch.epochRoot));

      const validatorsInfoAfterCommitSlash = [];
      for (let i = 0; i < validators.length; i++) {
        validatorsInfoAfterCommitSlash.push(await childValidatorSet.getValidator(validators[i]));
      }

      expect(validatorsInfoBeforeCommitSlash.length).to.equal(validatorsInfoAfterCommitSlash.length);

      for (let i = 0; i < validators.length; i++) {
        let count = 0;
        for (let j = 0; j < doubleSignerSlashingInput.length; j++) {
          const byteNumber = Math.floor(i / 8);
          const bitNumber = i % 8;

          if (byteNumber >= doubleSignerSlashingInput[j].bitmap.length / 2 - 1) {
            continue;
          }

          // Get the value of the bit at the given 'index' in a byte.
          const oneByte = parseInt(
            doubleSignerSlashingInput[j].bitmap[2 + byteNumber * 2] +
              doubleSignerSlashingInput[j].bitmap[3 + byteNumber * 2],
            16
          );
          if ((oneByte & (1 << bitNumber)) > 0) {
            count++;
          }

          if (count > 1) {
            expect(validatorsInfoAfterCommitSlash[i].stake).to.equal(
              validatorsInfoBeforeCommitSlash[i].stake.sub(
                validatorsInfoBeforeCommitSlash[i].stake.mul(DOUBLE_SIGNING_SLASHING_PERCENT).div(100)
              )
            );
            // expect(validatorsInfoAfterCommitSlash[i].totalStake).to.equal(
            //   validatorsInfoBeforeCommitSlash[i].totalStake.sub(
            //     validatorsInfoBeforeCommitSlash[i].totalStake.mul(DOUBLE_SIGNING_SLASHING_PERCENT).div(100)
            //   )
            // );
            break;
          }
        }
        if (count <= 1) {
          expect(validatorsInfoAfterCommitSlash[i].stake).to.equal(validatorsInfoBeforeCommitSlash[i].stake);
          // expect(validatorsInfoAfterCommitSlash[i].totalStake).to.equal(validatorsInfoBeforeCommitSlash[i].totalStake);
        }
      }

      const storedEpoch: any = await childValidatorSet.epochs(id);
      expect(storedEpoch.startBlock).to.equal(epoch.startBlock);
      expect(storedEpoch.endBlock).to.equal(epoch.endBlock);
      expect(storedEpoch.epochRoot).to.equal(ethers.utils.hexlify(epoch.epochRoot));
    });

    it("success try double sign for same epoch & pbftRound & key", async () => {
      id++;

      const startBlock = parseInt(epoch.startBlock, 10) + 64;
      const endBlock = parseInt(epoch.endBlock, 10) + 64;

      epoch = {
        startBlock: startBlock,
        endBlock: endBlock,
        epochRoot: ethers.utils.randomBytes(32),
      };

      const currentEpochId = await childValidatorSet.currentEpochId();

      uptime = {
        epochId: currentEpochId,
        uptimeData: [{ validator: accounts[2].address, signedBlocks: 1 }],
        totalBlocks: 2,
      };

      const blockNumber = 0;
      const pbftRound = 0;
      // eslint-disable-next-line no-unused-vars
      const epochId = 0;

      const validators = await childValidatorSet.getCurrentValidatorSet();
      const validatorsInfoBeforeCommitSlash = [];
      for (let i = 0; i < validators.length; i++) {
        validatorsInfoBeforeCommitSlash.push(await childValidatorSet.getValidator(validators[i]));
      }

      const tx = await systemChildValidatorSet.commitEpochWithDoubleSignerSlashing(
        currentEpochId,
        blockNumber,
        pbftRound,
        epoch,
        uptime,
        doubleSignerSlashingInput
      );

      await expect(tx)
        .to.emit(childValidatorSet, "NewEpoch")
        .withArgs(currentEpochId, epoch.startBlock, epoch.endBlock, ethers.utils.hexlify(epoch.epochRoot));

      const validatorsInfoAfterCommitSlash = [];
      for (let i = 0; i < validators.length; i++) {
        validatorsInfoAfterCommitSlash.push(await childValidatorSet.getValidator(validators[i]));
      }

      expect(validatorsInfoBeforeCommitSlash.length).to.equal(validatorsInfoAfterCommitSlash.length);

      for (let i = 0; i < validators.length; i++) {
        expect(validatorsInfoAfterCommitSlash[i].stake).to.equal(validatorsInfoBeforeCommitSlash[i].stake);
        // expect(validatorsInfoAfterCommitSlash[i].totalStake).to.equal(validatorsInfoBeforeCommitSlash[i].totalStake);
      }
    });
  });

  describe("undelegate", async () => {
    it("undelegate insufficient amount", async () => {
      const delegatedAmount = await childValidatorSet.delegationOf(accounts[2].address, accounts[3].address);
      await expect(childValidatorSet.connect(accounts[3]).undelegate(accounts[2].address, delegatedAmount.add(1)))
        .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
        .withArgs("undelegate", "INSUFFICIENT_BALANCE");
    });

    it("undelegate low amount", async () => {
      const delegatedAmount = await childValidatorSet.delegationOf(accounts[2].address, accounts[3].address);
      await expect(childValidatorSet.undelegate(accounts[2].address, delegatedAmount.sub(1)))
        .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
        .withArgs("undelegate", "DELEGATION_TOO_LOW");
    });

    it("should not be able to exploit int overflow", async () => {
      await expect(
        childValidatorSet.connect(accounts[3]).undelegate(accounts[2].address, ethers.constants.MaxInt256.add(1))
      ).to.be.reverted;
    });

    it("undelegate", async () => {
      let delegatedAmount = await childValidatorSet.delegationOf(accounts[2].address, accounts[3].address);
      const tx = await childValidatorSet.connect(accounts[3]).undelegate(accounts[2].address, delegatedAmount);

      await expect(tx)
        .to.emit(childValidatorSet, "Undelegated")
        .withArgs(accounts[3].address, accounts[2].address, delegatedAmount);

      delegatedAmount = await childValidatorSet.delegationOf(accounts[2].address, accounts[3].address);
      expect(delegatedAmount).to.equal(0);
    });
  });

  describe("Set Commision", async () => {
    it("only validator should set", async () => {
      await expect(childValidatorSet.connect(accounts[1]).setCommission(MAX_COMMISSION - 1))
        .to.be.revertedWithCustomError(childValidatorSet, "Unauthorized")
        .withArgs("VALIDATOR");
    });

    it("only less than max commision is valid", async () => {
      await expect(childValidatorSet.connect(accounts[2]).setCommission(MAX_COMMISSION + 1)).to.be.revertedWith(
        "INVALID_COMMISSION"
      );
    });

    it("set commission", async () => {
      await childValidatorSet.connect(accounts[2]).setCommission(MAX_COMMISSION - 1);

      const validator = await childValidatorSet.getValidator(accounts[2].address);
      expect(validator.commission).to.equal(MAX_COMMISSION - 1);
    });
  });

  it("Get total stake", async () => {
    const totalStake = await childValidatorSet.totalStake();
    expect(totalStake).to.equal(minStake * 2);
  });

  describe("Vesting", async () => {
    let VestManagerFactory: VestManager__factory;
    let vestManager: VestManager;

    before(async () => {
      VestManagerFactory = await ethers.getContractFactory("VestManager");
      await childValidatorSet.connect(accounts[4]).newManager();

      const tx = await childValidatorSet.connect(accounts[4]).newManager();
      const receipt = await tx.wait();
      const event = receipt.events?.find((e) => e.event === "NewClone");
      const address = event?.args?.newClone;
      vestManager = VestManagerFactory.attach(address);
    });

    it("Should already create a base implementation", async () => {
      const baseImplementation = await childValidatorSet.implementation();

      expect(baseImplementation).to.not.equal(ethers.constants.AddressZero);
    });

    describe("newManager()", async () => {
      it("reverts when zero address", async () => {
        const zeroAddress = ethers.constants.AddressZero;
        await impersonateAccount(zeroAddress);
        const zeroAddrSigner = await ethers.getSigner(zeroAddress);

        await expect(childValidatorSet.connect(zeroAddrSigner).newManager()).to.be.revertedWith("INVALID_OWNER");
      });

      it("create manager", async () => {
        const tx = await childValidatorSet.connect(accounts[5]).newManager();
        const receipt = await tx.wait();
        const event = receipt.events?.find((e) => e.event === "NewClone");
        const address = event?.args?.newClone;

        expect(address).to.not.equal(ethers.constants.AddressZero);
      });

      describe("Vesting Manager Factory", async () => {
        it("initialize manager", async () => {
          expect(await vestManager.owner()).to.equal(accounts[4].address);
          expect(await vestManager.staking()).to.equal(childValidatorSet.address);
        });
      });

      it("set manager in mapping", async () => {
        expect(await childValidatorSet.vestManagers(vestManager.address)).to.equal(accounts[4].address);
      });
    });

    describe("openPosition()", async () => {
      it("reverts when not manager", async () => {
        await expect(
          childValidatorSet.connect(accounts[3]).openPosition(accounts[3].address, 1)
        ).to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement");
      });

      it("reverts when delegation too low", async () => {
        await expect(vestManager.connect(accounts[4]).openPosition(accounts[2].address, minStake - 1))
          .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
          .withArgs("vesting", "DELEGATION_TOO_LOW");
      });

      it("should properly open vesting position", async () => {
        const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
        const validator = accounts[2].address;
        const vestingDuration = 52; // in weeks

        await expect(
          await manager.openPosition(validator, vestingDuration, {
            value: minDelegation,
          })
        ).to.not.be.reverted;

        // Commit an epoch so rewards to be distributed
        await commitEpoch(systemChildValidatorSet, accounts);
      });

      it("Should revert when active position", async () => {
        const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
        const validator = accounts[2].address;
        const vestingDuration = 52; // in weeks

        await expect(
          manager.openPosition(validator, vestingDuration, {
            value: minDelegation,
          })
        )
          .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
          .withArgs("vesting", "POSITION_ACTIVE");
      });

      it("Should revert when maturing position", async () => {
        // enter the reward maturity phase
        await time.increase(week * 55);

        const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
        const validator = accounts[2].address;
        const vestingDuration = 52; // in weeks

        await expect(
          manager.openPosition(validator, vestingDuration, {
            value: minDelegation,
          })
        )
          .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
          .withArgs("vesting", "POSITION_MATURING");
      });

      it("Should claim reward when recreating position", async () => {
        // enter the matured phase
        await time.increase(week * 55);

        const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
        const validator = accounts[2].address;
        const vestingDuration = 52; // in weeks
        const currentReward = await childValidatorSet.getDelegatorReward(accounts[2].address, manager.address);
        expect(currentReward).to.gt(0);

        await expect(
          manager.openPosition(validator, vestingDuration, {
            value: minDelegation,
          })
        ).to.not.be.reverted;

        const rewardAfterOpening = await childValidatorSet.getDelegatorReward(accounts[2].address, manager.address);

        expect(rewardAfterOpening).to.equal(0);
      });
    });

    describe("cutPosition", async () => {
      it("revert when insufficient balance", async () => {
        const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
        const validator = accounts[2].address;
        const balance = await childValidatorSet.delegationOf(validator, manager.address);

        await expect(manager.cutPosition(validator, balance.add(1)))
          .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
          .withArgs("vesting", "INSUFFICIENT_BALANCE");
      });

      it("revert when delegation too low", async () => {
        const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
        const validator = accounts[2].address;
        const balance = await childValidatorSet.delegationOf(validator, manager.address);

        await expect(manager.cutPosition(validator, balance.sub(1)))
          .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
          .withArgs("vesting", "DELEGATION_TOO_LOW");
      });

      it("slashes the amount when active position", async () => {
        const user = accounts[4];
        const validator = accounts[2].address;
        const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);

        // clear pending withdrawals
        await commitEpoch(systemChildValidatorSet, accounts);
        await manager.withdraw(user.address);

        // ensure position is active
        const isActive = await childValidatorSet.isActivePosition(validator, manager.address);
        expect(isActive).to.be.true;

        // set next block timestamp so half of the vesting period passed
        const position = await childValidatorSet.vestings(validator, manager.address);
        const nextBlockTimestamp = position.duration.div(2).add(position.start);
        await time.setNextBlockTimestamp(nextBlockTimestamp);

        // check is amount properly removed from delegation
        const delegatedBalanceBefore = await childValidatorSet.delegationOf(validator, manager.address);
        const cutAmount = delegatedBalanceBefore.div(2);
        const amountToBeBurned = cutAmount.div(2);

        // check if amount is properly burned
        let reward = await childValidatorSet.getDelegatorReward(validator, manager.address);
        reward = await childValidatorSet.applyMaxReward(reward);
        const decrease = reward.add(amountToBeBurned);
        await expect(manager.cutPosition(validator, cutAmount)).to.changeEtherBalance(
          childValidatorSet,
          decrease.mul(-1)
        );

        const delegatedBalanceAfter = await childValidatorSet.delegationOf(validator, manager.address);
        expect(delegatedBalanceAfter).to.be.eq(delegatedBalanceBefore.sub(cutAmount));

        // claimableRewards must be 0
        const claimableRewards = await childValidatorSet.getDelegatorReward(validator, manager.address);
        expect(claimableRewards).to.be.eq(0);

        // check if amount is properly slashed
        const balanceBefore = await user.getBalance();
        // commit Epoch so reward is available for withdrawal
        await commitEpoch(systemChildValidatorSet, accounts);
        await manager.withdraw(user.address);
        const balanceAfter = await user.getBalance();
        // cut half of the requested amount because half of the vesting period is still not passed
        expect(balanceAfter.sub(balanceBefore)).to.be.eq(amountToBeBurned);
      });

      it("should properly cut position", async () => {
        const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
        const validator = accounts[2].address;

        // commit Epoch so reward is made
        await commitEpoch(systemChildValidatorSet, accounts);

        const reward = await childValidatorSet.getPositionReward(validator, manager.address);
        log("reward", reward.toString());

        // Finish the vesting period
        await time.increase(week * 27);

        // ensure position is inactive
        const isActive = await childValidatorSet.isActivePosition(validator, manager.address);
        expect(isActive).to.be.false;

        const balanceBefore = await accounts[4].getBalance();
        const delegatedAmount = await childValidatorSet.delegationOf(validator, manager.address);
        manager.cutPosition(accounts[2].address, delegatedAmount);

        // Commit one more epoch so withdraw to be available
        await commitEpoch(systemChildValidatorSet, accounts);
        await manager.withdraw(accounts[4].address);

        const balanceAfter = await accounts[4].getBalance();

        expect(balanceAfter).to.be.eq(balanceBefore.add(delegatedAmount));

        // check is amount properly removed from delegation
        expect(await childValidatorSet.delegationOf(validator, manager.address)).to.be.eq(0);

        // ensure reward is still available for withdrawal
        const rewardAfter = await childValidatorSet.getPositionReward(validator, manager.address);
        log("rewardAfter", rewardAfter.toString());
        expect(rewardAfter).to.be.eq(reward);
      });

      it("should delete position when closing it", async () => {
        const user2 = accounts[5];
        const validator = accounts[2].address;
        await childValidatorSet.connect(user2).newManager();
        const manager2 = await getUserManager(childValidatorSet, user2, VestManagerFactory);

        await manager2.openPosition(validator, 1, {
          value: minDelegation,
        });

        // cut position
        const delegatedAmount = await childValidatorSet.delegationOf(validator, manager2.address);
        manager2.cutPosition(validator, delegatedAmount);
        expect((await childValidatorSet.vestings(validator, manager2.address)).start).to.be.eq(0);
      });
    });

    describe("topUpPosition()", async () => {
      it("reverts when not manager", async () => {
        await expect(
          childValidatorSet.connect(accounts[3]).topUpPosition(accounts[3].address, { value: minDelegation })
        )
          .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
          .withArgs("vesting", "NOT_MANAGER");
      });

      it("reverts when delegation too low", async () => {
        const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
        const validator = accounts[2].address;

        await expect(manager.topUpPosition(validator, { value: minDelegation - 1 }))
          .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
          .withArgs("vesting", "DELEGATION_TOO_LOW");
      });

      it("reverts when position is not active", async () => {
        // enter the reward maturity phase
        const week = 60 * 60 * 24 * 7;
        await time.increase(week * 55);

        const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
        const validator = accounts[2].address;

        await expect(manager.topUpPosition(validator, { value: minDelegation }))
          .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
          .withArgs("vesting", "POSITION_NOT_ACTIVE");
      });

      it("properly top-up position", async () => {
        const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
        const validator = accounts[2].address;

        // create position with the same validator and manager, because the old one is finished
        const duration = 1; // 1 week
        await manager.openPosition(validator, duration, { value: minDelegation });
        const vestingEndBefore = (await childValidatorSet.vestings(validator, manager.address)).end;

        // enter the active state
        await time.increase(1);

        expect(await childValidatorSet.isActivePosition(validator, manager.address)).to.be.true;

        const delegatedAmount = await childValidatorSet.delegationOf(validator, manager.address);
        const topUpAmount = minDelegation / 2;
        const totalAmount = delegatedAmount.add(topUpAmount);

        await manager.topUpPosition(validator, { value: topUpAmount });

        // delegation is increased
        expect(await childValidatorSet.delegationOf(validator, manager.address)).to.be.eq(totalAmount);

        // topUp data is added
        const topUp = await childValidatorSet.topUpPerVal(validator, manager.address, 0);
        expect(topUp.balance).to.be.eq(totalAmount);
        expect(topUp.epochNum).to.be.eq(await childValidatorSet.currentEpochId());

        // duration increase is proper
        const vestingEndAfter = (await childValidatorSet.vestings(validator, manager.address)).end;
        expect(vestingEndAfter).to.be.eq(vestingEndBefore.add((duration * week) / 2));
      });

      it("reverts when top-up already made in the same epoch", async () => {
        const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
        const validator = accounts[2].address;

        await expect(manager.topUpPosition(validator, { value: 1 }))
          .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
          .withArgs("vesting", "TOPUP_ALREADY_MADE");
      });

      it("increase duration no more than 100%", async () => {
        // otherwise new top up can't be made
        await commitEpoch(systemChildValidatorSet, accounts);

        const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
        const validator = accounts[2].address;

        const vestingEndBefore = (await childValidatorSet.vestings(validator, manager.address)).end;
        const duration = (await childValidatorSet.vestings(validator, manager.address)).duration;

        const topUpAmount = (await childValidatorSet.delegationOf(validator, manager.address)).mul(2);
        await manager.topUpPosition(validator, { value: topUpAmount });

        const vestingEndAfter = (await childValidatorSet.vestings(validator, manager.address)).end;
        expect(vestingEndAfter).to.be.eq(vestingEndBefore.add(duration));
      });

      it("reverts when top-up closed position", async () => {
        const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
        const validator = accounts[2].address;

        // close position
        const delegatedAmount = await childValidatorSet.delegationOf(validator, manager.address);
        await manager.cutPosition(validator, delegatedAmount);
        // top-up
        await expect(manager.topUpPosition(validator, { value: minDelegation }))
          .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
          .withArgs("vesting", "POSITION_NOT_ACTIVE");
      });
    });

    describe("claimPositionReward()", async () => {
      it("reverts when not manager", async () => {
        const validator = accounts[2].address;

        await expect(childValidatorSet.connect(accounts[3]).claimPositionReward(validator, 0, 0))
          .to.be.revertedWithCustomError(childValidatorSet, "StakeRequirement")
          .withArgs("vesting", "NOT_MANAGER");
      });

      it("returns when unused position", async () => {
        const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
        expect(await childValidatorSet.withdrawable(manager.address)).to.be.eq(0);
      });

      it("returns when active position", async () => {
        // create position with the same validator and manager, because the old one is finished
        const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
        const validator = accounts[2].address;
        const duration = 1; // 1 week
        await manager.openPosition(validator, duration, { value: minDelegation });
        // enter the active state
        await time.increase(1);
        // ensure is active position
        expect(await childValidatorSet.isActivePosition(validator, manager.address)).to.be.true;

        // reward to be accumulated
        await commitEpoch(systemChildValidatorSet, accounts);
        // withdraw previous amounts
        await manager.withdraw(accounts[4].address);

        expect(await childValidatorSet.getPositionReward(validator, manager.address)).to.be.gt(0);
        // claim
        await manager.claimPositionReward(validator, 0, 0);
        expect(await childValidatorSet.withdrawable(manager.address)).to.be.eq(0);
      });

      it("should properly claim Reward", async () => {
        // const manager = await getUserManager(childValidatorSet, accounts[4], VestManagerFactory);
        // const validator = accounts[2].address;
        // // commit epoch
        // const epochNum = await commitEpoch(systemChildValidatorSet, accounts);
        // const week = 60 * 60 * 24 * 7;
        // // Pretend the vesting period has passed
        // await time.increase(week * 53);
        // const balanceBefore = await accounts[4].getBalance();
        // // When there are no top ups, just set 0, because it is not actually checked
        // const topUpIndex = 0;
        // await vestPosition.connect(accounts[4]).claimReward(validator, epochNum, topUpIndex);
        // // Commit one more epoch so withdraw to be available
        // await commitEpoch(systemChildValidatorSet, accounts);
        // await vestPosition.connect(accounts[4]).withdraw(accounts[4].address);
        // const balanceAfter = await accounts[4].getBalance();
        // expect(balanceAfter.sub(balanceBefore)).to.be.gt(0);
      });
    });
  });
});

// eslint-disable-next-line no-unused-vars
async function commitEpoch(systemChildValidatorSet: ChildValidatorSet, accounts: any[]): Promise<BigNumberish> {
  const currentEpochId = await systemChildValidatorSet.currentEpochId();

  const previousEpoch = await systemChildValidatorSet.epochs(currentEpochId.sub(1));
  const startBlock = previousEpoch.endBlock.add(1);
  const validatorSet = await systemChildValidatorSet.getCurrentValidatorSet();

  const newEpoch = {
    startBlock,
    endBlock: startBlock.add(63),
    epochRoot: ethers.utils.randomBytes(32),
    validatorSet: validatorSet,
  };

  const newUptime = {
    epochId: currentEpochId,
    uptimeData: [
      { validator: accounts[0].address, signedBlocks: 64 },
      { validator: accounts[2].address, signedBlocks: 64 },
    ],
    totalBlocks: 64,
  };

  await systemChildValidatorSet.commitEpoch(currentEpochId, newEpoch, newUptime);

  return currentEpochId;
}

async function getUserManager(
  childValidatorSet: ChildValidatorSet,
  account: any,
  VestManagerFactory: any
): Promise<VestManager> {
  // Find user vesting position based on the emited  events
  const filter = childValidatorSet.filters.NewClone(account.address);
  const positionAddr = (await childValidatorSet.queryFilter(filter))[0].args.newClone;

  const manager = VestManagerFactory.attach(positionAddr);

  return manager.connect(account);
}
