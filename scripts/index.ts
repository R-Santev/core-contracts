import { tenderly } from "hardhat";

async function main() {
  // console.log("Manual Advanced: {Greeter} deployed to:", address);

  // tenderly.verify({
  //   name: "ChildValidatorSet",
  //   address: "0x0000000000000000000000000000000000000101",
  // });

  tenderly.persistArtifacts({
    name: "ChildValidatorSet",
    address: "0x0000000000000000000000000000000000000101",
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
