"use client";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, ImagePlus, Loader2, Rocket, Shield, Sparkles, Globe, Send, Link2 } from "lucide-react";
import { useLaunchpad } from "@/lib/launchpad";
import { compressImage } from "@/lib/image";
import { quoteBuy, marketCap, progress, type CurveState } from "@/lib/curve";
import { hype, safeParse, tokens as fmtTokens, pct } from "@/lib/format";
import { errMsg, toast } from "@/lib/toast";
import { ascend } from "@/lib/celebrate";
import XIcon from "@/components/XIcon";
import TokenAvatar from "@/components/TokenAvatar";
import ProgressBar from "@/components/ProgressBar";
import CurveVisualizer from "@/components/CurveVisualizer";

const STEPS = ["Identity", "Story", "First buy", "Launch"];

export default function CreatePage() {
  const router = useRouter();
  const { params, create, hypeBalance, account, mode } = useLaunchpad();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [f, setF] = useState({ name: "", symbol: "", image: "", description: "", website: "", twitter: "", telegram: "" });
  const [devBuy, setDevBuy] = useState("0.2");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [imgUrl, setImgUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const fresh: CurveState = useMemo(
    () => ({ virtualHype0: params.virtualHypeInit, virtualToken0: params.virtualTokenInit, realHype: 0n, tokensSold: 0n, launchTime: Math.floor(Date.now() / 1000), complete: false }),
    [params]
  );
  const devWei = safeParse(devBuy);
  const dq = quoteBuy(fresh, params, devWei, fresh.launchTime);
  const capped = dq.out > params.maxWalletProtected;
  const after: CurveState = { ...fresh, tokensSold: dq.out, realHype: dq.net + dq.tax };
  const totalCost = params.creationFee + devWei;

  const valid = [
    f.name.trim().length > 0 && f.name.length <= 32 && f.symbol.trim().length > 0 && f.symbol.length <= 10,
    true,
    !capped && totalCost <= hypeBalance,
    true,
  ];

  async function onFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast({ kind: "error", title: "That's not an image" });
    try {
      set("image", await compressImage(file));
    } catch {
      toast({ kind: "error", title: "Could not read that image" });
    }
  }

  const go = (n: number) => { setDir(n > step ? 1 : -1); setStep(n); };

  async function launch() {
    if (!account) return toast({ kind: "info", title: "Connect your wallet first" });
    setBusy(true);
    try {
      const addr = await create({ ...f, name: f.name.trim(), symbol: f.symbol.trim().toUpperCase(), devBuy: devWei });
      ascend();
      toast({ kind: "success", title: `$${f.symbol.toUpperCase()} is live!`, body: "Your god has entered the arena. Share it." });
      router.push(`/token/${addr}`);
    } catch (e) {
      toast({ kind: "error", title: "Launch failed", body: errMsg(e) });
      setBusy(false);
    }
  }

  const preview = {
    name: f.name || "Your Token",
    symbol: (f.symbol || "TICKER").toUpperCase(),
    image: f.image,
    description: f.description,
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 text-center">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="chip mx-auto mb-3 bg-royal-50 text-royal-600"><Sparkles className="h-3.5 w-3.5" /> The Forge</motion.div>
        <h1 className="h-display text-4xl font-bold text-royal-950 sm:text-5xl">Forge a new god</h1>
        <p className="mt-2 text-royal-900/60">Fair launch · 1B supply · no presale · no team tokens · you earn {Number(params.creatorFeeBps) / 100}% of every trade</p>
      </div>

      {/* stepper */}
      <div className="mx-auto mb-8 flex max-w-2xl items-center">
        {STEPS.map((s, i) => (
          <div key={s} className="flex flex-1 items-center last:flex-none">
            <button onClick={() => i < step || valid.slice(0, i).every(Boolean) ? go(i) : null} className="flex flex-col items-center gap-1.5">
              <motion.div animate={{ scale: i === step ? 1.12 : 1 }} className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition ${i < step ? "bg-royal-600 text-white" : i === step ? "bg-royal-600 text-white ring-4 ring-royal-100" : "bg-royal-50 text-royal-900/40"}`}>
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </motion.div>
              <span className={`text-xs font-semibold ${i <= step ? "text-royal-800" : "text-royal-900/40"}`}>{s}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className="mx-2 mb-5 h-0.5 flex-1 overflow-hidden rounded bg-royal-100">
                <motion.div className="h-full bg-royal-600" animate={{ width: i < step ? "100%" : "0%" }} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* form */}
        <div className="card relative min-h-[460px] overflow-hidden p-6 sm:p-8">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div key={step} custom={dir} initial={{ opacity: 0, x: dir * 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -40 }} transition={{ duration: 0.22 }}>
              {step === 0 && (
                <div className="space-y-5">
                  <div>
                    <span className="label">Image</span>
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                      onDragLeave={() => setDrag(false)}
                      onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files?.[0]); }}
                      onClick={() => fileRef.current?.click()}
                      className={`group flex cursor-pointer items-center gap-5 rounded-2xl border-2 border-dashed p-5 transition ${drag ? "border-royal-500 bg-royal-50" : "border-royal-200 hover:border-royal-400 hover:bg-royal-50/50"}`}
                    >
                      {f.image ? <TokenAvatar src={f.image} alt="preview" size={88} className="rounded-2xl" /> : (
                        <div className="flex h-[88px] w-[88px] items-center justify-center rounded-2xl bg-royal-50 text-royal-400 transition group-hover:scale-105 group-hover:text-royal-600"><ImagePlus className="h-8 w-8" /></div>
                      )}
                      <div className="text-sm">
                        <div className="font-semibold text-royal-900">{f.image ? "Looking divine. Click to change." : "Drop an image or click to upload"}</div>
                        <div className="text-xs text-royal-900/50">Square works best. We shrink it so it lives fully on-chain — no IPFS needed.</div>
                      </div>
                      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
                    </div>
                    <div className="mt-2 flex gap-2">
                      <div className="relative flex-1">
                        <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-royal-900/30" />
                        <input className="input pl-9" placeholder="…or paste an image URL (https:// or ipfs://)" value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} />
                      </div>
                      <button className="btn-ghost" onClick={() => imgUrl && set("image", imgUrl.startsWith("ipfs://") ? imgUrl.replace("ipfs://", "https://ipfs.io/ipfs/") : imgUrl)}>Use</button>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
                    <div>
                      <label className="label">Name</label>
                      <input className="input" maxLength={32} placeholder="e.g. Hyperion Owl" value={f.name} onChange={(e) => set("name", e.target.value)} />
                      <div className="mt-1 text-right text-[11px] text-royal-900/40">{f.name.length}/32</div>
                    </div>
                    <div>
                      <label className="label">Ticker</label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-bold text-royal-400">$</span>
                        <input className="input pl-7 font-bold uppercase" maxLength={10} placeholder="HOWL" value={f.symbol} onChange={(e) => set("symbol", e.target.value.replace(/[^a-zA-Z0-9]/g, ""))} />
                      </div>
                      <div className="mt-1 text-right text-[11px] text-royal-900/40">{f.symbol.length}/10</div>
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <label className="label">Description</label>
                    <textarea className="input min-h-[130px] resize-none" maxLength={400} placeholder="What's the legend? Why should people believe?" value={f.description} onChange={(e) => set("description", e.target.value)} />
                    <div className="mt-1 text-right text-[11px] text-royal-900/40">{f.description.length}/400</div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {([
                      ["website", "Website", Globe, "yoursite.xyz"],
                      ["twitter", "X / Twitter", XIcon, "x.com/yourtoken"],
                      ["telegram", "Telegram", Send, "t.me/yourtoken"],
                    ] as const).map(([k, l, Icon, ph]) => (
                      <div key={k}>
                        <label className="label">{l}</label>
                        <div className="relative">
                          <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-royal-900/30" />
                          <input className="input pl-9" placeholder={ph} value={f[k]} onChange={(e) => set(k, e.target.value)} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-royal-900/45">All optional, but tokens with a story and socials get far more attention.</p>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <div className="flex items-end justify-between">
                      <label className="label">Your first buy (optional)</label>
                      <span className="text-xs text-royal-900/50">Balance: {hype(hypeBalance)} HYPE</span>
                    </div>
                    <div className="flex items-center rounded-xl border border-royal-200 px-3 focus-within:border-royal-500">
                      <input inputMode="decimal" className="min-w-0 flex-1 bg-transparent py-3 text-2xl font-bold outline-none" value={devBuy} onChange={(e) => setDevBuy(e.target.value.replace(/[^0-9.]/g, ""))} />
                      <span className="font-bold text-royal-600">HYPE</span>
                    </div>
                    <input type="range" min={0} max={1} step={0.01} value={Math.min(1, Number(devBuy) || 0)} onChange={(e) => setDevBuy(e.target.value)} className="mt-3 w-full" />
                    <div className="mt-1 flex justify-between text-[11px] text-royal-900/40"><span>0</span><span>0.5</span><span>1 HYPE</span></div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <MiniStat k="You get" v={`${fmtTokens(dq.out)}`} />
                    <MiniStat k="Of supply" v={pct(Number(dq.out / 10n ** 14n) / 1e13, 2)} warn={capped} />
                    <MiniStat k="Sniper tax" v={`${hype(dq.tax)} HYPE`} />
                  </div>
                  <AnimatePresence>
                    {capped && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-600">
                        The sniper shield caps every wallet — including yours — at 2% of supply during the first 60 seconds. Lower your first buy.
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="flex items-start gap-2 rounded-xl bg-royal-50 p-3 text-xs text-royal-800">
                    <Shield className="mt-0.5 h-4 w-4 shrink-0" /> Your first buy happens in the same transaction as the launch, so nobody can buy before you. The launch-second sniper tax applies to you too, and stays in the curve for your holders.
                  </div>
                  <CurveVisualizer curve={fresh} previewSold={dq.out} title="Where your first buy lands" />
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <h3 className="h-display text-xl font-bold text-royal-900">Ready to forge?</h3>
                  <div className="divide-y divide-royal-50 rounded-xl border border-royal-100 text-sm">
                    <Line k="Name" v={`${f.name} ($${f.symbol.toUpperCase()})`} />
                    <Line k="Supply" v="1,000,000,000 (800M on curve, 200M for DEX)" />
                    <Line k="Your first buy" v={devWei > 0n ? `${hype(devWei)} HYPE → ${fmtTokens(dq.out)} ${f.symbol.toUpperCase()}` : "none"} />
                    <Line k="Creation fee" v={params.creationFee > 0n ? `${hype(params.creationFee)} HYPE` : "free"} />
                    <Line k="You earn" v={`${Number(params.creatorFeeBps) / 100}% of every trade, forever on the curve`} />
                    <Line k="Total" v={`${hype(totalCost)} HYPE + gas`} bold />
                  </div>
                  {mode !== "live" && <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Elytheon isn&apos;t live yet, so launching is switched off. Deploy the contracts on the <a href="/deploy" className="font-bold underline">Deploy page</a> first.</div>}
                  <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} disabled={busy || !valid[0] || !valid[2] || mode !== "live"} onClick={launch} className="btn-primary relative w-full overflow-hidden py-4 text-lg">
                    <span className="shine absolute inset-0" />
                    {busy ? <><Loader2 className="h-5 w-5 animate-spin" /> Forging on Elysium…</> : <><Rocket className="h-5 w-5" /> Launch ${f.symbol.toUpperCase() || "TOKEN"}</>}
                  </motion.button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {step < 3 && (
            <div className="mt-8 flex justify-between">
              <button className="btn-ghost" disabled={step === 0} onClick={() => go(step - 1)}><ArrowLeft className="h-4 w-4" /> Back</button>
              <button className="btn-primary" disabled={!valid[step]} onClick={() => go(step + 1)}>Continue <ArrowRight className="h-4 w-4" /></button>
            </div>
          )}
          {step === 3 && <button className="btn-ghost mt-4" onClick={() => go(2)}><ArrowLeft className="h-4 w-4" /> Back</button>}
        </div>

        {/* live preview */}
        <div className="lg:sticky lg:top-24 lg:h-fit">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-royal-900/50">Live preview</div>
          <motion.div layout className="card overflow-hidden">
            <div className="relative h-24 bg-gradient-to-br from-royal-800 to-royal-500">
              <div className="meander-white absolute bottom-0 w-full opacity-60" />
            </div>
            <div className="-mt-10 px-5 pb-5">
              <motion.div key={preview.image} className="relative z-10 w-fit" initial={{ scale: 0.8, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring" }}>
                <TokenAvatar src={preview.image} alt={preview.symbol} size={80} className="rounded-2xl ring-4 ring-white" />
              </motion.div>
              <div className="mt-3 h-display text-xl font-bold text-royal-950">{preview.name}</div>
              <div className="text-sm font-bold text-royal-600">${preview.symbol}</div>
              <p className="mt-2 line-clamp-3 min-h-[3.75rem] text-sm text-royal-900/60">{preview.description || "Your legend goes here…"}</p>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-royal-900/45">Starting market cap</div>
                  <div className="font-bold text-royal-900">{hype(marketCap(after), 2)} HYPE</div>
                </div>
                <span className="chip bg-royal-600 text-white"><Shield className="h-3 w-3" /> Shielded</span>
              </div>
              <div className="mt-2"><ProgressBar value={progress(after)} /></div>
              <div className="mt-1 text-[11px] text-royal-900/45">{(progress(after) * 100).toFixed(2)}% to ascension</div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl p-3 text-center ${warn ? "bg-rose-50" : "bg-royal-50/70"}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-royal-900/45">{k}</div>
      <div className={`font-bold ${warn ? "text-rose-600" : "text-royal-900"}`}>{v}</div>
    </div>
  );
}

function Line({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-2.5">
      <span className="text-royal-900/55">{k}</span>
      <span className={`text-right ${bold ? "font-bold text-royal-950" : "font-semibold text-royal-900"}`}>{v}</span>
    </div>
  );
}
