/* eslint-disable no-process-exit */
const hre = require("hardhat");
const ethers = hre.ethers;

async function main() {
  const eventSignature = "Transfer(address,address,uint256)";
  const topic0 = ethers.utils.id(eventSignature);

  console.log(topic0);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
