// Bonding-curve math — mirrors ElytheonLaunchpad.sol exactly (bigint, 18 decimals).
export const WAD = 10n ** 18n;
export const BPS = 10_000n;
export const TOTAL_SUPPLY = 1_000_000_000n * WAD;
export const CURVE_SUPPLY = 800_000_000n * WAD;

export type Params = {
  platformFeeBps: bigint;
  creatorFeeBps: bigint;
  sniperTaxStartBps: bigint;
  protectWindow: bigint; // seconds
  maxWalletProtected: bigint;
  graduationFeeBps: bigint;
  creationFee: bigint;
  virtualHypeInit: bigint;
  virtualTokenInit: bigint;
};

export const DEFAULT_PARAMS: Params = {
  platformFeeBps: 50n,
  creatorFeeBps: 50n,
  sniperTaxStartBps: 2000n,
  protectWindow: 60n,
  maxWalletProtected: 20_000_000n * WAD,
  graduationFeeBps: 300n,
  creationFee: 0n,
  virtualHypeInit: 30n * WAD,
  virtualTokenInit: 1_073_000_000n * WAD,
};

export type CurveState = {
  virtualHype0: bigint;
  virtualToken0: bigint;
  realHype: bigint;
  tokensSold: bigint;
  launchTime: number; // unix seconds
  complete: boolean;
};

const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;

export function reserves(c: CurveState) {
  return { xV: c.virtualHype0 + c.realHype, yV: c.virtualToken0 - c.tokensSold };
}

/** HYPE (wei) per 1 whole token */
export function price(c: CurveState): bigint {
  const { xV, yV } = reserves(c);
  return (xV * WAD) / yV;
}

/** market cap in HYPE (wei) */
export function marketCap(c: CurveState): bigint {
  return (price(c) * TOTAL_SUPPLY) / WAD;
}

/** 0..1 progress toward ascension */
export function progress(c: CurveState): number {
  return Number((c.tokensSold * 1_000_000n) / CURVE_SUPPLY) / 1_000_000;
}

export function sniperTaxBps(c: CurveState, p: Params, now: number): bigint {
  const end = BigInt(Math.floor(c.launchTime)) + p.protectWindow;
  const t = BigInt(Math.floor(now));
  if (c.launchTime === 0 || t >= end) return 0n;
  return (p.sniperTaxStartBps * (end - t)) / p.protectWindow;
}

export function quoteBuy(c: CurveState, p: Params, value: bigint, now: number) {
  const zero = { out: 0n, used: 0n, feeP: 0n, feeC: 0n, tax: 0n, net: 0n, taxBps: 0n, priceImpact: 0 };
  if (c.complete || value <= 0n) return zero;
  const taxBps = sniperTaxBps(c, p, now);
  const totalBps = p.platformFeeBps + p.creatorFeeBps + taxBps;
  const { xV, yV } = reserves(c);
  const remaining = CURVE_SUPPLY - c.tokensSold;
  let used = value;
  let net = value - (value * totalBps) / BPS;
  let out = (yV * net) / (xV + net);
  if (out >= remaining) {
    out = remaining;
    const netNeeded = ceilDiv(xV * remaining, yV - remaining);
    const gross = ceilDiv(netNeeded * BPS, BPS - totalBps);
    if (gross < value) used = gross;
  }
  const feeP = (used * p.platformFeeBps) / BPS;
  const feeC = (used * p.creatorFeeBps) / BPS;
  const tax = (used * taxBps) / BPS;
  net = used - feeP - feeC - tax;
  const before = price(c);
  const after = price({ ...c, realHype: c.realHype + net + tax, tokensSold: c.tokensSold + out });
  const priceImpact = before === 0n ? 0 : Number(((after - before) * 1_000_000n) / before) / 1_000_000;
  return { out, used, feeP, feeC, tax, net, taxBps, priceImpact };
}

export function quoteSell(c: CurveState, p: Params, amount: bigint) {
  if (c.complete || amount <= 0n) return { out: 0n, gross: 0n, feeP: 0n, feeC: 0n, priceImpact: 0 };
  const { xV, yV } = reserves(c);
  const gross = (xV * amount) / (yV + amount);
  const feeP = (gross * p.platformFeeBps) / BPS;
  const feeC = (gross * p.creatorFeeBps) / BPS;
  const before = price(c);
  const after = price({ ...c, realHype: c.realHype - gross, tokensSold: c.tokensSold - amount });
  const priceImpact = before === 0n ? 0 : Number(((after - before) * 1_000_000n) / before) / 1_000_000;
  return { out: gross - feeP - feeC, gross, feeP, feeC, priceImpact };
}

/** HYPE that must be raised (net) to sell out the curve */
export function hypeToAscend(c: CurveState): bigint {
  const { xV, yV } = reserves(c);
  const remaining = CURVE_SUPPLY - c.tokensSold;
  if (remaining <= 0n) return 0n;
  return ceilDiv(xV * remaining, yV - remaining);
}

/** Sample points of the curve (tokens sold → market cap) for the visualizer */
export function curvePoints(c: Pick<CurveState, "virtualHype0" | "virtualToken0">, n = 60) {
  const k = c.virtualHype0 * c.virtualToken0;
  const pts: { sold: number; mcap: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const sold = (CURVE_SUPPLY * BigInt(i)) / BigInt(n);
    const yV = c.virtualToken0 - sold;
    const xV = k / yV;
    const p = (xV * WAD) / yV;
    pts.push({ sold: i / n, mcap: Number((p * TOTAL_SUPPLY) / WAD / 10n ** 14n) / 1e4 });
  }
  return pts;
}

export function applySlippage(amount: bigint, slippageBps: number) {
  return (amount * (BPS - BigInt(slippageBps))) / BPS;
}
