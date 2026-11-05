"use client";
import Link from "next/link";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { Crown, TrendingUp } from "lucide-react";
import { useLaunchpad } from "@/lib/launchpad";
import { marketCap, progress } from "@/lib/curve";
import { hype, timeAgo } from "@/lib/format";
import TokenAvatar from "@/components/TokenAvatar";
import ProgressBar from "@/components/ProgressBar";

export default function Pantheon() {
  const { tokens, now } = useLaunchpad();
  const gods = useMemo(() => tokens.filter((t) => t.complete).sort((a, b) => Number(marketCap(b) - marketCap(a))), [tokens]);
  const contenders = useMemo(() => tokens.filter((t) => !t.complete).sort((a, b) => progress(b) - progress(a)).slice(0, 12), [tokens]);
  const podium = [gods[1], gods[0], gods[2]];

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-royal-900 to-royal-700 px-6 pb-0 pt-12 text-center text-white">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-full bg-[radial-gradient(ellipse_at_top,rgba(185,204,255,.35),transparent_60%)]" />
        <Crown className="relative mx-auto h-10 w-10" />
        <h1 className="h-display relative mt-3 text-4xl font-bold sm:text-5xl">The Pantheon</h1>
        <p className="relative mx-auto mt-2 max-w-xl text-white/70">Tokens that sold out their curve and ascended to the DEX, with liquidity burned forever.</p>

        <div className="relative mx-auto mt-10 flex max-w-3xl items-end justify-center gap-3 sm:gap-6">
          {podium.map((g, i) => {
            const rank = i === 1 ? 1 : i === 0 ? 2 : 3;
            const h = rank === 1 ? "h-44" : rank === 2 ? "h-32" : "h-24";
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 * (3 - rank), type: "spring" }} className="flex w-1/3 max-w-[200px] flex-col items-center">
                {g ? (
                  <Link href={`/token/${g.address}`} className="group mb-3 flex flex-col items-center">
                    <motion.div whileHover={{ y: -6, rotate: -3 }} className="relative">
                      {rank === 1 && <Crown className="absolute -top-7 left-1/2 h-6 w-6 -translate-x-1/2 text-royal-200" />}
                      <TokenAvatar src={g.image} alt={g.symbol} size={rank === 1 ? 84 : 64} className="rounded-2xl ring-4 ring-white/80" />
                    </motion.div>
                    <div className="mt-2 truncate text-sm font-bold">{g.name}</div>
                    <div className="text-xs text-white/70">{hype(marketCap(g), 1)} HYPE</div>
                  </Link>
                ) : (
                  <div className="mb-3 flex h-[100px] items-center text-xs text-white/40">awaiting a god</div>
                )}
                <div className={`flex w-full ${h} items-start justify-center rounded-t-xl bg-white/95 pt-3 text-royal-700 shadow-2xl`}>
                  <span className="h-display text-3xl font-bold">{rank}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="h-display mb-4 text-2xl font-bold text-royal-900">All gods</h2>
        {gods.length === 0 ? (
          <div className="card p-10 text-center text-royal-900/60">No token has ascended yet. Will yours be first?</div>
        ) : (
          <div className="card divide-y divide-royal-50 overflow-hidden">
            {gods.map((g, i) => (
              <motion.div key={g.address} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                <Link href={`/token/${g.address}`} className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-royal-50/60">
                  <span className="h-display w-8 text-lg font-bold text-royal-300">{i + 1}</span>
                  <TokenAvatar src={g.image} alt={g.symbol} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-royal-950">{g.name} <span className="text-sm text-royal-600">${g.symbol}</span></div>
                    <div className="text-xs text-royal-900/50">born {timeAgo(g.launchTime, now)} · raised {hype(g.realHype)} HYPE</div>
                  </div>
                  <div className="text-right font-bold text-royal-900">{hype(marketCap(g), 2)} HYPE<div className="text-[11px] font-semibold text-royal-900/40">market cap at ascension</div></div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="h-display mb-1 flex items-center gap-2 text-2xl font-bold text-royal-900"><TrendingUp className="h-6 w-6 text-royal-500" /> Contenders</h2>
        <p className="mb-4 text-sm text-royal-900/55">Closest to joining the Pantheon.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {contenders.map((t, i) => (
            <Link key={t.address} href={`/token/${t.address}`} className="card flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:border-royal-300">
              <span className="w-6 text-sm font-bold text-royal-300">#{i + 1}</span>
              <TokenAvatar src={t.image} alt={t.symbol} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{t.name}</div>
                <ProgressBar value={progress(t)} height={6} />
              </div>
              <span className="text-sm font-bold text-royal-600">{(progress(t) * 100).toFixed(0)}%</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
