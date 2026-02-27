import { ethers } from "hardhat";

async function main() {
  const factory = await ethers.getContractFactory("ConfChainCore");
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  console.log("ConfChainCore deployed:", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
