"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck, Lock } from "lucide-react";
import { useAccount, usePublicClient, useSwitchChain, useWalletClient } from "wagmi";
import { formatEther, isAddress, parseEther, zeroAddress } from "viem";
import { launchpadAbi } from "@/lib/abi";
import { elysium, explorerAddr } from "@/lib/config";
import { useLaunchpad, useLaunchpadConfig } from "@/lib/launchpad";
import { LiveConnect } from "@/components/ConnectButton";
import { hype, short } from "@/lib/format";
import { errMsg, toast } from "@/lib/toast";
import type { Address } from "@/lib/types";

type Cfg = {
  owner: Address; router: Address; treasury: Address; paused: boolean; protocolFees: bigint;
  platformFeeBps: number; creatorFeeBps: number; graduationFeeBps: number; creationFee: bigint;
  sniperTaxStartBps: number; protectWindow: number; maxWalletProtected: bigint;
  virtualHypeInit: bigint; virtualTokenInit: bigint;
};

export default function Admin() {
  const { config } = useLaunchpadConfig();
  const { tokens } = useLaunchpad();
  const LP = config.address as Address | null;
  const client = usePublicClient({ chainId: elysium.id });
  const { data: wallet } = useWalletClient();
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [f, setF] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!client || !LP) return;
    const r = (fn: string) => client.readContract({ address: LP, abi: launchpadAbi, functionName: fn as never }) as Promise<never>;
    const names = ["owner", "router", "treasury", "creationPaused", "protocolFees", "platformFeeBps", "creatorFeeBps", "graduationFeeBps", "creationFee", "sniperTaxStartBps", "protectWindow", "maxWalletProtected", "virtualHypeInit", "virtualTokenInit"];
    const v = await Promise.all(names.map(r));
    const c: Cfg = {
      owner: v[0], router: v[1], treasury: v[2], paused: v[3], protocolFees: v[4],
      platformFeeBps: Number(v[5]), creatorFeeBps: Number(v[6]), graduationFeeBps: Number(v[7]), creationFee: v[8],
      sniperTaxStartBps: Number(v[9]), protectWindow: Number(v[10]), maxWalletProtected: v[11], virtualHypeInit: v[12], virtualTokenInit: v[13],
    };
    setCfg(c);
    setF({
      router: c.router === zeroAddress ? "" : c.router, treasury: c.treasury,
      platform: String(c.platformFeeBps / 100), creator: String(c.creatorFeeBps / 100), graduation: String(c.graduationFeeBps / 100), creationFee: formatEther(c.creationFee),
      tax: String(c.sniperTaxStartBps / 100), window: String(c.protectWindow), maxWallet: String(Number(formatEther(c.maxWalletProtected)) / 1e7),
      vHype: formatEther(c.virtualHypeInit), vToken: String(Number(formatEther(c.virtualTokenInit)) / 1e6),
    });
  }, [client, LP]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const isOwner = !!(cfg && address && cfg.owner.toLowerCase() === address.toLowerCase());
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function tx(label: string, functionName: string, args: unknown[] = []) {
    if (!wallet || !address || !LP) return;
    setBusy(label);
    try {
      if (chainId !== elysium.id) await switchChainAsync({ chainId: elysium.id });
      const hash = await wallet.writeContract({ address: LP, abi: launchpadAbi, functionName: functionName as never, args: args as never, account: address, chain: elysium } as never);
      const rc = await client!.waitForTransactionReceipt({ hash });
      if (rc.status !== "success") throw new Error("Transaction failed");
      toast({ kind: "success", title: `${label} — done` });
      await load();
    } catch (e) {
      toast({ kind: "error", title: `${label} failed`, body: errMsg(e) });
    } finally {
      setBusy(null);
    }
  }

  const bps = (pct: string) => Math.round(Number(pct) * 100);

  if (!LP)
    return (
      <div className="card mx-auto max-w-lg p-10 text-center">
        <div className="h-display text-2xl font-bold">No launchpad deployed yet</div>
        <p className="mt-2 text-sm text-royal-900/60">The site is in demo mode. Deploy the contracts first.</p>
        <Link href="/deploy" className="btn-primary mt-6">Go to Deploy</Link>
      </div>
    );

  const stuck = tokens.filter((t) => t.complete && !t.migrated);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h-display text-4xl font-bold text-royal-950">Admin</h1>
          <p className="text-sm text-royal-900/55">Launchpad <a className="font-mono text-royal-600 hover:underline" href={explorerAddr(LP)} target="_blank" rel="noreferrer">{short(LP, 6)}</a>{cfg && <> · owner <span className="font-mono">{short(cfg.owner)}</span></>}</p>
        </div>
        <LiveConnect />
      </div>

      {!cfg ? (
        <div className="card h-40 animate-pulse bg-royal-50/50" />
      ) : (
        <>
          <div className={`flex items-center gap-2 rounded-xl p-3 text-sm font-semibold ${isOwner ? "bg-royal-600 text-white" : "bg-royal-50 text-royal-800"}`}>
            {isOwner ? <><ShieldCheck className="h-4 w-4" /> You are the owner — changes below are live on-chain.</> : <><Lock className="h-4 w-4" /> Read-only. Connect the owner wallet to make changes.</>}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Box title="Platform fees waiting">
              <div className="text-2xl font-bold">{hype(cfg.protocolFees)} HYPE</div>
              <div className="text-xs text-royal-900/50">goes to treasury {short(cfg.treasury)}</div>
              <Btn busy={busy} label="Withdraw fees" disabled={cfg.protocolFees === 0n} onClick={() => tx("Withdraw fees", "withdrawProtocolFees")} />
            </Box>
            <Box title="New launches">
              <div className="text-2xl font-bold">{cfg.paused ? "Paused" : "Open"}</div>
              <div className="text-xs text-royal-900/50">trading continues either way</div>
              <Btn busy={busy} label={cfg.paused ? "Resume launches" : "Pause launches"} disabled={!isOwner} onClick={() => tx(cfg.paused ? "Resume launches" : "Pause launches", "setCreationPaused", [!cfg.paused])} />
            </Box>
            <Box title="Tokens launched">
              <div className="text-2xl font-bold">{tokens.length}</div>
              <div className="text-xs text-royal-900/50">{tokens.filter((t) => t.migrated).length} ascended · {stuck.length} waiting for DEX</div>
            </Box>
          </div>

          <Box title="DEX router (where tokens ascend)">
            <p className="mb-2 text-xs text-royal-900/55">Uniswap-V2-compatible router. To switch to Nest when it launches, paste its router address here. {cfg.router === zeroAddress && <b className="text-rose-600">No router set — sold-out tokens are waiting.</b>}</p>
            <div className="flex gap-2">
              <input className="input font-mono" value={f.router || ""} onChange={(e) => set("router", e.target.value.trim())} placeholder="0x…" />
              <Btn busy={busy} label="Save router" disabled={!isOwner || !isAddress(f.router || "")} onClick={() => tx("Save router", "setRouter", [f.router])} />
            </div>
            {stuck.length > 0 && (
              <div className="mt-3 space-y-2">
                {stuck.map((t) => (
                  <div key={t.address} className="flex items-center justify-between rounded-lg bg-royal-50 p-2 text-sm">
                    <span><b>${t.symbol}</b> sold out — {hype(t.realHype)} HYPE waiting</span>
                    <Btn busy={busy} label={`Ascend $${t.symbol}`} disabled={cfg.router === zeroAddress} onClick={() => tx(`Ascend $${t.symbol}`, "migrate", [t.address])} />
                  </div>
                ))}
              </div>
            )}
          </Box>

          <div className="grid gap-4 md:grid-cols-2">
            <Box title="Fees">
              <Field label="Platform fee per trade (%)" v={f.platform} on={(v) => set("platform", v)} />
              <Field label="Creator fee per trade (%)" v={f.creator} on={(v) => set("creator", v)} />
              <Field label="Ascension fee (% of raise)" v={f.graduation} on={(v) => set("graduation", v)} />
              <Field label="Launch fee (HYPE)" v={f.creationFee} on={(v) => set("creationFee", v)} />
              <p className="text-[11px] text-royal-900/45">Limits: platform + creator ≤ 3%, ascension ≤ 10%.</p>
              <Btn busy={busy} label="Save fees" disabled={!isOwner} onClick={() => tx("Save fees", "setFees", [bps(f.platform), bps(f.creator), bps(f.graduation), parseEther(f.creationFee || "0")])} />
            </Box>
            <Box title="Sniper shield">
              <Field label="Starting sniper tax (%)" v={f.tax} on={(v) => set("tax", v)} />
              <Field label="Protection window (seconds)" v={f.window} on={(v) => set("window", v)} />
              <Field label="Max per wallet during window (% of supply)" v={f.maxWallet} on={(v) => set("maxWallet", v)} />
              <p className="text-[11px] text-royal-900/45">Limits: tax ≤ 50%, window ≤ 600s, cap ≥ 0.1%.</p>
              <Btn busy={busy} label="Save shield" disabled={!isOwner} onClick={() => tx("Save shield", "setProtection", [bps(f.tax), Number(f.window), parseEther(String(Number(f.maxWallet) * 1e7))])} />
            </Box>
            <Box title="Curve for new launches">
              <Field label="Starting virtual HYPE" v={f.vHype} on={(v) => set("vHype", v)} />
              <Field label="Starting virtual tokens (millions)" v={f.vToken} on={(v) => set("vToken", v)} />
              <p className="text-[11px] text-royal-900/45">Default 30 HYPE / 1,073M ≈ 28 HYPE starting market cap, ascends at ~88 HYPE raised. Existing tokens keep their curve.</p>
              <Btn busy={busy} label="Save curve" disabled={!isOwner} onClick={() => tx("Save curve", "setCurve", [parseEther(f.vHype || "0"), parseEther(String(Number(f.vToken) * 1e6))])} />
            </Box>
            <Box title="Treasury">
              <Field label="Treasury address" v={f.treasury} on={(v) => set("treasury", v.trim())} mono />
              <Btn busy={busy} label="Save treasury" disabled={!isOwner || !isAddress(f.treasury || "")} onClick={() => tx("Save treasury", "setTreasury", [f.treasury])} />
            </Box>
          </div>
        </>
      )}
    </div>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card space-y-2 p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-royal-900/50">{title}</div>
      {children}
    </div>
  );
}
function Field({ label, v, on, mono }: { label: string; v?: string; on: (v: string) => void; mono?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-royal-900/60">{label}</span>
      <input className={`input ${mono ? "font-mono" : ""}`} value={v ?? ""} onChange={(e) => on(e.target.value)} />
    </label>
  );
}
function Btn({ busy, label, onClick, disabled }: { busy: string | null; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={!!busy || disabled} className="btn-primary mt-1 whitespace-nowrap">
      {busy === label ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {label}
    </button>
  );
}
