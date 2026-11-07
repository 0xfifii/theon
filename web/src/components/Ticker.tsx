"use client";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { useMemo } from "react";
import { useLaunchpad } from "@/lib/launchpad";
import { hype, short } from "@/lib/format";
import TokenAvatar from "./TokenAvatar";

export default function Ticker() {
  const { trades, tokens } = useLaunchpad();
  const { t: tx } = useT();
  const items = useMemo(() => {
    const byAddr = new Map(tokens.map((t) => [t.address, t]));
    return trades.slice(0, 18).map((tr) => ({ tr, t: byAddr.get(tr.token) })).filter((x) => x.t);
  }, [trades, tokens]);
  if (!items.length) return <div className="h-10 border-b border-royal-100 bg-royal-50/40" />;
  const row = [...items, ...items];
  return (
    <div className="group relative h-10 overflow-hidden border-b border-royal-100 bg-royal-50/50">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-white to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-white to-transparent" />
      <div className="flex h-full w-max animate-marquee items-center gap-6 group-hover:[animation-play-state:paused]">
        {row.map(({ tr, t }, i) => (
          <Link key={tr.id + i} href={`/token/${t!.address}`} className="flex items-center gap-2 whitespace-nowrap text-xs">
            <TokenAvatar src={t!.image} alt={t!.symbol} size={20} className="rounded-md" />
            <span className="font-mono text-royal-900/50">{short(tr.trader, 3)}</span>
            <span className={`font-bold ${tr.isBuy ? "text-royal-600" : "text-rose-500"}`}>{tr.isBuy ? tx("bought") : tx("sold")}</span>
            <span className="font-semibold text-royal-950">{hype(tr.hype)} HYPE</span>
            <span className="text-royal-900/50">{tx("of")}</span>
            <span className="font-bold text-royal-800">${t!.symbol}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
