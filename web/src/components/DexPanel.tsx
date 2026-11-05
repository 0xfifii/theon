"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Crown, Loader2, ArrowDownUp, ExternalLink } from "lucide-react";
import { formatUnits } from "viem";
import type { TokenView } from "@/lib/types";
import { useLaunchpad } from "@/lib/launchpad";
import { applySlippage } from "@/lib/curve";
import { hype, safeParse, tokens as fmtTokens, tinyPrice } from "@/lib/format";
import { errMsg, toast } from "@/lib/toast";
import { burst } from "@/lib/celebrate";
import { explorerAddr, explorerTx } from "@/lib/config";

/** Trade an ascended token on the DEX it graduated to (Uniswap-V2 router set on the launchpad). */
export default function DexPanel({ token }: { token: TokenView }) {
  const { dexQuote, dexSwap, pools, hypeBalance, balances, account, mode } = useLaunchpad();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [out, setOut] = useState(0n);
  const [busy, setBusy] = useState(false);
  const [qErr, setQErr] = useState<string | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pool = pools[token.address];
  const bal = balances[token.address] ?? 0n;
  const value = safeParse(amount);
  const insufficient = side === "buy" ? value > hypeBalance : value > bal;

  useEffect(() => {
    let alive = true;
    setQErr(null);
    if (value === 0n) return setOut(0n);
    dexQuote(token.address, side === "buy", value)
      .then((o) => alive && setOut(o))
      .catch((e) => alive && (setOut(0n), setQErr(errMsg(e))));
    return () => { alive = false; };
  }, [value, side, token.address, dexQuote, pool?.hypeReserve]);

  async function submit() {
    if (!account) return toast({ kind: "info", title: "Connect your wallet first" });
    setBusy(true);
    try {
      const hash = await dexSwap(token.address, side === "buy", value, applySlippage(out, 300));
      const r = btn.current?.getBoundingClientRect();
      if (r) burst((r.left + r.width / 2) / window.innerWidth, r.top / window.innerHeight);
      toast({ kind: "success", title: side === "buy" ? `Bought ${fmtTokens(out)} $${token.symbol}` : `Sold for ${hype(out)} HYPE`, body: "Traded on the DEX", link: hash ? explorerTx(hash) : undefined });
      setAmount("");
    } catch (e) {
      toast({ kind: "error", title: "Swap failed", body: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="bg-gradient-to-br from-royal-900 to-royal-600 p-5 text-center text-white">
        <Crown className="mx-auto h-8 w-8" />
        <div className="h-display mt-1 text-lg font-bold">Ascended · trading on the DEX</div>
        <p className="mt-1 text-xs text-white/70">The curve sold out and the LP was burned forever. Trade it here through the DEX.</p>
        {pool && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-left text-xs">
            <div className="rounded-lg bg-white/10 p-2"><div className="text-white/60">Pool HYPE</div><b>{hype(pool.hypeReserve)}</b></div>
            <div className="rounded-lg bg-white/10 p-2"><div className="text-white/60">DEX price</div><b>{tinyPrice(pool.price)} HYPE</b></div>
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="relative mb-3 grid grid-cols-2 rounded-xl bg-royal-50 p-1">
          <motion.div layout className={`absolute inset-y-1 w-[calc(50%-4px)] rounded-lg shadow ${side === "buy" ? "left-1 bg-royal-600" : "left-[calc(50%+3px)] bg-rose-500"}`} />
          {(["buy", "sell"] as const).map((s) => (
            <button key={s} onClick={() => { setSide(s); setAmount(""); }} className={`relative z-10 py-2 text-sm font-bold capitalize ${side === s ? "text-white" : "text-royal-900/60"}`}>{s}</button>
          ))}
        </div>
        <div className="mb-1 flex justify-between text-xs text-royal-900/50">
          <span>{side === "buy" ? "You pay" : "You sell"}</span>
          <span>Balance: <b className="text-royal-800">{side === "buy" ? `${hype(hypeBalance)} HYPE` : `${fmtTokens(bal)} ${token.symbol}`}</b></span>
        </div>
        <div className="flex items-center rounded-xl border border-royal-200 px-3 focus-within:border-royal-500">
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.0" className="min-w-0 flex-1 bg-transparent py-3 text-2xl font-bold outline-none placeholder:text-royal-900/20" />
          <span className="rounded-lg bg-royal-50 px-2.5 py-1 text-sm font-bold text-royal-700">{side === "buy" ? "HYPE" : `$${token.symbol}`}</span>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {(side === "buy" ? ["0.1", "0.5", "1", "5"] : ["25", "50", "75", "100"]).map((v) => (
            <button key={v} onClick={() => setAmount(side === "buy" ? v : formatUnits((bal * BigInt(v)) / 100n, 18))} className="rounded-lg border border-royal-100 py-1.5 text-xs font-semibold text-royal-700 hover:bg-royal-50">{side === "buy" ? v : `${v}%`}</button>
          ))}
        </div>
        <div className="my-3 flex justify-center"><div className="rounded-full border border-royal-100 p-1.5 text-royal-400"><ArrowDownUp className="h-4 w-4" /></div></div>
        <div className="rounded-xl bg-royal-50/70 p-3 text-sm">
          <div className="flex justify-between"><span className="text-xs font-semibold text-royal-900/60">You receive (est.)</span><b>{side === "buy" ? `${fmtTokens(out)} ${token.symbol}` : `${hype(out)} HYPE`}</b></div>
          {value > 0n && <div className="mt-1 flex justify-between text-xs text-royal-900/50"><span>DEX fee 0.3% · max slippage 3%</span><span>min {side === "buy" ? fmtTokens(applySlippage(out, 300)) : hype(applySlippage(out, 300))}</span></div>}
          {qErr && <div className="mt-1 text-xs text-rose-500">{qErr}</div>}
        </div>
        <button ref={btn} onClick={submit} disabled={busy || value === 0n || insufficient || out === 0n} className={`btn mt-3 w-full py-3.5 text-base text-white ${side === "buy" ? "bg-royal-600 hover:bg-royal-700" : "bg-rose-500 hover:bg-rose-600"}`}>
          {busy ? <><Loader2 className="h-5 w-5 animate-spin" /> Confirming…</> : insufficient ? "Insufficient balance" : value === 0n ? "Enter an amount" : `${side === "buy" ? "Buy" : "Sell"} $${token.symbol}`}
        </button>
        {token.pool && mode === "live" && (
          <a href={explorerAddr(token.pool)} target="_blank" rel="noreferrer" className="mt-2 flex items-center justify-center gap-1 text-xs font-semibold text-royal-600 hover:underline">
            View pool on explorer <ExternalLink className="h-3 w-3" />
          </a>
        )}
        <div className="mt-1 text-center text-[11px] text-royal-900/40">{pool ? `${fmtTokens(pool.tokenReserve)} ${token.symbol} in pool` : ""}</div>
      </div>
    </div>
  );
}
