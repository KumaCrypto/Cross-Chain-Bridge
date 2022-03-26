import { ethers, run } from "hardhat";

async function main() {
  const chainId = 4;
  const [validator] = await ethers.getSigners();

  const Bridge = await ethers.getContractFactory("Bridge");
  const Token = await ethers.getContractFactory("TestToken");

  const bridge = await Bridge.deploy(
    validator.address,
    chainId
  );
  await bridge.deployed();

  const token = await Token.deploy(bridge.address);
  await token.deployed();

  setTimeout(async function () {
    await run(`verify:verify`, {
      address: bridge.address,
      contract: "contracts/Bridge.sol:Bridge",
      constructorArguments: [validator.address, chainId],
    });
  }, 5000);

  await run(`verify:verify`, {
    address: token.address,
    contract: "contracts/TestToken.sol:TestToken",
    constructorArguments: [bridge.address],
  });

  console.log(`
    Deployed in rinkeby
    =================
    "Bridge" contract address: ${bridge.address}
    "Token" contract address: ${token.address}
    ${validator.address} - validator
  `);
}


main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});