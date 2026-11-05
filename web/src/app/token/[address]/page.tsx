"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Copy, Check, Globe, Send, Crown, Share2 } from "lucide-react";
import { useLaunchpad, useToken } from "@/lib/launchpad";
import { CURVE_SUPPLY, hypeToAscend, marketCap, price, progress } from "@/lib/curve";
import { hype, short, timeAgo, tinyPrice, tokens as fmtTokens, toNum } from "@/lib/format";
import { explorerAddr, explorerTx } from "@/lib/config";
import XIcon from "@/components/XIcon";
import TokenAvatar from "@/components/TokenAvatar";
import ProgressBar from "@/components/ProgressBar";
import PriceChart from "@/components/PriceChart";
import TradePanel from "@/components/TradePanel";
import CurveVisualizer from "@/components/CurveVisualizer";
import SniperShield from "@/components/SniperShield";
import Comments from "@/components/Comments";
import { toast } from "@/lib/toast";
import type { Address } from "@/lib/types";

export default function TokenPage() {
  const { address } = useParams<{ address: string }>();
  const t = useToken(address);
  const { trades, now, params, loadToken, balances, mode, ready, holders: apiHolders, comments, pools, error } = useLaunchpad();
  const [tab, setTab] = useState<"comments" | "trades" | "holders" | "about">("comments");
  const [preview, setPreview] = useState<bigint | undefined>();
  const [copied, setCopied] = useState(false);
  const onPreview = useCallback((s: bigint | undefined) => setPreview(s), []);

  const known = !!t;
  useEffect(() => {
    if (!address || !known) return;
    loadToken(address as Address).catch(() => {});
    const i = setInterval(() => loadToken(address as Address).catch(() => {}), 8000);
    return () => clearInterval(i);
  }, [address, known, loadToken]);

  const tTrades = useMemo(() => trades.filter((x) => x.token.toLowerCase() === address?.toLowerCase()), [trades, address]);
  const holders = useMemo(() => {
    const fromChain = address ? apiHolders[t?.address ?? ""] : undefined;
    if (fromChain) return fromChain;
    const m = new Map<string, bigint>();
    for (const tr of tTrades) m.set(tr.trader, (m.get(tr.trader) ?? 0n) + (tr.isBuy ? tr.amount : -tr.amount));
    return [...m.entries()].filter(([, b]) => b > 0n).sort((a, b) => (b[1] > a[1] ? 1 : -1));
  }, [tTrades, apiHolders, address, t?.address]);
  const vol24 = useMemo(() => tTrades.filter((x) => now - x.time < 86400).reduce((s, x) => s + x.hype, 0n), [tTrades, now]);
  const change = useMemo(() => {
    if (!t) return 0;
    const old = [...tTrades].reverse().find((x) => now - x.time < 3600);
    const base = old ? toNum(old.price) : toNum((t.virtualHype0 * 10n ** 18n) / t.virtualToken0);
    return base ? toNum(price(t)) / base - 1 : 0;
  }, [tTrades, t, now]);

  if (!t)
    return ready ? (error ? (
      <div className="card mx-auto max-w-md p-10 text-center text-sm text-rose-600">{error}</div>
    ) : (
      <div className="card mx-auto max-w-md p-10 text-center">
        <div className="h-display text-2xl font-bold text-royal-900">Token not found</div>
        <p className="mt-2 text-sm text-royal-900/60">It may not be indexed yet. Give it a few seconds.</p>
        <Link href="/" className="btn-primary mt-6">Back to Discover</Link>
      </div>
    )) : (
      <div className="h-96 animate-pulse rounded-3xl bg-royal-50" />
    );

  const prog = progress(t);
  const pool = pools[t.address];
  const livePrice = t.migrated && pool ? pool.price : price(t);
  const liveMcap = (livePrice * 1_000_000_000n * 10n ** 18n) / 10n ** 18n;
  const nComments = comments[t.address]?.length ?? 0;
  const myBal = balances[t.address] ?? 0n;
  const toAscend = hypeToAscend(t);

  return (
    <div className="space-y-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-royal-900/60 hover:text-royal-700"><ArrowLeft className="h-4 w-4" /> Discover</Link>

      {/* header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card relative overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-royal-100 blur-3xl" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <motion.div whileHover={{ rotate: -4, scale: 1.05 }}><TokenAvatar src={t.image} alt={t.symbol} size={84} className="rounded-2xl" /></motion.div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="h-display text-2xl font-bold text-royal-950 sm:text-3xl">{t.name}</h1>
                <span className="chip bg-royal-600 text-white">${t.symbol}</span>
                {t.complete && <span className="chip bg-royal-900 text-white"><Crown className="h-3 w-3" /> God</span>}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-royal-900/55">
                <span>by <a className="font-semibold text-royal-700 hover:underline" href={mode === "live" ? explorerAddr(t.creator) : undefined} target="_blank" rel="noreferrer">{short(t.creator)}</a></span>
                <span>· launched {timeAgo(t.launchTime, now)}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(t.address); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
                  className="inline-flex items-center gap-1 rounded-md bg-royal-50 px-2 py-0.5 font-mono text-royal-700 hover:bg-royal-100"
                >
                  {short(t.address, 5)} {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
              <div className="mt-2 flex gap-1.5">
                {t.website && <Social href={t.website} icon={Globe} />}
                {t.twitter && <Social href={t.twitter} icon={XIcon} />}
                {t.telegram && <Social href={t.telegram} icon={Send} />}
                <button
                  onClick={() => { navigator.clipboard.writeText(window.location.href); toast({ kind: "success", title: "Link copied", body: "Share it with your community." }); }}
                  className="rounded-lg border border-royal-100 p-1.5 text-royal-600 hover:bg-royal-50"
                  title="Copy link"
                ><Share2 className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
            <Stat k="Market cap" v={`${hype(t.migrated && pool ? liveMcap : marketCap(t), 2)} HYPE`} sub={<span className={change >= 0 ? "text-royal-600" : "text-rose-500"}>{change >= 0 ? "▲" : "▼"} {(Math.abs(change) * 100).toFixed(1)}% 1h</span>} />
            <Stat k="Price" v={`${tinyPrice(livePrice)}`} sub={t.migrated ? "HYPE · on DEX" : "HYPE"} />
            <Stat k="24h volume" v={`${hype(vol24)} HYPE`} />
            <Stat k="Holders" v={String(holders.length)} />
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <SniperShield token={t} params={params} now={now} />
          <PriceChart token={t} trades={tTrades} />
          <CurveVisualizer curve={t} previewSold={preview} title="Bonding curve · hover to explore" />

          {/* tabs */}
          <div className="card overflow-hidden">
            <div className="flex border-b border-royal-100 px-2">
              {(["comments", "trades", "holders", "about"] as const).map((x) => (
                <button key={x} onClick={() => setTab(x)} className={`relative px-4 py-3 text-sm font-semibold capitalize ${tab === x ? "text-royal-700" : "text-royal-900/50 hover:text-royal-700"}`}>
                  {x}{x === "holders" ? ` (${holders.length})` : x === "comments" && nComments ? ` (${nComments})` : ""}
                  {tab === x && <motion.span layoutId="tok-tab" className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-royal-600" />}
                </button>
              ))}
            </div>
            <div className="max-h-[460px] overflow-y-auto scroll-thin">
              {tab === "comments" && <Comments token={t} />}
              {tab === "trades" && (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white text-left text-[11px] uppercase tracking-wider text-royal-900/40">
                    <tr><th className="px-4 py-2">Trader</th><th className="px-4 py-2">Type</th><th className="px-4 py-2 text-right">HYPE</th><th className="px-4 py-2 text-right">{t.symbol}</th><th className="px-4 py-2 text-right">When</th></tr>
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false}>
                      {tTrades.slice(0, 100).map((tr) => (
                        <motion.tr key={tr.id} initial={{ backgroundColor: tr.isBuy ? "rgba(47,91,234,.14)" : "rgba(244,63,94,.12)" }} animate={{ backgroundColor: "rgba(255,255,255,0)" }} transition={{ duration: 1.2 }} className="border-t border-royal-50">
                          <td className="px-4 py-2 font-mono text-xs text-royal-900/60">{short(tr.trader)}</td>
                          <td className={`px-4 py-2 font-bold ${tr.isBuy ? "text-royal-600" : "text-rose-500"}`}>{tr.isBuy ? "Buy" : "Sell"}{tr.tax > 0n && <span className="ml-1 text-[10px] font-semibold text-royal-400">taxed</span>}</td>
                          <td className="px-4 py-2 text-right font-semibold">{hype(tr.hype)}</td>
                          <td className="px-4 py-2 text-right">{fmtTokens(tr.amount)}</td>
                          <td className="px-4 py-2 text-right text-xs text-royal-900/50">{tr.tx ? <a href={explorerTx(tr.tx)} target="_blank" rel="noreferrer" className="hover:underline">{timeAgo(tr.time, now)}</a> : timeAgo(tr.time, now)}</td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              )}
              {tab === "holders" && (
                <div className="divide-y divide-royal-50">
                  {holders.slice(0, 50).map(([h, b], i) => {
                    const share = Number((b * 10000n) / 1_000_000_000n / 10n ** 18n) / 100;
                    return (
                      <div key={h} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        <span className="w-6 text-xs font-bold text-royal-900/40">#{i + 1}</span>
                        <span className="flex-1 font-mono text-xs text-royal-900/70">{short(h, 6)}{h === t.creator && <span className="ml-2 chip bg-royal-50 text-royal-600">creator</span>}</span>
                        <div className="w-32"><div className="h-1.5 overflow-hidden rounded-full bg-royal-50"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, share * 5)}%` }} className="h-full bg-royal-500" /></div></div>
                        <span className="w-16 text-right font-semibold">{share.toFixed(2)}%</span>
                      </div>
                    );
                  })}
                  <div className="px-4 py-3 text-xs text-royal-900/40">Bonding curve holds the unsold {fmtTokens(CURVE_SUPPLY - t.tokensSold + 200_000_000n * 10n ** 18n)} {t.symbol}. {mode === "live" ? "Holder list is built from on-chain transfers." : "Holder list is built from trades."}</div>
                </div>
              )}
              {tab === "about" && (
                <div className="space-y-4 p-5 text-sm text-royal-900/70">
                  <p className="whitespace-pre-wrap">{t.description || "No description yet."}</p>
                  <div className="grid gap-2 rounded-xl bg-royal-50/60 p-4 text-xs sm:grid-cols-2">
                    <div>Total supply: <b>1,000,000,000</b></div>
                    <div>On the curve: <b>800,000,000</b></div>
                    <div>Reserved for DEX liquidity: <b>200,000,000</b></div>
                    <div>Team allocation: <b>none</b></div>
                    <div>Trading fee: <b>{Number(params.platformFeeBps + params.creatorFeeBps) / 100}%</b> ({Number(params.creatorFeeBps) / 100}% to creator)</div>
                    <div>LP after ascension: <b>burned forever</b></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* right column */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          <div className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-royal-900/50">Ascension</span>
              <span className="text-sm font-bold text-royal-700">{t.complete ? "100%" : `${(prog * 100).toFixed(2)}%`}</span>
            </div>
            <ProgressBar value={t.complete ? 1 : prog} ascended={t.complete} height={12} />
            <p className="mt-2 text-xs text-royal-900/55">
              {t.complete
                ? `Raised ${hype(t.realHype)} HYPE and ascended to the DEX.`
                : <>About <b className="text-royal-800">{hype(toAscend)} HYPE</b> more buys this token into the Pantheon. {hype(t.realHype)} HYPE is in the curve now.</>}
            </p>
          </div>
          <TradePanel token={t} onPreview={onPreview} />
          {myBal > 0n && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card flex items-center justify-between p-4 text-sm">
              <span className="font-semibold text-royal-900/60">Your position</span>
              <span className="text-right"><b className="text-royal-900">{fmtTokens(myBal)} {t.symbol}</b><br /><span className="text-xs text-royal-900/50">≈ {hype((myBal * price(t)) / 10n ** 18n)} HYPE</span></span>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v, sub }: { k: string; v: string; sub?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-royal-900/45">{k}</div>
      <motion.div key={v} initial={{ opacity: 0.4, y: -2 }} animate={{ opacity: 1, y: 0 }} className="text-lg font-bold text-royal-950">{v}</motion.div>
      {sub && <div className="text-xs font-semibold text-royal-900/50">{sub}</div>}
    </div>
  );
}

function Social({ href, icon: Icon }: { href: string; icon: React.ComponentType<{ className?: string }> }) {
  const url = /^https?:\/\//.test(href) ? href : `https://${href}`;
  return <a href={url} target="_blank" rel="noreferrer" className="rounded-lg border border-royal-100 p-1.5 text-royal-600 hover:bg-royal-50"><Icon className="h-4 w-4" /></a>;
}
