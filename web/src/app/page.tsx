"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Crown, Flame, Rocket, Search, Shield, Sparkles, Clock, TrendingUp, Zap } from "lucide-react";
import { useLaunchpad } from "@/lib/launchpad";
import { marketCap, progress } from "@/lib/curve";
import { hype, short, timeAgo, toNum, compact } from "@/lib/format";
import Constellation from "@/components/Constellation";
import CountUp from "@/components/CountUp";
import TokenCard from "@/components/TokenCard";
import TokenAvatar from "@/components/TokenAvatar";
import ProgressBar from "@/components/ProgressBar";
import type { TradeView } from "@/lib/types";

type Filter = "trending" | "new" | "ascending" | "gods";
const FILTERS: { id: Filter; label: string; icon: typeof Flame }[] = [
  { id: "trending", label: "Trending", icon: Flame },
  { id: "new", label: "Newly forged", icon: Clock },
  { id: "ascending", label: "About to ascend", icon: TrendingUp },
  { id: "gods", label: "Gods", icon: Crown },
];

export default function Home() {
  const { tokens, trades, now, ready, mode } = useLaunchpad();
  const [filter, setFilter] = useState<Filter>("trending");
  const [q, setQ] = useState("");

  const lastTrade = useMemo(() => {
    const m: Record<string, TradeView> = {};
    for (const tr of trades) if (!m[tr.token]) m[tr.token] = tr;
    return m;
  }, [trades]);

  const volume24h = useMemo(
    () => trades.filter((t) => now - t.time < 86400).reduce((s, t) => s + t.hype, 0n),
    [trades, now]
  );

  const throne = useMemo(
    () => [...tokens].filter((t) => !t.complete).sort((a, b) => Number(b.tokensSold - a.tokensSold))[0],
    [tokens]
  );

  const list = useMemo(() => {
    let l = tokens;
    if (q.trim()) {
      const s = q.toLowerCase();
      l = l.filter((t) => t.name.toLowerCase().includes(s) || t.symbol.toLowerCase().includes(s) || t.address.toLowerCase() === s);
    }
    const activity = (addr: string) => trades.filter((t) => t.token === addr && now - t.time < 900).length;
    switch (filter) {
      case "new":
        return [...l].sort((a, b) => b.launchTime - a.launchTime);
      case "ascending":
        return l.filter((t) => !t.complete).sort((a, b) => progress(b) - progress(a));
      case "gods":
        return l.filter((t) => t.complete).sort((a, b) => Number(marketCap(b) - marketCap(a)));
      default:
        return [...l].filter((t) => !t.complete).sort((a, b) => activity(b.address) - activity(a.address) || b.launchTime - a.launchTime);
    }
  }, [tokens, trades, filter, q, now]);

  return (
    <div className="space-y-10">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-royal-950 via-royal-800 to-royal-600 text-white shadow-glow">
        <Constellation />
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-royal-400/30 blur-3xl" />
        <div className="relative grid gap-10 p-7 sm:p-10 lg:grid-cols-[1.25fr_1fr] lg:p-14">
          <div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="chip mb-5 bg-white/10 text-white ring-1 ring-white/20">
              <Zap className="h-3.5 w-3.5" /> Built for Elysium · Gas in HYPE · 250ms blocks
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="h-display text-4xl font-bold leading-[1.05] sm:text-6xl">
              Forge a token.
              <br />
              <span className="bg-gradient-to-r from-white via-royal-200 to-royal-300 bg-clip-text text-transparent">Ascend to the Pantheon.</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="mt-5 max-w-xl text-base text-white/75 sm:text-lg">
              Fair launches on Hyperliquid&apos;s fastest chain. Every token starts on a HYPE bonding curve with a sniper shield, pays its creator on every trade, and ascends to the DEX with liquidity burned forever.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="mt-8 flex flex-wrap gap-3">
              <Link href="/create" className="btn bg-white px-6 py-3 text-base text-royal-700 shadow-lg hover:bg-royal-50">
                <Rocket className="h-5 w-5" /> Launch a token
              </Link>
              <a href="#discover" className="btn border border-white/30 px-6 py-3 text-base text-white hover:bg-white/10">
                Explore <ArrowRight className="h-4 w-4" />
              </a>
            </motion.div>
            <div className="mt-10 grid max-w-lg grid-cols-3 gap-4">
              {[
                { k: "Tokens forged", v: tokens.length, f: (n: number) => n.toFixed(0) },
                { k: "24h volume", v: toNum(volume24h), f: (n: number) => compact(n, 1) + " HYPE" },
                { k: "Gods ascended", v: tokens.filter((t) => t.complete).length, f: (n: number) => n.toFixed(0) },
              ].map((s) => (
                <div key={s.k}>
                  <div className="text-xl font-bold sm:text-2xl"><CountUp value={s.v} format={s.f} /></div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-white/55">{s.k}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Throne: closest to ascension */}
          <div className="flex items-center">
            <AnimatePresence mode="wait">
              {throne ? (
                <motion.div key={throne.address} initial={{ opacity: 0, rotateY: -20, scale: 0.95 }} animate={{ opacity: 1, rotateY: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full animate-float">
                  <Link href={`/token/${throne.address}`} className="block rounded-3xl bg-white/95 p-6 text-royal-950 shadow-2xl ring-1 ring-white/50 backdrop-blur transition hover:-translate-y-1 hover:bg-white">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="chip bg-royal-600 text-white"><Crown className="h-3.5 w-3.5" /> On the throne</span>
                      <span className="text-xs font-semibold text-royal-900/45">closest to ascending</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <TokenAvatar src={throne.image} alt={throne.symbol} size={76} />
                      <div className="min-w-0">
                        <div className="h-display truncate text-2xl font-bold">{throne.name}</div>
                        <div className="text-sm font-bold text-royal-600">${throne.symbol}</div>
                        <div className="mt-1 text-xs text-royal-900/50">by {short(throne.creator)} · {timeAgo(throne.launchTime, now)}</div>
                      </div>
                    </div>
                    <div className="mt-5 flex items-end justify-between">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-royal-900/45">Market cap</div>
                        <div className="text-2xl font-bold">{hype(marketCap(throne), 2)} HYPE</div>
                      </div>
                      <div className="text-right text-3xl font-bold text-royal-600">{(progress(throne) * 100).toFixed(1)}%</div>
                    </div>
                    <div className="mt-3"><ProgressBar value={progress(throne)} height={12} /></div>
                  </Link>
                </motion.div>
              ) : (
                <div className="w-full rounded-3xl bg-white/10 p-8 text-center ring-1 ring-white/20">
                  <Crown className="mx-auto h-8 w-8 text-white/70" />
                  <div className="h-display mt-3 text-xl font-bold">The throne is empty</div>
                  <p className="mt-1 text-sm text-white/65">The first token launched here takes it.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div className="meander-white opacity-70" />
      </section>

      {/* HOW IT WORKS */}
      <section className="grid gap-4 md:grid-cols-3">
        {[
          { icon: Rocket, title: "1 · Forge", body: "Name it, give it a face, launch in one click. 1B supply, no team allocation, no presale." },
          { icon: Shield, title: "2 · Shielded start", body: "For the first 60s each wallet is capped at 2% and buys pay a sniper tax that decays to zero. The tax stays in the curve for holders." },
          { icon: Crown, title: "3 · Ascend", body: "Sell out the curve and the token ascends: liquidity moves to the DEX and the LP is burned forever." },
        ].map((s, i) => (
          <motion.div key={s.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} whileHover={{ y: -4 }} className="card group p-6">
            <div className="mb-4 inline-flex rounded-xl bg-royal-50 p-3 text-royal-600 transition group-hover:bg-royal-600 group-hover:text-white">
              <s.icon className="h-6 w-6" />
            </div>
            <div className="h-display text-lg font-bold text-royal-900">{s.title}</div>
            <p className="mt-2 text-sm leading-relaxed text-royal-900/60">{s.body}</p>
          </motion.div>
        ))}
      </section>

      {/* DISCOVER */}
      <section id="discover" className="scroll-mt-24">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="h-display text-3xl font-bold text-royal-900">Discover</h2>
            <p className="text-sm text-royal-900/55">{mode === "live" ? "Live from the Elysium chain." : "Elytheon isn't live yet — tokens appear here once the launchpad is deployed."}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-royal-900/35" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, ticker or address" className="input pl-9 sm:w-72" />
            </div>
            <div className="flex gap-1 overflow-x-auto rounded-xl bg-royal-50 p-1 scroll-thin">
              {FILTERS.map((f) => (
                <button key={f.id} onClick={() => setFilter(f.id)} className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition ${filter === f.id ? "text-white" : "text-royal-800/70 hover:text-royal-800"}`}>
                  {filter === f.id && <motion.span layoutId="filter-pill" className="absolute inset-0 rounded-lg bg-royal-600 shadow" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
                  <f.icon className="relative h-3.5 w-3.5" />
                  <span className="relative">{f.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            {!ready ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="card h-48 animate-pulse bg-royal-50/50" />)}
              </div>
            ) : list.length === 0 ? (
              <div className="card flex flex-col items-center gap-3 p-12 text-center">
                <Sparkles className="h-8 w-8 text-royal-400" />
                <div className="font-semibold text-royal-900">{tokens.length ? "Nothing matches that." : mode === "live" ? "No tokens yet — be the first god." : "Elytheon isn't live yet."}</div>
                {mode === "live" ? <Link href="/create" className="btn-primary">Launch a token</Link> : <Link href="/deploy" className="btn-primary">Deploy Elytheon</Link>}
              </div>
            ) : (
              <motion.div layout className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {list.slice(0, 30).map((t) => <TokenCard key={t.address} t={t} lastTrade={lastTrade[t.address]} />)}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
          <LiveFeed />
        </div>
      </section>
    </div>
  );
}

function LiveFeed() {
  const { trades, tokens, now } = useLaunchpad();
  const byAddr = useMemo(() => new Map(tokens.map((t) => [t.address, t])), [tokens]);
  return (
    <aside className="card sticky top-24 h-fit overflow-hidden">
      <div className="flex items-center justify-between border-b border-royal-100 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold text-royal-900">
          <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-royal-400 opacity-75" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-royal-600" /></span>
          Live oracle
        </div>
        <span className="text-[11px] font-semibold text-royal-900/40">every trade, as it lands</span>
      </div>
      <div className="max-h-[640px] overflow-y-auto scroll-thin">
        <AnimatePresence initial={false}>
          {trades.slice(0, 30).map((tr) => {
            const t = byAddr.get(tr.token);
            if (!t) return null;
            return (
              <motion.div key={tr.id} layout initial={{ opacity: 0, x: -20, backgroundColor: tr.isBuy ? "rgba(47,91,234,.12)" : "rgba(244,63,94,.10)" }} animate={{ opacity: 1, x: 0, backgroundColor: "rgba(255,255,255,0)" }} transition={{ duration: 0.8 }} className="border-b border-royal-50">
                <Link href={`/token/${t.address}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-royal-50/60">
                  <TokenAvatar src={t.image} alt={t.symbol} size={32} className="rounded-lg" />
                  <div className="min-w-0 flex-1 text-xs">
                    <div className="truncate"><span className="font-bold text-royal-900">${t.symbol}</span> <span className={tr.isBuy ? "font-semibold text-royal-600" : "font-semibold text-rose-500"}>{tr.isBuy ? "buy" : "sell"}</span></div>
                    <div className="truncate font-mono text-royal-900/40">{short(tr.trader, 3)}</div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="font-bold text-royal-950">{hype(tr.hype)} HYPE</div>
                    <div className="text-royal-900/40">{timeAgo(tr.time, now)}</div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {!trades.length && <div className="p-6 text-center text-sm text-royal-900/50">No trades yet.</div>}
      </div>
    </aside>
  );
}
