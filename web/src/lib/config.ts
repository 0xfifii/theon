import { defineChain } from "viem";

// Kinetiq's Elysium (NOT viem's built-in `elysiumTestnet`, which is a different chain from Vulcan Forged).
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 99801);
export const IS_TESTNET = CHAIN_ID === 99801;
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://testnet-rpc.elysium.kinetiq.xyz";
export const RPC_FALLBACK = process.env.NEXT_PUBLIC_RPC_FALLBACK || (IS_TESTNET ? "https://elysium-testnet-rpc.hypedexer.com" : "");
export const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer-elysium-testnet.t.conduit.xyz";
export const FAUCET_URL = "https://elysium.kinetiq.xyz/testnet-faucet";
export const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://elytheon.xyz";
export const BRIDGE_URL = IS_TESTNET ? "https://elysium.kinetiq.xyz/testnet-bridge" : "https://elysium.kinetiq.xyz";

const ENV_ADDRESS = process.env.NEXT_PUBLIC_LAUNCHPAD_ADDRESS || "";
const ENV_BLOCK = process.env.NEXT_PUBLIC_DEPLOY_BLOCK || "0";
const isAddr = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a);

export type LaunchpadConfig = { address: `0x${string}` | null; deployBlock: bigint; source: "env" | "browser" | "none" };

/** Address set on Vercel (env) — or, for testing, one saved in this browser by the /deploy page. */
const OVERRIDE_KEY = `elytheon-launchpad-${CHAIN_ID}`;

export function envConfig(): LaunchpadConfig {
  return isAddr(ENV_ADDRESS)
    ? { address: ENV_ADDRESS as `0x${string}`, deployBlock: BigInt(ENV_BLOCK || 0), source: "env" }
    : { address: null, deployBlock: 0n, source: "none" };
}

export function readConfig(): LaunchpadConfig {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(OVERRIDE_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        if (isAddr(o.address)) return { address: o.address, deployBlock: BigInt(o.deployBlock || 0), source: "browser" };
      }
    } catch {}
  }
  return envConfig();
}

export function saveBrowserConfig(address: string, deployBlock: bigint) {
  localStorage.setItem(OVERRIDE_KEY, JSON.stringify({ address, deployBlock: deployBlock.toString() }));
}

export function clearBrowserConfig() {
  localStorage.removeItem(OVERRIDE_KEY);
}

export const elysium = defineChain({
  id: CHAIN_ID,
  name: IS_TESTNET ? "Elysium Testnet" : "Elysium",
  nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "Elysium Explorer", url: EXPLORER_URL } },
  testnet: IS_TESTNET,
});

export const explorerTx = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const explorerAddr = (addr: string) => `${EXPLORER_URL}/address/${addr}`;
