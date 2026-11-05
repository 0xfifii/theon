require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");
const path = require("path");
const { subtask } = require("hardhat/config");
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require("hardhat/builtin-tasks/task-names");

// Use the solc compiler bundled in node_modules (no internet download needed).
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args, hre, runSuper) => {
  if (args.solcVersion === "0.8.24") {
    const compilerPath = path.join(__dirname, "node_modules", "solc", "soljson.js");
    return { compilerPath, isSolcJs: true, version: args.solcVersion, longVersion: "0.8.24" };
  }
  return runSuper();
});

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const accounts = PRIVATE_KEY ? [PRIVATE_KEY] : [];

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true, evmVersion: "cancun" },
  },
  networks: {
    // Elysium testnet (Kinetiq) — gas token is HYPE
    elysiumTestnet: {
      url: process.env.ELYSIUM_TESTNET_RPC || "https://testnet-rpc.elysium.kinetiq.xyz",
      chainId: 99801,
      accounts,
    },
    // Elysium mainnet — fill in once Kinetiq publishes the chain ID + RPC (launch: Nov 9, 2026)
    elysium: {
      url: process.env.ELYSIUM_MAINNET_RPC || "",
      chainId: process.env.ELYSIUM_MAINNET_CHAIN_ID ? Number(process.env.ELYSIUM_MAINNET_CHAIN_ID) : undefined,
      accounts,
    },
  },
};
