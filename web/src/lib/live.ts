"use client";
// LIVE MODE — reads and writes the deployed ElytheonLaunchpad contract on Elysium.
import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, usePublicClient, useWalletClient, useSwitchChain } from "wagmi";
import { decodeEventLog, parseAbiItem, type AbiEvent, type PublicClient } from "viem";
import { launchpadAbi, pairAbi, routerAbi, tokenAbi } from "./abi";
import { CHAIN_ID, elysium } from "./config";
import { DEFAULT_PARAMS, WAD, type Params } from "./curve";
import type { Address, CommentView, LaunchpadAPI, NewTokenInput, PoolView, TokenView, TradeView } from "./types";

const TRADE_EVENT = parseAbiItem(
  "event Trade(address indexed token, address indexed trader, bool isBuy, uint256 hypeAmount, uint256 tokenAmount, uint256 fees, uint256 sniperTax, uint256 priceAfter, uint256 realHype, uint256 tokensSold, uint256 timestamp)"
);
const COMMENT_EVENT = parseAbiItem("event Comment(address indexed token, address indexed author, string text, uint256 timestamp)");
const TRANSFER_EVENT = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
const FEED_LOOKBACK = 300_000n; // recent blocks for the home feed (~11h at 130ms blocks)
const DEAD = "0x000000000000000000000000000000000000dead";
const ZERO = "0x0000000000000000000000000000000000000000";
const MAX_UINT = 2n ** 256n - 1n;

type RawInfo = {
  token: Address; creator: Address; name: string; symbol: string; imageURI: string; launchTime: bigint; launchBlock: bigint;
  realHype: bigint; tokensSold: bigint; price: bigint; virtualHype0: bigint; virtualToken0: bigint;
  complete: boolean; migrated: boolean; pool: Address;
};

/** getLogs that copes with RPC range limits: try the whole range, then split it up. */
async function getLogsSmart(
  client: PublicClient,
  args: { address: Address; event: AbiEvent; args?: Record<string, unknown> },
  from: bigint,
  to: bigint
) {
  const once = (a: bigint, b: bigint) => client.getLogs({ ...args, fromBlock: a, toBlock: b } as never) as Promise<unknown[]>;
  try {
    return await once(from, to);
  } catch {
    for (const size of [100_000n, 20_000n, 5_000n]) {
      try {
        const out: unknown[] = [];
        const ranges: [bigint, bigint][] = [];
        for (let s = from; s <= to; s += size) ranges.push([s, s + size - 1n > to ? to : s + size - 1n]);
        for (let i = 0; i < ranges.length; i += 6) {
          const part = await Promise.all(ranges.slice(i, i + 6).map(([a, b]) => once(a, b)));
          part.forEach((p) => out.push(...p));
        }
        return out;
      } catch {}
    }
    throw new Error("Could not load chain history from the RPC");
  }
}

type L = { args: Record<string, unknown>; transactionHash: string | null; logIndex: number | null };

const toTrade = (l: L): TradeView => {
  const a = l.args as { token: Address; trader: Address; isBuy: boolean; hypeAmount: bigint; tokenAmount: bigint; sniperTax: bigint; priceAfter: bigint; timestamp: bigint };
  return {
    id: `${l.transactionHash}-${l.logIndex}`,
    token: a.token, trader: a.trader, isBuy: a.isBuy, hype: a.hypeAmount, amount: a.tokenAmount,
    price: a.priceAfter, tax: a.sniperTax, time: Number(a.timestamp), tx: l.transactionHash ?? undefined,
  };
};

export function useLive(LP: Address, deployBlock: bigint): LaunchpadAPI {
  const client = usePublicClient({ chainId: CHAIN_ID }) as PublicClient | undefined;
  const { data: wallet } = useWalletClient();
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const [tokens, setTokens] = useState<TokenView[]>([]);
  const [trades, setTrades] = useState<TradeView[]>([]);
  const [comments, setComments] = useState<Record<string, CommentView[]>>({});
  const [holders, setHolders] = useState<Record<string, [Address, bigint][]>>({});
  const [pools, setPools] = useState<Record<string, PoolView>>({});
  const [hypeBalance, setHype] = useState(0n);
  const [balances, setBalances] = useState<Record<string, bigint>>({});
  const [creatorFees, setCreatorFees] = useState(0n);
  const [now, setNow] = useState(Date.now() / 1000);
  const meta = useRef<Record<string, Partial<TokenView>>>({});
  const lastBlock = useRef<bigint | null>(null);
  const tradesRef = useRef<Map<string, TradeView>>(new Map());
  const dex = useRef<{ router: Address; weth: Address } | null>(null);
  const tokensRef = useRef<TokenView[]>([]);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(i);
  }, []);

  const pushTrades = useCallback((list: TradeView[]) => {
    if (!list.length) return;
    for (const t of list) tradesRef.current.set(t.id, t);
    const all = [...tradesRef.current.values()].sort((a, b) => b.time - a.time);
    if (all.length > 5000) all.length = 5000;
    setTrades(all);
  }, []);

  const read = useCallback(
    <T,>(functionName: string, args: unknown[] = [], addr: Address = LP, abi: unknown = launchpadAbi) =>
      client!.readContract({ address: addr, abi: abi as never, functionName: functionName as never, args: args as never }) as Promise<T>,
    [client, LP]
  );

  const loadParams = useCallback(async () => {
    const names = ["platformFeeBps", "creatorFeeBps", "sniperTaxStartBps", "protectWindow", "maxWalletProtected", "graduationFeeBps", "creationFee", "virtualHypeInit", "virtualTokenInit"];
    const v = await Promise.all(names.map((n) => read<bigint | number>(n)));
    const b = v.map((x) => BigInt(x));
    setParams({
      platformFeeBps: b[0], creatorFeeBps: b[1], sniperTaxStartBps: b[2], protectWindow: b[3], maxWalletProtected: b[4],
      graduationFeeBps: b[5], creationFee: b[6], virtualHypeInit: b[7], virtualTokenInit: b[8],
    });
  }, [read]);

  const loadDex = useCallback(async () => {
    const router = await read<Address>("router");
    if (router === ZERO) {
      dex.current = null;
      return null;
    }
    const weth = await read<Address>("WETH", [], router, routerAbi);
    dex.current = { router, weth };
    return dex.current;
  }, [read]);

  const loadTokens = useCallback(async () => {
    const list = await read<RawInfo[]>("getTokens", [0n, 300n]);
    const next = list.map((r) => ({
      address: r.token, creator: r.creator, name: r.name, symbol: r.symbol, image: r.imageURI,
      description: "", website: "", twitter: "", telegram: "",
      ...meta.current[r.token],
      launchTime: Number(r.launchTime), launchBlock: r.launchBlock,
      realHype: r.realHype, tokensSold: r.tokensSold, virtualHype0: r.virtualHype0, virtualToken0: r.virtualToken0,
      complete: r.complete, migrated: r.migrated, pool: r.pool === ZERO ? null : r.pool,
    }));
    tokensRef.current = next;
    setTokens(next);
  }, [read]);

  const loadFeed = useCallback(async () => {
    const latest = await client!.getBlockNumber();
    let from = lastBlock.current === null ? (latest > FEED_LOOKBACK ? latest - FEED_LOOKBACK : 0n) : lastBlock.current + 1n;
    if (from < deployBlock) from = deployBlock;
    if (from > latest) return;
    const logs = (await getLogsSmart(client!, { address: LP, event: TRADE_EVENT as AbiEvent }, from, latest)) as L[];
    lastBlock.current = latest;
    pushTrades(logs.map(toTrade));
  }, [client, LP, deployBlock, pushTrades]);

  const loadAccount = useCallback(async () => {
    if (!address) {
      setHype(0n); setBalances({}); setCreatorFees(0n);
      return;
    }
    const [bal, fees] = await Promise.all([client!.getBalance({ address }), read<bigint>("creatorFees", [address])]);
    setHype(bal);
    setCreatorFees(fees);
  }, [client, address, read]);

  const loadTokenBalance = useCallback(
    async (token: Address) => {
      if (!address) return;
      const b = await read<bigint>("balanceOf", [address], token, tokenAbi);
      setBalances((prev) => ({ ...prev, [token]: b }));
    },
    [address, read]
  );

  const loadPool = useCallback(
    async (t: TokenView) => {
      if (!t.migrated || !t.pool) return;
      const [r0, r1] = (await read<[bigint, bigint, number]>("getReserves", [], t.pool, pairAbi)) as unknown as bigint[];
      const t0 = await read<Address>("token0", [], t.pool, pairAbi);
      const [tokR, hypeR] = t0.toLowerCase() === t.address.toLowerCase() ? [r0, r1] : [r1, r0];
      setPools((p) => ({ ...p, [t.address]: { hypeReserve: hypeR, tokenReserve: tokR, price: tokR === 0n ? 0n : (hypeR * WAD) / tokR } }));
    },
    [read]
  );

  /** Everything for one token page: metadata, full trade history, comments, holders, pool. */
  const loadToken = useCallback(
    async (token: Address) => {
      if (!client) return;
      const t = tokensRef.current.find((x) => x.address.toLowerCase() === token.toLowerCase());
      const from = t?.launchBlock && t.launchBlock > 0n ? t.launchBlock : deployBlock;
      const latest = await client.getBlockNumber();
      const [m] = await Promise.all([
        read<{ description: string; website: string; twitter: string; telegram: string }>("getMetadata", [token]),
        loadTokenBalance(token),
      ]);
      meta.current[token] = { description: m.description, website: m.website, twitter: m.twitter, telegram: m.telegram };
      setTokens((prev) => prev.map((x) => (x.address === token ? { ...x, ...meta.current[token] } : x)));

      const [tradeLogs, commentLogs, transferLogs] = await Promise.all([
        getLogsSmart(client, { address: LP, event: TRADE_EVENT as AbiEvent, args: { token } }, from, latest),
        getLogsSmart(client, { address: LP, event: COMMENT_EVENT as AbiEvent, args: { token } }, from, latest),
        getLogsSmart(client, { address: token, event: TRANSFER_EVENT as AbiEvent }, from, latest),
      ]);
      pushTrades((tradeLogs as L[]).map(toTrade));
      setComments((c) => ({
        ...c,
        [token]: (commentLogs as L[])
          .map((l) => {
            const a = l.args as { author: Address; text: string; timestamp: bigint };
            return { id: `${l.transactionHash}-${l.logIndex}`, token, author: a.author, text: a.text, time: Number(a.timestamp), tx: l.transactionHash ?? undefined };
          })
          .sort((a, b) => b.time - a.time),
      }));
      const bal = new Map<string, bigint>();
      for (const l of transferLogs as L[]) {
        const a = l.args as { from: string; to: string; value: bigint };
        bal.set(a.from.toLowerCase(), (bal.get(a.from.toLowerCase()) ?? 0n) - a.value);
        bal.set(a.to.toLowerCase(), (bal.get(a.to.toLowerCase()) ?? 0n) + a.value);
      }
      const skip = new Set([ZERO, DEAD, LP.toLowerCase(), (t?.pool || "").toLowerCase()]);
      setHolders((h) => ({
        ...h,
        [token]: [...bal.entries()].filter(([a, b]) => b > 0n && !skip.has(a)).sort((x, y) => (y[1] > x[1] ? 1 : -1)) as [Address, bigint][],
      }));
      if (t) await loadPool(t);
    },
    [client, LP, deployBlock, read, loadTokenBalance, pushTrades, loadPool]
  );

  const refresh = useCallback(
    (token?: Address) => {
      loadTokens().catch(console.error);
      loadFeed().catch(console.error);
      loadAccount().catch(console.error);
      if (token) loadToken(token).catch(console.error);
    },
    [loadTokens, loadFeed, loadAccount, loadToken]
  );

  useEffect(() => {
    if (!client) return;
    let alive = true;
    (async () => {
      try {
        await Promise.all([loadParams(), loadTokens(), loadDex()]);
        await loadFeed();
        setError(null);
      } catch (e) {
        console.error("Elytheon: failed to load from chain", e);
        setError("Can't reach the launchpad contract. Check the network, RPC and contract address.");
      }
      if (alive) setReady(true);
    })();
    const i = setInterval(() => {
      loadTokens().catch(() => {});
      loadFeed().catch(() => {});
    }, 3000);
    return () => {
      alive = false;
      clearInterval(i);
    };
  }, [client, loadParams, loadTokens, loadFeed, loadDex]);

  useEffect(() => {
    loadAccount().catch(() => {});
    const i = setInterval(() => loadAccount().catch(() => {}), 6000);
    return () => clearInterval(i);
  }, [loadAccount]);

  useEffect(() => {
    if (!address) return;
    tokens.slice(0, 80).forEach((t) => loadTokenBalance(t.address).catch(() => {}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, tokens.length]);

  // ─── writes ───
  const ensureWallet = useCallback(async () => {
    if (!wallet || !address) throw new Error("Connect your wallet first");
    if (chainId !== elysium.id) await switchChainAsync({ chainId: elysium.id });
    return wallet;
  }, [wallet, address, chainId, switchChainAsync]);

  const send = useCallback(
    async (req: Record<string, unknown>) => {
      const w = await ensureWallet();
      const hash = await w.writeContract({ chain: elysium, account: address!, ...req } as never);
      const rc = await client!.waitForTransactionReceipt({ hash });
      if (rc.status !== "success") throw new Error("Transaction failed");
      return rc;
    },
    [ensureWallet, client, address]
  );

  const approveIfNeeded = useCallback(
    async (token: Address, spender: Address, amount: bigint) => {
      const allowance = await read<bigint>("allowance", [address!, spender], token, tokenAbi);
      if (allowance < amount) await send({ address: token, abi: tokenAbi, functionName: "approve", args: [spender, MAX_UINT] });
    },
    [read, send, address]
  );

  const buy = useCallback(
    async (token: Address, hypeIn: bigint, minOut: bigint) => {
      const rc = await send({ address: LP, abi: launchpadAbi, functionName: "buy", args: [token, minOut], value: hypeIn });
      refresh(token);
      return rc.transactionHash;
    },
    [send, refresh, LP]
  );

  const sell = useCallback(
    async (token: Address, amount: bigint, minOut: bigint) => {
      await approveIfNeeded(token, LP, amount);
      const rc = await send({ address: LP, abi: launchpadAbi, functionName: "sell", args: [token, amount, minOut] });
      refresh(token);
      return rc.transactionHash;
    },
    [send, refresh, approveIfNeeded, LP]
  );

  const create = useCallback(
    async (input: NewTokenInput) => {
      const rc = await send({
        address: LP, abi: launchpadAbi, functionName: "createToken",
        args: [{ name: input.name, symbol: input.symbol, imageURI: input.image, description: input.description, website: input.website, twitter: input.twitter, telegram: input.telegram }, 0n],
        value: params.creationFee + input.devBuy,
      });
      let created: Address | null = null;
      for (const l of rc.logs) {
        try {
          const ev = decodeEventLog({ abi: launchpadAbi, data: l.data, topics: l.topics });
          if (ev.eventName === "TokenCreated") created = (ev.args as { token: Address }).token;
        } catch {}
      }
      await loadTokens();
      refresh();
      if (!created) throw new Error("Token created but its address was not found in the receipt");
      return created;
    },
    [send, refresh, loadTokens, params.creationFee, LP]
  );

  const claimFees = useCallback(async () => {
    const rc = await send({ address: LP, abi: launchpadAbi, functionName: "claimCreatorFees" });
    refresh();
    return rc.transactionHash;
  }, [send, refresh, LP]);

  const postComment = useCallback(
    async (token: Address, text: string) => {
      const rc = await send({ address: LP, abi: launchpadAbi, functionName: "comment", args: [token, text] });
      loadToken(token).catch(() => {});
      return rc.transactionHash;
    },
    [send, loadToken, LP]
  );

  const dexQuote = useCallback(
    async (token: Address, isBuy: boolean, amountIn: bigint) => {
      if (amountIn === 0n) return 0n;
      const d = dex.current ?? (await loadDex());
      if (!d) throw new Error("No DEX router is set on the launchpad yet");
      const path = isBuy ? [d.weth, token] : [token, d.weth];
      const amounts = await read<bigint[]>("getAmountsOut", [amountIn, path], d.router, routerAbi);
      return amounts[amounts.length - 1];
    },
    [read, loadDex]
  );

  const dexSwap = useCallback(
    async (token: Address, isBuy: boolean, amountIn: bigint, minOut: bigint) => {
      const d = dex.current ?? (await loadDex());
      if (!d) throw new Error("No DEX router is set on the launchpad yet");
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
      let rc;
      if (isBuy) {
        rc = await send({ address: d.router, abi: routerAbi, functionName: "swapExactETHForTokens", args: [minOut, [d.weth, token], address!, deadline], value: amountIn });
      } else {
        await approveIfNeeded(token, d.router, amountIn);
        rc = await send({ address: d.router, abi: routerAbi, functionName: "swapExactTokensForETH", args: [amountIn, minOut, [token, d.weth], address!, deadline] });
      }
      refresh(token);
      return rc.transactionHash;
    },
    [send, loadDex, approveIfNeeded, refresh, address]
  );

  return {
    mode: "live", ready, error, params, tokens, trades, comments, holders, pools,
    account: (address as Address) ?? null, hypeBalance, balances, creatorFees, now,
    refresh, buy, sell, create, claimFees, loadToken, postComment, dexQuote, dexSwap,
  };
}
