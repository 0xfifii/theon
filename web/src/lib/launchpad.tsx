"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { envConfig, readConfig, type LaunchpadConfig } from "./config";
import { DEFAULT_PARAMS } from "./curve";
import { DEMO_ACCOUNT, useDemo } from "./demo";
import { useLive } from "./live";
import type { Address, LaunchpadAPI, NewTokenInput, PoolView } from "./types";
import { WAD } from "./curve";

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

function DemoProvider({ children }: { children: ReactNode }) {
  const d = useDemo();
  const [now, setNow] = useState(Date.now() / 1000);
  useEffect(() => {
    useDemo.getState().start();
    const i = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(i);
  }, []);

  const wait = () => new Promise((r) => setTimeout(r, 650)); // feel like a fast chain
  const buy = useCallback(async (token: Address, hypeIn: bigint, minOut: bigint) => {
    await wait();
    useDemo.getState().buy(token, DEMO_ACCOUNT, hypeIn, minOut);
  }, []);
  const sell = useCallback(async (token: Address, amount: bigint, minOut: bigint) => {
    await wait();
    useDemo.getState().sell(token, DEMO_ACCOUNT, amount, minOut);
  }, []);
  const create = useCallback(async (input: NewTokenInput) => {
    await wait();
    return useDemo.getState().createToken(input, DEMO_ACCOUNT);
  }, []);
  const claimFees = useCallback(async () => {
    await wait();
    useDemo.getState().claim(DEMO_ACCOUNT);
  }, []);
  const postComment = useCallback(async (token: Address, text: string) => {
    await wait();
    useDemo.getState().postComment(token, DEMO_ACCOUNT, text);
  }, []);
  const dexQuote = useCallback(async (token: Address, isBuy: boolean, amountIn: bigint) => useDemo.getState().dexQuote(token, isBuy, amountIn), []);
  const dexSwap = useCallback(async (token: Address, isBuy: boolean, amountIn: bigint, minOut: bigint) => {
    await wait();
    useDemo.getState().dexSwap(token, DEMO_ACCOUNT, isBuy, amountIn, minOut);
  }, []);

  const holders = useMemo(() => {
    const out: Record<string, [Address, bigint][]> = {};
    for (const [tok, h] of Object.entries(d.wallet)) out[tok] = Object.entries(h).filter(([, b]) => b > 0n).sort((a, b) => (b[1] > a[1] ? 1 : -1)) as [Address, bigint][];
    return out;
  }, [d.wallet]);
  const pools = useMemo(() => {
    const out: Record<string, PoolView> = {};
    for (const [tok, p] of Object.entries(d.pools || {})) out[tok] = { hypeReserve: p.hype, tokenReserve: p.tok, price: p.tok === 0n ? 0n : (p.hype * WAD) / p.tok };
    return out;
  }, [d.pools]);

  const api: LaunchpadAPI = {
    mode: "demo",
    ready: d.tokens.length > 0,
    error: null,
    params: DEFAULT_PARAMS,
    tokens: d.tokens,
    trades: d.trades,
    comments: d.comments || {},
    holders,
    pools,
    account: DEMO_ACCOUNT,
    hypeBalance: d.hypeBalance,
    balances: d.balances,
    creatorFees: d.creatorFees[DEMO_ACCOUNT] ?? 0n,
    now,
    refresh: () => {},
    buy,
    sell,
    create,
    claimFees,
    loadToken: async () => {},
    postComment,
    dexQuote,
    dexSwap,
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
        <DemoProvider>{children}</DemoProvider>
      )}
    </CfgCtx.Provider>
  );
}
