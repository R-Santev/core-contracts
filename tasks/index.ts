import { task } from "hardhat/config";
// eslint-disable-next-line camelcase, node/no-unpublished-import
import { ChildValidatorSet__factory } from "../typechain-types";

// task("getReward", "Withdraw reward from the pool").setAction(async (_, hre) => {
//   // get signers from hardhat
//   const [signer] = await hre.ethers.getSigners();
//   const contract = ChildValidatorSet__factory.connect("0x0000000000000000000000000000000000000101", signer);
//   const tx = await contract.claimValidatorReward();
//   const res = await tx.wait();
//   console.log(res);
// });

task("reward", "Withdraw reward from the pool").setAction(async (_, hre) => {
  // get signers from hardhat
  const [signer] = await hre.ethers.getSigners();
  const contract = ChildValidatorSet__factory.connect("0x0000000000000000000000000000000000000101", signer);
  const res = await contract.getValidator(signer.address);

  console.log(hre.ethers.utils.formatEther(res.withdrawableRewards));
});

task("balance", "Withdraw reward from the pool").setAction(async (_, hre) => {
  // get signers from hardhat
  const [signer] = await hre.ethers.getSigners();
  const contract = ChildValidatorSet__factory.connect("0x0000000000000000000000000000000000000101", signer);

  const balance = await hre.ethers.provider.getBalance(contract.address);
  console.log(hre.ethers.utils.formatEther(balance));
});

task("epoch-reward", "Withdraw reward from the pool").setAction(async (_, hre) => {
  // get signers from hardhat
  const [signer] = await hre.ethers.getSigners();
  const contract = ChildValidatorSet__factory.connect("0x0000000000000000000000000000000000000101", signer);
  const res = await contract.epochReward();

  console.log(hre.ethers.utils.formatEther(res));
});

task("events", "Withdraw reward from the pool").setAction(async (_, hre) => {
  // get signers from hardhat
  const [signer] = await hre.ethers.getSigners();
  const contract = ChildValidatorSet__factory.connect("0x0000000000000000000000000000000000000101", signer);

  const events = await contract.queryFilter(contract.filters.ValidatorRewardDistributed(signer.address));

  console.log(events);
});

task("withdraw", "Withdraw reward from the pool").setAction(async (_, hre) => {
  // get signers from hardhat
  const [signer] = await hre.ethers.getSigners();
  const contract = ChildValidatorSet__factory.connect("0x0000000000000000000000000000000000000101", signer);
  const tx = await contract.withdraw(signer.address);
  const res = await tx.wait();
  console.log(res);
});
