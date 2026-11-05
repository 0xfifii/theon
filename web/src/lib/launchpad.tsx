"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { elysium, envConfig, readConfig, type LaunchpadConfig } from "./config";
import { DEFAULT_PARAMS } from "./curve";
import { useAccount, useBalance } from "wagmi";
import { useLive } from "./live";
import type { Address, LaunchpadAPI } from "./types";

const Ctx = createContext<LaunchpadAPI | null>(null);
const CfgCtx = createContext<{ config: LaunchpadConfig; reload: () => void }>({ config: envConfig(), reload: () => {} });

export function useLaunchpad() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLaunchpad must be inside <LaunchpadProvider>");
  return v;
}

export function useLaunchpadConfig() {
  return useContext(CfgCtx);
}

export function useToken(address?: string) {
  const { tokens } = useLaunchpad();
  return useMemo(() => tokens.find((t) => t.address.toLowerCase() === address?.toLowerCase()), [tokens, address]);
}

function LiveProvider({ address, deployBlock, children }: { address: Address; deployBlock: bigint; children: ReactNode }) {
  const api = useLive(address, deployBlock);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

const NOT_LIVE = "Elytheon isn't live yet — deploy the contracts on the Deploy page first.";
const notLive = async (): Promise<never> => {
  throw new Error(NOT_LIVE);
};

/** Before the contracts are deployed: no fake data, just an empty launchpad with a real wallet connection. */
function SetupProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount();
  const { data: bal } = useBalance({ address, chainId: elysium.id, query: { refetchInterval: 8000 } });
  const [now, setNow] = useState(Date.now() / 1000);
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(i);
  }, []);
  const api: LaunchpadAPI = {
    mode: "setup",
    ready: true,
    error: null,
    params: DEFAULT_PARAMS,
    tokens: [],
    trades: [],
    comments: {},
    holders: {},
    pools: {},
    account: (address as Address) ?? null,
    hypeBalance: bal?.value ?? 0n,
    balances: {},
    creatorFees: 0n,
    now,
    refresh: () => {},
    buy: notLive,
    sell: notLive,
    create: notLive,
    claimFees: notLive,
    loadToken: async () => {},
    postComment: notLive,
    dexQuote: async () => 0n,
    dexSwap: notLive,
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function LaunchpadProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<LaunchpadConfig>(envConfig());
  const reload = useCallback(() => setConfig(readConfig()), []);
  useEffect(() => reload(), [reload]);
  return (
    <CfgCtx.Provider value={{ config, reload }}>
      {config.address ? (
        <LiveProvider key={config.address} address={config.address} deployBlock={config.deployBlock}>
          {children}
        </LiveProvider>
      ) : (
        <SetupProvider>{children}</SetupProvider>
      )}
    </CfgCtx.Provider>
  );
}
