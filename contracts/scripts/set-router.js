// Point graduation at a DEX router (e.g. Nest or Dawn, once they publish a V2-compatible router).
//   PRIVATE_KEY=0x... LAUNCHPAD=0x... ROUTER=0x... npx hardhat run scripts/set-router.js --network elysiumTestnet
const hre = require("hardhat");

async function main() {
  const lp = await hre.ethers.getContractAt("ElytheonLaunchpad", process.env.LAUNCHPAD);
  const tx = await lp.setRouter(process.env.ROUTER);
  await tx.wait();
  console.log(`Router set to ${process.env.ROUTER}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
