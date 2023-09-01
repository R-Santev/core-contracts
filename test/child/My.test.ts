/* eslint-disable node/no-extraneous-import */
import { expect } from "chai";
import { ethers, network } from "hardhat";

describe("My test", () => {
  it("should pass", async () => {
    const accounts = await ethers.getSigners();
    const random = accounts[6];

    const networkParamsFactory = await ethers.getContractFactory("NetworkParams");
    const networkParams = await networkParamsFactory.deploy();
    await networkParams.deployed();
    const initParams = {
      newOwner: random.address,
      newCheckpointBlockInterval: 5, // in blocks
      newEpochSize: 10, // in blocks
      newEpochReward: 1000000000000000, // in wei
      newSprintSize: 100, // in blocks
      newMinValidatorSetSize: 1,
      newMaxValidatorSetSize: 10,
      newWithdrawalWaitPeriod: 2, // in blocks
      newBlockTime: 2, // in seconds
      newBlockTimeDrift: 10, // in seconds
      newVotingDelay: 1000, // in blocks
      newVotingPeriod: 50000, // in blocks
      newProposalThreshold: 2, // in percent
    };
    await networkParams.initialize(initParams);

    const validaatorSetFactory = await ethers.getContractFactory("ValidatorSet");
    const validatorSet = await validaatorSetFactory.deploy();
    await validatorSet.deployed();
    await validatorSet.initialize(random.address, random.address, random.address, networkParams.address, []);

    const RewardPoolFactory = await ethers.getContractFactory("RewardPool");
    const rewardPool = await RewardPoolFactory.deploy();
    await rewardPool.deployed();
    await rewardPool.initialize(random.address, random.address, validatorSet.address, networkParams.address);

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE"],
    });

    const systemSigner = await ethers.getSigner("0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE");
    const systemValidator = validatorSet.connect(systemSigner);
    const systemRewardPool = rewardPool.connect(systemSigner);

    await network.provider.send("evm_setAutomine", [false]);

    const epoch = {
      startBlock: 1,
      endBlock: 10,
      epochRoot: ethers.utils.randomBytes(32),
    };
    await systemValidator.commitEpoch(1, epoch, 10);

    const uptime = [
      {
        validator: random.address,
        signedBlocks: 10,
      },
    ];

    await network.provider.send("evm_setAutomine", [true]);

    // Proof that when commitEpoch and distributeRewardFor are mined in the same block, the latter fails
    await expect(systemRewardPool.distributeRewardFor(1, uptime, 10)).to.be.revertedWith(
      "ValidatorSet: epoch is not finished yet"
    );
  });
});
