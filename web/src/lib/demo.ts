"use client";
// DEMO MODE — a simulated Elytheon market that runs in the browser with the exact same
// bonding-curve math as the smart contract. Used until NEXT_PUBLIC_LAUNCHPAD_ADDRESS is set.
import { create } from "zustand";
import { CURVE_SUPPLY, DEFAULT_PARAMS, WAD, price, quoteBuy, quoteSell, type CurveState } from "./curve";
import type { Address, CommentView, NewTokenInput, TokenView, TradeView } from "./types";

export const DEMO_ACCOUNT = "0xE1E7beefE1E7beefE1E7beefE1E7beefE1E7bEEF" as Address;
const P = DEFAULT_PARAMS;

let seed = 7;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
let addrSeed = 1337;
const addrRnd = () => {
  addrSeed = (addrSeed * 48271) % 2147483647;
  return (addrSeed - 1) / 2147483646;
};
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const randAddr = (r: () => number = Math.random): Address =>
  ("0x" + Array.from({ length: 40 }, () => "0123456789abcdef"[Math.floor(r() * 16)]).join("")) as Address;
const hypeWei = (n: number) => BigInt(Math.floor(n * 1e6)) * 10n ** 12n;

const PALETTES = [
  ["#1E45D6", "#8AA8FF"],
  ["#0F1F5C", "#2F5BEA"],
  ["#2F5BEA", "#DCE6FF"],
  ["#162E8C", "#5A7FF5"],
  ["#1A37B0", "#B9CCFF"],
  ["#0A1440", "#1E45D6"],
];

export function avatar(glyph: string, i: number) {
  const [a, b] = PALETTES[i % PALETTES.length];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='120' height='120' rx='28' fill='url(#g)'/><circle cx='60' cy='60' r='40' fill='white' fill-opacity='.12'/><text x='60' y='78' font-size='52' text-anchor='middle' font-family='serif' fill='white'>${glyph}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const SEEDS: [string, string, string, string][] = [
  ["Hyperion Owl", "HOWL", "🦉", "The night-watch of the Pantheon. Sees every block."],
  ["Zephyr", "ZEPH", "🌬️", "The west wind. Fast blocks, faster pumps."],
  ["Laurel Crown", "LAUREL", "🌿", "For those who ascend first."],
  ["Nyx Frog", "NYX", "🐸", "Born in the dark between blocks."],
  ["Trident", "TRI", "🔱", "Three prongs: launch, pump, ascend."],
  ["Golden Fleece", "FLEECE", "🐏", "Everyone is hunting it."],
  ["Pegasus Pump", "PEGA", "🐴", "Wings on the chart."],
  ["Oracle Cat", "ORCAT", "🐈", "Predicted this token. Then bought it."],
  ["Lyre Lad", "LYRE", "🎶", "Plays one song: up only."],
  ["Marble Mog", "MOG", "🗿", "Carved, not minted."],
  ["Ambrosia", "AMBRO", "🍯", "Food of the gods. Gas of the degens."],
  ["Chronos", "CHRONO", "⏳", "Time in the market > timing the market."],
  ["Olive Bull", "OLIVE", "🫒", "Bullish on olives."],
  ["Thunder Bolt", "BOLT", "⚡", "Strikes at 250ms block times."],
];

type State = {
  tokens: TokenView[];
  trades: TradeView[];
  hypeBalance: bigint;
  balances: Record<string, bigint>;
  creatorFees: Record<string, bigint>;
  wallet: Record<string, Record<string, bigint>>; // token → holder → bal
  protectedBought: Record<string, Record<string, bigint>>;
  comments: Record<string, CommentView[]>;
  pools: Record<string, { hype: bigint; tok: bigint }>;
  started: boolean;
  counter: number;
};

type Actions = {
  start: () => void;
  stop: () => void;
  reset: () => void;
  botTick: () => void;
  buy: (token: Address, trader: Address, hypeIn: bigint, minOut: bigint) => void;
  sell: (token: Address, trader: Address, amount: bigint, minOut: bigint) => void;
  createToken: (input: NewTokenInput, creator: Address, at?: number) => Address;
  claim: (who: Address) => bigint;
  postComment: (token: Address, author: Address, text: string) => void;
  dexQuote: (token: Address, isBuy: boolean, amountIn: bigint) => bigint;
  dexSwap: (token: Address, trader: Address, isBuy: boolean, amountIn: bigint, minOut: bigint) => void;
};

const BOT_LINES = [
  "LFG 🚀", "this one is going to the Pantheon", "dev is based", "sniper shield actually works lol", "bought the dip",
  "chart looks clean", "who else is holding?", "HYPE gas so cheap I keep aping", "almost ascended 👀", "wagmi",
  "art is fire", "paper hands sold already", "community strong here", "send it", "first time on Elysium, loving it",
];

/** Uniswap V2 output with 0.3% fee */
function v2Out(amountIn: bigint, rIn: bigint, rOut: bigint) {
  const inFee = amountIn * 997n;
  return (inFee * rOut) / (rIn * 1000n + inFee);
}

const nowS = () => Date.now() / 1000;
const STORE_KEY = "elytheon-demo-v2";
const MAX_AGE = 6 * 3600 * 1000;
const enc = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? { __b: x.toString() } : x));
const dec = (s: string) => JSON.parse(s, (_, x) => (x && typeof x === "object" && "__b" in x ? BigInt(x.__b) : x));
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function save(st: Partial<State>) {
  if (typeof window === "undefined" || saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const s = useDemo.getState();
      localStorage.setItem(STORE_KEY, enc({ at: Date.now(), tokens: s.tokens, trades: s.trades.slice(0, 600), hypeBalance: s.hypeBalance, wallet: s.wallet, creatorFees: s.creatorFees, protectedBought: s.protectedBought, comments: s.comments, pools: s.pools, counter: s.counter }));
    } catch {}
  }, 2000);
  void st;
}
function load(): Partial<State> | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const d = dec(raw);
    if (Date.now() - d.at > MAX_AGE) return null;
    return d;
  } catch {
    return null;
  }
}
let timer: ReturnType<typeof setTimeout> | null = null;

export const useDemo = create<State & Actions>((rawSet, get) => {
  const set = (v: Partial<State>) => {
    rawSet(v);
    save(v);
  };
  const applyBuy = (s: State, token: Address, trader: Address, hypeIn: bigint, minOut: bigint, at: number) => {
    const t = s.tokens.find((x) => x.address === token);
    if (!t) throw new Error("Unknown token");
    if (t.complete) throw new Error("This token already ascended — trade it on the DEX");
    const q = quoteBuy(t, P, hypeIn, at);
    if (q.out === 0n || q.out < minOut) throw new Error("Price moved — slippage exceeded");
    if (at < t.launchTime + Number(P.protectWindow)) {
      const prev = s.protectedBought[token]?.[trader] ?? 0n;
      if (prev + q.out > P.maxWalletProtected) throw new Error("Anti-sniper cap: max 2% per wallet in the first 60s");
      s.protectedBought[token] = { ...(s.protectedBought[token] || {}), [trader]: prev + q.out };
    }
    t.tokensSold += q.out;
    t.realHype += q.net + q.tax;
    s.creatorFees[t.creator] = (s.creatorFees[t.creator] ?? 0n) + q.feeC;
    const w = (s.wallet[token] = s.wallet[token] || {});
    w[trader] = (w[trader] ?? 0n) + q.out;
    s.trades.unshift({
      id: `${token}-${s.counter++}`,
      token,
      trader,
      isBuy: true,
      hype: q.used,
      amount: q.out,
      price: price(t),
      tax: q.tax,
      time: at,
    });
    if (t.tokensSold >= CURVE_SUPPLY) {
      t.complete = true;
      t.migrated = true;
      t.pool = randAddr();
      const lpHype = (t.realHype * 97n) / 100n;
      const xV = t.virtualHype0 + t.realHype;
      const yV = t.virtualToken0 - t.tokensSold;
      s.pools[t.address] = { hype: lpHype, tok: (lpHype * yV) / xV };
    }
    return q;
  };

  const applySell = (s: State, token: Address, trader: Address, amount: bigint, minOut: bigint, at: number) => {
    const t = s.tokens.find((x) => x.address === token);
    if (!t) throw new Error("Unknown token");
    if (t.complete) throw new Error("This token already ascended — trade it on the DEX");
    const bal = s.wallet[token]?.[trader] ?? 0n;
    if (amount > bal) throw new Error("Not enough tokens");
    const q = quoteSell(t, P, amount);
    if (q.out === 0n || q.out < minOut) throw new Error("Price moved — slippage exceeded");
    t.tokensSold -= amount;
    t.realHype -= q.gross;
    s.creatorFees[t.creator] = (s.creatorFees[t.creator] ?? 0n) + q.feeC;
    s.wallet[token][trader] = bal - amount;
    s.trades.unshift({
      id: `${token}-${s.counter++}`,
      token,
      trader,
      isBuy: false,
      hype: q.out,
      amount,
      price: price(t),
      tax: 0n,
      time: at,
    });
    return q;
  };

  const newToken = (s: State, input: Omit<NewTokenInput, "devBuy">, creator: Address, at: number, address?: Address): TokenView => {
    const t: TokenView = {
      address: address ?? randAddr(),
      name: input.name,
      symbol: input.symbol.toUpperCase(),
      image: input.image,
      description: input.description,
      website: input.website,
      twitter: input.twitter,
      telegram: input.telegram,
      creator,
      launchTime: Math.floor(at),
      virtualHype0: P.virtualHypeInit,
      virtualToken0: P.virtualTokenInit,
      realHype: 0n,
      tokensSold: 0n,
      complete: false,
      migrated: false,
      pool: null,
      launchBlock: 0n,
    };
    s.tokens.unshift(t);
    return t;
  };

  const snapshot = (s: State) => {
    const userBal: Record<string, bigint> = {};
    for (const [tok, holders] of Object.entries(s.wallet)) if (holders[DEMO_ACCOUNT]) userBal[tok] = holders[DEMO_ACCOUNT];
    return {
      tokens: s.tokens.map((t) => ({ ...t })),
      trades: s.trades.slice(0, 800),
      balances: userBal,
      wallet: s.wallet,
      creatorFees: { ...s.creatorFees },
      protectedBought: s.protectedBought,
      comments: { ...s.comments },
      pools: { ...s.pools },
      counter: s.counter,
    };
  };

  const addComment = (s: State, token: Address, author: Address, text: string, at: number) => {
    const list = s.comments[token] ? [...s.comments[token]] : [];
    list.unshift({ id: `c-${token}-${s.counter++}`, token, author, text, time: Math.floor(at) });
    s.comments[token] = list.slice(0, 200);
  };

  const seedMarket = () => {
    seed = 7;
    addrSeed = 1337;
    const s: State = { ...get(), tokens: [], trades: [], wallet: {}, creatorFees: {}, protectedBought: {}, comments: {}, pools: {}, counter: 0 };
    const now = nowS();
    const bots = Array.from({ length: 40 }, randAddr);
    SEEDS.forEach(([name, symbol, glyph, desc], i) => {
      const age = 600 + rnd() * 3 * 3600;
      const t = newToken(
        s,
        { name, symbol, image: avatar(glyph, i), description: desc, website: "", twitter: "", telegram: "" },
        pick(bots),
        now - age,
        randAddr(addrRnd)
      );
      // how far this token got: two have ascended, one is about to
      const target = i === 2 || i === 9 ? 1.2 : i === 4 ? 0.9 : i === 0 ? 0.72 : rnd() * 0.6;
      let at = t.launchTime + 65;
      let guard = 0;
      while (guard++ < 400 && !t.complete) {
        at += 5 + rnd() * ((now - t.launchTime) / 60);
        if (at > now - 5) break;
        const prog = Number((t.tokensSold * 1000n) / CURVE_SUPPLY) / 1000;
        const trader = pick(bots);
        if (prog < target && rnd() < 0.72) {
          try { applyBuy(s, t.address, trader, hypeWei(0.2 + rnd() * (target > 1 ? 6 : 2.5)), 0n, at); } catch {}
        } else {
          const holders = Object.entries(s.wallet[t.address] || {}).filter(([, b]) => b > 0n);
          if (!holders.length) continue;
          const [h, b] = pick(holders);
          try { applySell(s, t.address, h as Address, (b * BigInt(20 + Math.floor(rnd() * 80))) / 100n, 0n, at); } catch {}
        }
      }
    });
    s.trades.sort((a, b) => b.time - a.time);
    s.tokens.sort((a, b) => b.launchTime - a.launchTime);
    for (const t of s.tokens) {
      const n = 1 + Math.floor(rnd() * 5);
      const times = Array.from({ length: n }, () => t.launchTime + rnd() * (now - t.launchTime)).sort((a, b) => a - b);
      for (const at of times) addComment(s, t.address, pick(bots), pick(BOT_LINES), at);
    }
    set({ ...snapshot(s), hypeBalance: 100n * WAD });
  };

  const BOT_NAMES = [
    ["Selene Seal", "SELENE", "🦭"], ["Atlas Ape", "ATLAS", "🦍"], ["Helios", "HELIO", "☀️"], ["Muse", "MUSE", "🎭"],
    ["Kraken Kid", "KRAKEN", "🐙"], ["Echo", "ECHO", "🔔"], ["Iris", "IRIS", "🌈"], ["Titan Toad", "TITAN", "🐊"],
    ["Phoenix", "PHNX", "🔥"], ["Sphinx", "SPHX", "🦁"], ["Gorgon", "GORG", "🐍"], ["Nectar", "NECTR", "🍷"],
  ];
  let botLaunch = 0;

  return {
    tokens: [],
    trades: [],
    hypeBalance: 100n * WAD,
    balances: {},
    creatorFees: {},
    wallet: {},
    protectedBought: {},
    comments: {},
    pools: {},
    started: false,
    counter: 0,

    start: () => {
      if (get().started) return;
      set({ started: true });
      const saved = load();
      if (saved?.tokens?.length) {
        const userBal: Record<string, bigint> = {};
        for (const [tok, holders] of Object.entries(saved.wallet || {})) if (holders[DEMO_ACCOUNT]) userBal[tok] = holders[DEMO_ACCOUNT];
        set({ ...saved, balances: userBal });
      } else seedMarket();
      const loop = () => {
        get().botTick();
        timer = setTimeout(loop, 900 + Math.random() * 1400);
      };
      timer = setTimeout(loop, 800);
    },
    reset: () => {
      try { localStorage.removeItem(STORE_KEY); } catch {}
      seedMarket();
    },
    stop: () => {
      if (timer) clearTimeout(timer);
      set({ started: false });
    },

    botTick: () => {
      const s = { ...get() } as State;
      s.tokens = s.tokens.map((t) => ({ ...t }));
      s.trades = [...s.trades];
      const at = nowS();
      if (Math.random() < 0.07) {
        const live = s.tokens.slice(0, 12);
        if (live.length) addComment(s, pick(live).address, randAddr(), pick(BOT_LINES), at);
      }
      // occasionally a new god is born
      if (Math.random() < 0.035) {
        const [n, sym, g] = BOT_NAMES[botLaunch++ % BOT_NAMES.length];
        const t = newToken(s, { name: n, symbol: sym, image: avatar(g, botLaunch + 3), description: "Freshly forged on Elytheon.", website: "", twitter: "", telegram: "" }, randAddr(), at);
        try { applyBuy(s, t.address, t.creator, hypeWei(0.1 + Math.random() * 0.3), 0n, at); } catch {}
      } else {
        const live = s.tokens.filter((t) => !t.complete);
        if (!live.length) return;
        // hot tokens (young or close to ascending) get more flow
        const weighted = live.flatMap((t) => {
          const prog = Number((t.tokensSold * 100n) / CURVE_SUPPLY);
          const young = at - t.launchTime < 600 ? 3 : 1;
          return Array(young + (prog > 70 ? 4 : prog > 40 ? 2 : 1)).fill(t);
        });
        const t = pick(weighted) as TokenView;
        const prog = Number((t.tokensSold * 100n) / CURVE_SUPPLY);
        const holders = Object.entries(s.wallet[t.address] || {}).filter(([a, b]) => b > 0n && a !== DEMO_ACCOUNT);
        const buyBias = prog > 70 ? 0.8 : 0.62;
        try {
          if (Math.random() < buyBias || !holders.length) {
            const size = prog > 70 ? 0.5 + Math.random() * 4 : 0.03 + Math.random() * 1.6;
            applyBuy(s, t.address, randAddr(), hypeWei(size), 0n, at);
          } else {
            const [h, b] = pick(holders);
            applySell(s, t.address, h as Address, (b * BigInt(10 + Math.floor(Math.random() * 90))) / 100n, 0n, at);
          }
        } catch {}
      }
      set(snapshot(s));
    },

    buy: (token, trader, hypeIn, minOut) => {
      const s = { ...get() } as State;
      if (hypeIn > s.hypeBalance) throw new Error("Not enough HYPE");
      s.tokens = s.tokens.map((t) => ({ ...t }));
      s.trades = [...s.trades];
      const q = applyBuy(s, token, trader, hypeIn, minOut, nowS());
      set({ ...snapshot(s), hypeBalance: s.hypeBalance - q.used });
    },
    sell: (token, trader, amount, minOut) => {
      const s = { ...get() } as State;
      s.tokens = s.tokens.map((t) => ({ ...t }));
      s.trades = [...s.trades];
      const q = applySell(s, token, trader, amount, minOut, nowS());
      set({ ...snapshot(s), hypeBalance: s.hypeBalance + q.out });
    },
    createToken: (input, creator) => {
      const s = { ...get() } as State;
      if (input.devBuy > s.hypeBalance) throw new Error("Not enough HYPE");
      s.tokens = s.tokens.map((t) => ({ ...t }));
      s.trades = [...s.trades];
      const at = nowS();
      const t = newToken(s, input, creator, at);
      let spent = 0n;
      if (input.devBuy > 0n) spent = applyBuy(s, t.address, creator, input.devBuy, 0n, at).used;
      set({ ...snapshot(s), hypeBalance: s.hypeBalance - spent });
      return t.address;
    },
    postComment: (token, author, text) => {
      const s = { ...get() } as State;
      s.comments = { ...s.comments };
      addComment(s, token, author, text, nowS());
      set({ comments: s.comments, counter: s.counter });
    },
    dexQuote: (token, isBuy, amountIn) => {
      const p = get().pools[token];
      if (!p || amountIn === 0n) return 0n;
      return isBuy ? v2Out(amountIn, p.hype, p.tok) : v2Out(amountIn, p.tok, p.hype);
    },
    dexSwap: (token, trader, isBuy, amountIn, minOut) => {
      const s = get();
      const p = s.pools[token];
      if (!p) throw new Error("No pool for this token");
      const out = isBuy ? v2Out(amountIn, p.hype, p.tok) : v2Out(amountIn, p.tok, p.hype);
      if (out < minOut || out === 0n) throw new Error("Price moved — slippage exceeded");
      const wallet = { ...s.wallet, [token]: { ...(s.wallet[token] || {}) } };
      const bal = wallet[token][trader] ?? 0n;
      if (isBuy) {
        if (amountIn > s.hypeBalance) throw new Error("Not enough HYPE");
        wallet[token][trader] = bal + out;
      } else {
        if (amountIn > bal) throw new Error("Not enough tokens");
        wallet[token][trader] = bal - amountIn;
      }
      const pools = { ...s.pools, [token]: isBuy ? { hype: p.hype + amountIn, tok: p.tok - out } : { hype: p.hype - out, tok: p.tok + amountIn } };
      set({
        pools,
        wallet,
        balances: { ...s.balances, [token]: wallet[token][DEMO_ACCOUNT] ?? 0n },
        hypeBalance: isBuy ? s.hypeBalance - amountIn : s.hypeBalance + out,
      });
    },
    claim: (who) => {
      const amt = get().creatorFees[who] ?? 0n;
      if (amt === 0n) throw new Error("No fees to claim yet");
      set({ creatorFees: { ...get().creatorFees, [who]: 0n }, hypeBalance: get().hypeBalance + amt });
      return amt;
    },
  };
});

export type DemoCurve = CurveState;
