"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Settings2, ArrowDownUp, Crown } from "lucide-react";
import DexPanel from "./DexPanel";
import type { TokenView } from "@/lib/types";
import { useLaunchpad } from "@/lib/launchpad";
import { applySlippage, quoteBuy, quoteSell } from "@/lib/curve";
import { hype, pct, safeParse, tokens as fmtTokens } from "@/lib/format";
import { errMsg, toast } from "@/lib/toast";
import { burst, ascend } from "@/lib/celebrate";
import { explorerTx } from "@/lib/config";
import { formatUnits } from "viem";

export default function TradePanel({ token, onPreview }: { token: TokenView; onPreview?: (sold: bigint | undefined) => void }) {
  const { params, now, hypeBalance, balances, buy, sell, account } = useLaunchpad();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [slip, setSlip] = useState(300); // bps
  const [showSlip, setShowSlip] = useState(false);
  const [busy, setBusy] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const bal = balances[token.address] ?? 0n;
  const wasComplete = useRef(token.complete);

  useEffect(() => {
    if (token.complete && !wasComplete.current) {
      ascend();
      toast({ kind: "success", title: `$${token.symbol} ascended to the Pantheon!`, body: "Liquidity moved to the DEX and the LP was burned." });
    }
    wasComplete.current = token.complete;
  }, [token.complete, token.symbol]);

  const value = safeParse(amount);
  const q = useMemo(() => {
    if (side === "buy") {
      const r = quoteBuy(token, params, value, now);
      return { out: r.out, fees: r.feeP + r.feeC, tax: r.tax, taxBps: r.taxBps, impact: r.priceImpact, used: r.used, sold: token.tokensSold + r.out };
    }
    const r = quoteSell(token, params, value);
    return { out: r.out, fees: r.feeP + r.feeC, tax: 0n, taxBps: 0n, impact: r.priceImpact, used: value, sold: token.tokensSold - (value > token.tokensSold ? token.tokensSold : value) };
  }, [side, token, params, value, now]);

  useEffect(() => {
    onPreview?.(side === "buy" && value > 0n ? q.sold : undefined);
  }, [q.sold, side, value, onPreview]);

  const insufficient = side === "buy" ? value > hypeBalance : value > bal;
  const refund = side === "buy" && q.used < value ? value - q.used : 0n;

  async function submit() {
    if (!account) return toast({ kind: "info", title: "Connect your wallet first" });
    if (value === 0n) return;
    setBusy(true);
    try {
      const minOut = applySlippage(q.out, slip);
      const hash = side === "buy" ? await buy(token.address, value, minOut) : await sell(token.address, value, minOut);
      const r = btn.current?.getBoundingClientRect();
      if (r) burst((r.left + r.width / 2) / window.innerWidth, r.top / window.innerHeight);
      toast({
        kind: "success",
        title: side === "buy" ? `Bought ${fmtTokens(q.out)} $${token.symbol}` : `Sold for ${hype(q.out)} HYPE`,
        body: refund > 0n ? `Curve sold out — ${hype(refund)} HYPE refunded` : undefined,
        link: hash ? explorerTx(hash) : undefined,
      });
      setAmount("");
    } catch (e) {
      toast({ kind: "error", title: "Trade failed", body: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  if (token.complete)
    return token.migrated ? (
      <DexPanel token={token} />
    ) : (
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-br from-royal-900 to-royal-600 p-6 text-center text-white">
          <Crown className="mx-auto h-10 w-10" />
          <div className="h-display mt-2 text-xl font-bold">Ascending…</div>
          <p className="mt-1 text-sm text-white/70">The curve sold out. Liquidity moves to the DEX as soon as the DEX router is connected — funds are safe in the contract until then.</p>
        </div>
      </div>
    );

  const quick = side === "buy" ? ["0.1", "0.5", "1", "5"] : ["25", "50", "75", "100"];

  return (
    <div className="card p-4">
      {/* side switch */}
      <div className="relative mb-4 grid grid-cols-2 rounded-xl bg-royal-50 p-1">
        <motion.div layout className={`absolute inset-y-1 w-[calc(50%-4px)] rounded-lg shadow ${side === "buy" ? "left-1 bg-royal-600" : "left-[calc(50%+3px)] bg-rose-500"}`} transition={{ type: "spring", stiffness: 500, damping: 35 }} />
        {(["buy", "sell"] as const).map((s) => (
          <button key={s} onClick={() => { setSide(s); setAmount(""); }} className={`relative z-10 rounded-lg py-2 text-sm font-bold capitalize transition ${side === s ? "text-white" : "text-royal-900/60"}`}>{s}</button>
        ))}
      </div>

      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold text-royal-900/60">{side === "buy" ? "You pay" : "You sell"}</span>
        <div className="flex items-center gap-2">
          <span className="text-royal-900/50">Balance: <b className="text-royal-800">{side === "buy" ? `${hype(hypeBalance)} HYPE` : `${fmtTokens(bal)} ${token.symbol}`}</b></span>
          <button onClick={() => setShowSlip(!showSlip)} className={`rounded-md p-1 transition ${showSlip ? "bg-royal-100 text-royal-700" : "text-royal-900/40 hover:text-royal-700"}`} title="Slippage">
            <Settings2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showSlip && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mb-3 flex items-center gap-2 rounded-xl bg-royal-50 p-2 text-xs">
              <span className="font-semibold text-royal-800">Max slippage</span>
              {[100, 300, 500, 1000].map((b) => (
                <button key={b} onClick={() => setSlip(b)} className={`rounded-md px-2 py-1 font-semibold ${slip === b ? "bg-royal-600 text-white" : "bg-white text-royal-700"}`}>{b / 100}%</button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`flex items-center rounded-xl border bg-white px-3 transition focus-within:ring-4 ${insufficient ? "border-rose-300 focus-within:ring-rose-500/10" : "border-royal-200 focus-within:border-royal-500 focus-within:ring-royal-500/10"}`}>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="0.0"
          className="min-w-0 flex-1 bg-transparent py-3 text-2xl font-bold text-royal-950 outline-none placeholder:text-royal-900/20"
        />
        <span className="rounded-lg bg-royal-50 px-2.5 py-1 text-sm font-bold text-royal-700">{side === "buy" ? "HYPE" : `$${token.symbol}`}</span>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {quick.map((v) => (
          <button
            key={v}
            onClick={() => {
              if (side === "buy") setAmount(v);
              else setAmount(formatUnits((bal * BigInt(v)) / 100n, 18));
            }}
            className="rounded-lg border border-royal-100 py-1.5 text-xs font-semibold text-royal-700 transition hover:border-royal-300 hover:bg-royal-50 active:scale-95"
          >
            {side === "buy" ? `${v}` : `${v}%`}
          </button>
        ))}
      </div>

      <div className="my-3 flex justify-center"><div className="rounded-full border border-royal-100 bg-white p-1.5 text-royal-400"><ArrowDownUp className="h-4 w-4" /></div></div>

      <motion.div layout className="rounded-xl bg-royal-50/70 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-royal-900/60">You receive (est.)</span>
          <motion.span key={q.out.toString()} initial={{ scale: 1.08, color: "#1E45D6" }} animate={{ scale: 1, color: "#0A1440" }} className="text-lg font-bold">
            {side === "buy" ? `${fmtTokens(q.out)} ${token.symbol}` : `${hype(q.out)} HYPE`}
          </motion.span>
        </div>
        {value > 0n && (
          <div className="mt-2 space-y-1 border-t border-royal-100 pt-2 text-xs text-royal-900/60">
            <Row k="Fees (platform + creator)" v={`${hype(q.fees)} HYPE`} />
            {q.tax > 0n && <Row k={`Sniper tax (${(Number(q.taxBps) / 100).toFixed(1)}%)`} v={`${hype(q.tax)} HYPE`} accent />}
            <Row k="Price impact" v={pct(Math.abs(q.impact), 2)} warn={Math.abs(q.impact) > 0.1} />
            <Row k="Min received" v={side === "buy" ? `${fmtTokens(applySlippage(q.out, slip))} ${token.symbol}` : `${hype(applySlippage(q.out, slip))} HYPE`} />
            {refund > 0n && <Row k="Refund (curve sells out)" v={`${hype(refund)} HYPE`} accent />}
          </div>
        )}
      </motion.div>

      <motion.button
        ref={btn}
        whileTap={{ scale: 0.97 }}
        onClick={submit}
        disabled={busy || value === 0n || insufficient}
        className={`btn mt-4 w-full py-3.5 text-base text-white ${side === "buy" ? "bg-royal-600 shadow-glow hover:bg-royal-700" : "bg-rose-500 hover:bg-rose-600"}`}
      >
        {busy ? <><Loader2 className="h-5 w-5 animate-spin" /> Confirming…</> : insufficient ? "Insufficient balance" : value === 0n ? "Enter an amount" : side === "buy" ? `Buy $${token.symbol}` : `Sell $${token.symbol}`}
      </motion.button>
    </div>
  );
}

function Row({ k, v, accent, warn }: { k: string; v: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className="flex justify-between">
      <span>{k}</span>
      <span className={`font-semibold ${warn ? "text-rose-500" : accent ? "text-royal-600" : "text-royal-900/80"}`}>{v}</span>
    </div>
  );
}
