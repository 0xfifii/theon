// Local test chain: deploys a real Uniswap V2 DEX + Elytheon on your computer, then makes a few launches and trades.
//   Terminal 1:  npx hardhat node
//   Terminal 2:  npx hardhat run scripts/local-demo.js --network localhost
// Then put the printed values in web/.env.local and run the website in live mode against your local chain.
const hre = require("hardhat");
const fs = require("fs");
const UNI_FACTORY = require("@uniswap/v2-core/build/UniswapV2Factory.json");
const UNI_ROUTER = require("@uniswap/v2-periphery/build/UniswapV2Router02.json");
const WETH9 = require("@uniswap/v2-periphery/build/WETH9.json");

async function main() {
  const { ethers } = hre;
  const [owner, a, b] = await ethers.getSigners();
  const weth = await new ethers.ContractFactory(WETH9.abi, WETH9.bytecode, owner).deploy();
  const fac = await new ethers.ContractFactory(UNI_FACTORY.abi, UNI_FACTORY.bytecode, owner).deploy(owner.address);
  const router = await new ethers.ContractFactory(UNI_ROUTER.abi, UNI_ROUTER.bytecode, owner).deploy(await fac.getAddress(), await weth.getAddress());
  const lp = await (await ethers.getContractFactory("ElytheonLaunchpad")).deploy(owner.address, await router.getAddress());
  const rc = await lp.deploymentTransaction().wait();
  const meta = (n, s, d) => ({ name: n, symbol: s, imageURI: "", description: d, website: "elytheon.xyz", twitter: "x.com/elytheon", telegram: "" });
  await (await lp.connect(a).createToken(meta("Zeus Coin", "ZEUS", "King of the Pantheon"), 0, { value: ethers.parseEther("0.2") })).wait();
  await (await lp.connect(b).createToken(meta("Athena", "ATHN", "Wisdom, on-chain"), 0)).wait();
  await hre.network.provider.send("evm_increaseTime", [70]);
  await hre.network.provider.send("evm_mine");
  const [zeus, athena] = await lp.getTokens(0, 10).then((l) => [l[1].token, l[0].token]);
  await (await lp.connect(b).buy(zeus, 0, { value: ethers.parseEther("12") })).wait();
  await (await lp.connect(a).buy(athena, 0, { value: ethers.parseEther("3") })).wait();
  const out = { address: await lp.getAddress(), deployBlock: rc.blockNumber, zeus, athena, router: await router.getAddress() };
  fs.mkdirSync("deployments", { recursive: true });
  fs.writeFileSync("deployments/localhost.json", JSON.stringify(out, null, 2));
  console.log("\nPaste into web/.env.local:");
  console.log(`NEXT_PUBLIC_LAUNCHPAD_ADDRESS=${out.address}`);
  console.log(`NEXT_PUBLIC_DEPLOY_BLOCK=${out.deployBlock}`);
  console.log("NEXT_PUBLIC_CHAIN_ID=31337");
  console.log("NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545");
}
main().catch((e) => { console.error(e); process.exit(1); });
