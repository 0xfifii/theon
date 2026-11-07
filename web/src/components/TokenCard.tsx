"use client";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Crown, Shield, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { TokenView, TradeView } from "@/lib/types";
import { marketCap, progress } from "@/lib/curve";
import { hype, timeAgo } from "@/lib/format";
import { useLaunchpad } from "@/lib/launchpad";
import TokenAvatar from "./TokenAvatar";
import ProgressBar from "./ProgressBar";

export default function TokenCard({ t, lastTrade }: { t: TokenView; lastTrade?: TradeView }) {
  const { now, params } = useLaunchpad();
  const { t: tx } = useT();
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [6, -6]), { stiffness: 200, damping: 18 });
  const ry = useSpring(useTransform(mx, [0, 1], [-6, 6]), { stiffness: 200, damping: 18 });
  const glow = useTransform([mx, my], ([x, y]: number[]) => `radial-gradient(260px circle at ${x * 100}% ${y * 100}%, rgba(47,91,234,.14), transparent 60%)`);

  const [flash, setFlash] = useState<"buy" | "sell" | null>(null);
  const prevId = useRef(lastTrade?.id);
  useEffect(() => {
    if (lastTrade && lastTrade.id !== prevId.current) {
      prevId.current = lastTrade.id;
      setFlash(lastTrade.isBuy ? "buy" : "sell");
      const id = setTimeout(() => setFlash(null), 900);
      return () => clearTimeout(id);
    }
  }, [lastTrade]);

  const prog = progress(t);
  const protectedNow = now < t.launchTime + Number(params.protectWindow);
  const hot = prog > 0.75 && !t.complete;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      style={{ perspective: 800 }}
    >
      <Link href={`/token/${t.address}`}>
        <motion.div
          ref={ref}
          onMouseMove={(e) => {
            const r = ref.current!.getBoundingClientRect();
            mx.set((e.clientX - r.left) / r.width);
            my.set((e.clientY - r.top) / r.height);
          }}
          onMouseLeave={() => { mx.set(0.5); my.set(0.5); }}
          style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
          className={`card group relative overflow-hidden p-4 transition-colors duration-500 hover:border-royal-300 ${flash === "buy" ? "!border-royal-400 !bg-royal-50" : flash === "sell" ? "!border-rose-200 !bg-rose-50/50" : ""}`}
        >
          <motion.div
            className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{ background: glow }}
          />
          <div className="relative flex gap-3" style={{ transform: "translateZ(30px)" }}>
            <TokenAvatar src={t.image} alt={t.symbol} size={64} className="transition-transform duration-300 group-hover:scale-105" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <div className="truncate font-bold text-royal-950">{t.name}</div>
                {t.complete && <Crown className="h-4 w-4 shrink-0 text-royal-600" />}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-royal-600">${t.symbol}</span>
                <span className="text-royal-900/40">· {timeAgo(t.launchTime, now)}</span>
              </div>
              <div className="mt-1 line-clamp-1 text-xs text-royal-900/55">{t.description || tx("A new god joins the Pantheon.")}</div>
            </div>
          </div>

          <div className="relative mt-4" style={{ transform: "translateZ(20px)" }}>
            <div className="mb-1.5 flex items-end justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-royal-900/45">{tx("Market cap")}</div>
                <div className="text-base font-bold text-royal-900">{hype(marketCap(t), 2)} <span className="text-xs font-semibold text-royal-900/50">HYPE</span></div>
              </div>
              <div className="flex items-center gap-1.5">
                {protectedNow && <span className="chip bg-royal-600 text-white"><Shield className="h-3 w-3" /> {tx("Shielded")}</span>}
                {hot && <span className="chip bg-royal-100 text-royal-700"><Sparkles className="h-3 w-3" /> {tx("Ascending")}</span>}
                {t.complete && <span className="chip bg-royal-900 text-white"><Crown className="h-3 w-3" /> {tx("God")}</span>}
              </div>
            </div>
            <ProgressBar value={t.complete ? 1 : prog} ascended={t.complete} />
            <div className="mt-1 flex justify-between text-[11px] font-medium text-royal-900/45">
              <span>{t.complete ? tx("Ascended to the Pantheon") : tx("{n}% to ascension", { n: (prog * 100).toFixed(1) })}</span>
              {lastTrade && <span className={lastTrade.isBuy ? "text-royal-600" : "text-rose-500"}>{lastTrade.isBuy ? "▲" : "▼"} {hype(lastTrade.hype)} · {timeAgo(lastTrade.time, now)}</span>}
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}
