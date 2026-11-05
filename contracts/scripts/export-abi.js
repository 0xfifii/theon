// Copies compiled ABIs (and deploy bytecode) into the website.
//   web/src/lib/abi.ts            ABIs used everywhere
//   web/src/lib/deployBytecode.ts bytecode used only by the in-browser /deploy page
const fs = require("fs");
const path = require("path");
const lpArt = require("../artifacts/contracts/ElytheonLaunchpad.sol/ElytheonLaunchpad.json");
const tk = require("../artifacts/contracts/ElytheonToken.sol/ElytheonToken.json").abi;
const ROUTER = require("@uniswap/v2-periphery/build/UniswapV2Router02.json");
const FACTORY = require("@uniswap/v2-core/build/UniswapV2Factory.json");
const PAIR = require("@uniswap/v2-core/build/UniswapV2Pair.json");
const WETH9 = require("@uniswap/v2-periphery/build/WETH9.json");

const lib = path.join(__dirname, "..", "..", "web", "src", "lib");
const j = (x) => JSON.stringify(x);
fs.writeFileSync(
  path.join(lib, "abi.ts"),
  "// Auto-generated — run `npm run export-abi` in /contracts after changing the contracts.\n" +
    `export const launchpadAbi = ${j(lpArt.abi)} as const;\n\n` +
    `export const tokenAbi = ${j(tk)} as const;\n\n` +
    `export const routerAbi = ${j(ROUTER.abi)} as const;\n\n` +
    `export const factoryAbi = ${j(FACTORY.abi)} as const;\n\n` +
    `export const pairAbi = ${j(PAIR.abi)} as const;\n`
);
const hex = (b) => (b.startsWith("0x") ? b : "0x" + b);
fs.writeFileSync(
  path.join(lib, "deployBytecode.ts"),
  "// Auto-generated — creation bytecode for the in-browser deploy page.\n" +
    `export const launchpadBytecode = "${hex(lpArt.bytecode)}" as \`0x\${string}\`;\n` +
    `export const whypeAbi = ${j(WETH9.abi)} as const;\n` +
    `export const whypeBytecode = "${hex(WETH9.bytecode)}" as \`0x\${string}\`;\n` +
    `export const factoryBytecode = "${hex(FACTORY.bytecode)}" as \`0x\${string}\`;\n` +
    `export const routerBytecode = "${hex(ROUTER.bytecode)}" as \`0x\${string}\`;\n`
);
console.log("ABIs + bytecode written to", lib);
