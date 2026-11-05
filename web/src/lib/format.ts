import { formatUnits, parseUnits } from "viem";

export function toNum(wei: bigint, decimals = 18) {
  return Number(formatUnits(wei, decimals));
}

export function compact(n: number, digits = 2) {
  if (!isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(digits).replace(/\.?0+$/, "") + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(digits).replace(/\.?0+$/, "") + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(digits).replace(/\.?0+$/, "") + "K";
  if (abs === 0) return "0";
  if (abs < 0.0001) return n.toExponential(2);
  if (abs < 1) return n.toFixed(4).replace(/\.?0+$/, "");
  return n.toFixed(digits).replace(/\.?0+$/, "");
}

export function hype(wei: bigint, digits = 3) {
  const n = toNum(wei);
  if (n !== 0 && Math.abs(n) < 0.001) return "<0.001";
  return compact(n, digits);
}

export function tokens(wei: bigint) {
  return compact(toNum(wei), 2);
}

/** tiny prices like 0.0000000279 → "0.0₇279" */
export function tinyPrice(wei: bigint) {
  const n = toNum(wei);
  if (n === 0) return "0";
  if (n >= 0.0001) return n.toPrecision(4);
  const s = n.toFixed(20);
  const m = s.match(/^0\.(0+)(\d{3})/);
  if (!m) return n.toExponential(3);
  const subs = "₀₁₂₃₄₅₆₇₈₉";
  const zeros = String(m[1].length).split("").map((d) => subs[Number(d)]).join("");
  return `0.0${zeros}${m[2]}`;
}

export function short(addr?: string, n = 4) {
  if (!addr) return "";
  return `${addr.slice(0, 2 + n)}…${addr.slice(-n)}`;
}

export function timeAgo(ts: number, now = Date.now() / 1000) {
  const d = Math.max(0, Math.floor(now - ts));
  if (d < 5) return "just now";
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

export function safeParse(v: string, decimals = 18): bigint {
  try {
    if (!v || isNaN(Number(v)) || Number(v) < 0) return 0n;
    return parseUnits(v as `${number}`, decimals);
  } catch {
    return 0n;
  }
}

export function pct(x: number, digits = 1) {
  return `${(x * 100).toFixed(digits)}%`;
}
