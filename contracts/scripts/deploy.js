// Deploys the Elytheon launchpad and writes the address + ABI where the website can find it.
//
//   PRIVATE_KEY=0x... npx hardhat run scripts/deploy.js --network elysiumTestnet
//
// Optional env:
//   TREASURY=0x...   where platform fees go (defaults to the deployer)
//   ROUTER=0x...     Uniswap-V2-compatible router on Elysium for graduation (can be set later)
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) throw new Error("No deployer. Set PRIVATE_KEY in your .env file.");
  const net = await hre.ethers.provider.getNetwork();
  const bal = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Network: ${hre.network.name} (chain ${net.chainId})`);
  console.log(`Deployer: ${deployer.address}  balance: ${hre.ethers.formatEther(bal)} HYPE`);

  const treasury = process.env.TREASURY || deployer.address;
  const router = process.env.ROUTER || hre.ethers.ZeroAddress;

  const Launchpad = await hre.ethers.getContractFactory("ElytheonLaunchpad");
  const lp = await Launchpad.deploy(treasury, router);
  const receipt = await lp.deploymentTransaction().wait();
  const address = await lp.getAddress();
  console.log(`\n✅ ElytheonLaunchpad deployed at ${address} (block ${receipt.blockNumber})`);
  if (router === hre.ethers.ZeroAddress) {
    console.log("ℹ️  No ROUTER set. Tokens can launch and trade now; set the DEX router later with setRouter().");
  }

  const out = { network: hre.network.name, chainId: Number(net.chainId), address, deployBlock: receipt.blockNumber, treasury, router };
  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${hre.network.name}.json`), JSON.stringify(out, null, 2));

  console.log("\nAdd these to the website's environment variables (web/.env.local and Vercel):");
  console.log(`NEXT_PUBLIC_LAUNCHPAD_ADDRESS=${address}`);
  console.log(`NEXT_PUBLIC_DEPLOY_BLOCK=${receipt.blockNumber}`);
  console.log(`NEXT_PUBLIC_CHAIN_ID=${Number(net.chainId)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
