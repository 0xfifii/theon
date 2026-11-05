import type { CurveState, Params } from "./curve";

export type Address = `0x${string}`;

export type TokenView = CurveState & {
  address: Address;
  name: string;
  symbol: string;
  image: string;
  description: string;
  website: string;
  twitter: string;
  telegram: string;
  creator: Address;
  migrated: boolean;
  pool: Address | null;
  launchBlock: bigint;
};

export type TradeView = {
  id: string;
  token: Address;
  trader: Address;
  isBuy: boolean;
  hype: bigint; // HYPE spent (buy) or received (sell)
  amount: bigint; // tokens
  price: bigint; // HYPE per token after the trade
  tax: bigint;
  time: number; // unix seconds
  tx?: string;
};

export type CommentView = {
  id: string;
  token: Address;
  author: Address;
  text: string;
  time: number;
  tx?: string;
};

export type PoolView = {
  hypeReserve: bigint;
  tokenReserve: bigint;
  price: bigint; // HYPE per whole token
};

export type NewTokenInput = {
  name: string;
  symbol: string;
  image: string;
  description: string;
  website: string;
  twitter: string;
  telegram: string;
  devBuy: bigint;
};

export type LaunchpadAPI = {
  mode: "setup" | "live";
  ready: boolean;
  error: string | null;
  params: Params;
  tokens: TokenView[];
  trades: TradeView[];
  comments: Record<string, CommentView[]>;
  holders: Record<string, [Address, bigint][]>;
  pools: Record<string, PoolView>;
  account: Address | null;
  hypeBalance: bigint;
  balances: Record<string, bigint>; // token → balance for the connected account
  creatorFees: bigint;
  now: number;
  refresh: (token?: Address) => void;
  buy: (token: Address, hypeIn: bigint, minOut: bigint) => Promise<string | void>;
  sell: (token: Address, amount: bigint, minOut: bigint) => Promise<string | void>;
  create: (input: NewTokenInput) => Promise<Address>;
  claimFees: () => Promise<string | void>;
  loadToken: (token: Address) => Promise<void>;
  postComment: (token: Address, text: string) => Promise<string | void>;
  /** DEX trading for ascended tokens */
  dexQuote: (token: Address, isBuy: boolean, amountIn: bigint) => Promise<bigint>;
  dexSwap: (token: Address, isBuy: boolean, amountIn: bigint, minOut: bigint) => Promise<string | void>;
};
