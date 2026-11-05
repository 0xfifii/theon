"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Coins, Gem, Loader2, Rocket, Wallet } from "lucide-react";
import { useLaunchpad } from "@/lib/launchpad";
import { WAD, marketCap, price, progress } from "@/lib/curve";
import { hype, short, timeAgo, tokens as fmtTokens } from "@/lib/format";
import { errMsg, toast } from "@/lib/toast";
import { burst } from "@/lib/celebrate";
import TokenAvatar from "@/components/TokenAvatar";
import ProgressBar from "@/components/ProgressBar";
import ConnectButton from "@/components/ConnectButton";
import CountUp from "@/components/CountUp";

export default function Profile() {
  const { account, tokens, balances, creatorFees, claimFees, hypeBalance, now } = useLaunchpad();
  const [busy, setBusy] = useState(false);

  const holdings = useMemo(
    () => tokens.filter((t) => (balances[t.address] ?? 0n) > 0n).map((t) => ({ t, bal: balances[t.address], value: (balances[t.address] * price(t)) / WAD })).sort((a, b) => (b.value > a.value ? 1 : -1)),
    [tokens, balances]
  );
  const mine = useMemo(() => tokens.filter((t) => account && t.creator.toLowerCase() === account.toLowerCase()), [tokens, account]);
  const portfolio = holdings.reduce((s, h) => s + h.value, 0n);

  if (!account)
    return (
      <div className="card mx-auto max-w-md p-10 text-center">
        <Wallet className="mx-auto h-10 w-10 text-royal-500" />
        <div className="h-display mt-3 text-2xl font-bold">Your altar awaits</div>
        <p className="mt-2 text-sm text-royal-900/60">Connect a wallet to see your tokens, holdings and creator rewards.</p>
        <div className="mt-6 flex justify-center"><ConnectButton /></div>
      </div>
    );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="h-display text-4xl font-bold text-royal-950">My Altar</h1>
        <p className="font-mono text-sm text-royal-900/50">{short(account, 8)}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <motion.div whileHover={{ y: -3 }} className="card p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-royal-900/50"><Wallet className="h-4 w-4" /> HYPE balance</div>
          <div className="mt-2 text-3xl font-bold text-royal-950"><CountUp value={Number(hypeBalance) / 1e18} format={(n) => n.toFixed(3)} /></div>
        </motion.div>
        <motion.div whileHover={{ y: -3 }} className="card p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-royal-900/50"><Gem className="h-4 w-4" /> Holdings value</div>
          <div className="mt-2 text-3xl font-bold text-royal-950"><CountUp value={Number(portfolio) / 1e18} format={(n) => n.toFixed(3)} /> <span className="text-base text-royal-900/50">HYPE</span></div>
        </motion.div>
        <motion.div whileHover={{ y: -3 }} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-royal-700 to-royal-500 p-5 text-white shadow-glow">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/70"><Coins className="h-4 w-4" /> Creator rewards</div>
          <div className="mt-2 text-3xl font-bold"><CountUp value={Number(creatorFees) / 1e18} format={(n) => n.toFixed(4)} /> HYPE</div>
          <button
            disabled={busy || creatorFees === 0n}
            onClick={async (e) => {
              setBusy(true);
              const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
              try {
                await claimFees();
                burst((r.left + r.width / 2) / window.innerWidth, r.top / window.innerHeight);
                toast({ kind: "success", title: "Rewards claimed", body: "Your HYPE is in your wallet." });
              } catch (err) {
                toast({ kind: "error", title: "Claim failed", body: errMsg(err) });
              } finally {
                setBusy(false);
              }
            }}
            className="btn mt-3 bg-white text-royal-700 hover:bg-royal-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />} Claim
          </button>
        </motion.div>
      </div>

      <section>
        <h2 className="h-display mb-3 text-2xl font-bold text-royal-900">Holdings</h2>
        {holdings.length === 0 ? (
          <div className="card p-8 text-center text-sm text-royal-900/60">No tokens yet. <Link href="/" className="font-semibold text-royal-600 hover:underline">Find your first god →</Link></div>
        ) : (
          <div className="card divide-y divide-royal-50 overflow-hidden">
            {holdings.map(({ t, bal, value }) => (
              <Link key={t.address} href={`/token/${t.address}`} className="flex items-center gap-4 px-5 py-3 hover:bg-royal-50/60">
                <TokenAvatar src={t.image} alt={t.symbol} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{t.name} <span className="text-sm text-royal-600">${t.symbol}</span></div>
                  <div className="text-xs text-royal-900/50">{fmtTokens(bal)} tokens</div>
                </div>
                <div className="text-right font-bold">{hype(value)} HYPE</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="h-display text-2xl font-bold text-royal-900">Gods you forged</h2>
          <Link href="/create" className="btn-primary"><Rocket className="h-4 w-4" /> New launch</Link>
        </div>
        {mine.length === 0 ? (
          <div className="card p-8 text-center text-sm text-royal-900/60">You haven&apos;t launched anything yet.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mine.map((t) => (
              <Link key={t.address} href={`/token/${t.address}`} className="card p-4 transition hover:-translate-y-0.5 hover:border-royal-300">
                <div className="flex items-center gap-3">
                  <TokenAvatar src={t.image} alt={t.symbol} size={44} />
                  <div className="min-w-0">
                    <div className="truncate font-bold">{t.name}</div>
                    <div className="text-xs text-royal-900/50">${t.symbol} · {timeAgo(t.launchTime, now)}</div>
                  </div>
                </div>
                <div className="mt-3 flex justify-between text-xs"><span className="text-royal-900/50">Market cap</span><b>{hype(marketCap(t), 2)} HYPE</b></div>
                <div className="mt-2"><ProgressBar value={t.complete ? 1 : progress(t)} ascended={t.complete} height={6} /></div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
