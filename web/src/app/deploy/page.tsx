"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Copy, Droplets, ExternalLink, Loader2, Rocket, ArrowRightLeft, Circle, ServerCog } from "lucide-react";
import { useAccount, useBalance, usePublicClient, useSwitchChain, useWalletClient } from "wagmi";
import { isAddress, zeroAddress, type Abi } from "viem";
import { LiveConnect } from "@/components/ConnectButton";
import { BRIDGE_URL, CHAIN_ID, FAUCET_URL, IS_TESTNET, elysium, explorerAddr, saveBrowserConfig } from "@/lib/config";
import { factoryAbi, launchpadAbi, routerAbi } from "@/lib/abi";
import { useLaunchpadConfig } from "@/lib/launchpad";
import { hype } from "@/lib/format";
import { errMsg, toast } from "@/lib/toast";
import { ascend } from "@/lib/celebrate";

type DexMode = "own" | "existing" | "none";
type StepId = "whype" | "factory" | "router" | "launchpad";
type Saved = Partial<Record<StepId, string>> & { block?: string };

const STEP_LABEL: Record<StepId, string> = {
  whype: "WHYPE (wrapped HYPE for the DEX)",
  factory: "Elytheon DEX · factory",
  router: "Elytheon DEX · router",
  launchpad: "Elytheon launchpad",
};

export default function DeployPage() {
  const router = useRouter();
  const { reload } = useLaunchpadConfig();
  const { address, chainId, isConnected } = useAccount();
  const { data: wallet } = useWalletClient();
  const client = usePublicClient({ chainId: elysium.id });
  const { switchChainAsync } = useSwitchChain();
  const { data: bal } = useBalance({ address, chainId: elysium.id, query: { refetchInterval: 5000 } });
  const [mounted, setMounted] = useState(false);
  const [dexMode, setDexMode] = useState<DexMode>("own");
  const [existingRouter, setExistingRouter] = useState("");
  const [treasury, setTreasury] = useState("");
  const [saved, setSaved] = useState<Saved>({});
  const [running, setRunning] = useState<StepId | null>(null);
  const [copied, setCopied] = useState(false);
  const key = `elytheon-deploy-${CHAIN_ID}-${address ?? "none"}`;

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!address) return;
    setTreasury((t) => t || address);
    try { setSaved(JSON.parse(localStorage.getItem(key) || "{}")); } catch { setSaved({}); }
  }, [address, key]);

  const steps: StepId[] = dexMode === "own" ? ["whype", "factory", "router", "launchpad"] : ["launchpad"];
  const done = !!saved.launchpad;
  const env = useMemo(
    () => (saved.launchpad ? `NEXT_PUBLIC_LAUNCHPAD_ADDRESS=${saved.launchpad}\nNEXT_PUBLIC_DEPLOY_BLOCK=${saved.block}\nNEXT_PUBLIC_CHAIN_ID=${CHAIN_ID}` : ""),
    [saved]
  );

  const persist = (s: Saved) => {
    setSaved(s);
    localStorage.setItem(key, JSON.stringify(s));
  };

  async function deployOne(abi: Abi, bytecode: `0x${string}`, args: unknown[]) {
    const hash = await wallet!.deployContract({ abi, bytecode, args, account: address!, chain: elysium } as never);
    const rc = await client!.waitForTransactionReceipt({ hash });
    if (rc.status !== "success" || !rc.contractAddress) throw new Error("Deployment failed");
    return { address: rc.contractAddress, block: rc.blockNumber };
  }

  async function run() {
    if (!wallet || !address) return toast({ kind: "info", title: "Connect your wallet first" });
    if (!isAddress(treasury)) return toast({ kind: "error", title: "Treasury must be a valid address" });
    if (dexMode === "existing" && !isAddress(existingRouter)) return toast({ kind: "error", title: "Enter a valid router address" });
    try {
      if (chainId !== elysium.id) await switchChainAsync({ chainId: elysium.id });
      const b = await import("@/lib/deployBytecode");
      let s: Saved = { ...saved };
      if (dexMode === "own") {
        if (!s.whype) {
          setRunning("whype");
          s = { ...s, whype: (await deployOne(b.whypeAbi as Abi, b.whypeBytecode, [])).address };
          persist(s);
        }
        if (!s.factory) {
          setRunning("factory");
          s = { ...s, factory: (await deployOne(factoryAbi as Abi, b.factoryBytecode, [address])).address };
          persist(s);
        }
        if (!s.router) {
          setRunning("router");
          s = { ...s, router: (await deployOne(routerAbi as Abi, b.routerBytecode, [s.factory, s.whype])).address };
          persist(s);
        }
      }
      setRunning("launchpad");
      const dexRouter = dexMode === "own" ? s.router! : dexMode === "existing" ? existingRouter : zeroAddress;
      const r = await deployOne(launchpadAbi as Abi, b.launchpadBytecode, [treasury, dexRouter]);
      s = { ...s, launchpad: r.address, block: r.block.toString() };
      persist(s);
      setRunning(null);
      ascend();
      toast({ kind: "success", title: "Elytheon is deployed!", body: "Copy the settings below into Vercel." });
    } catch (e) {
      setRunning(null);
      toast({ kind: "error", title: "Deployment stopped", body: errMsg(e) + " — click Deploy again to continue where it stopped." });
    }
  }

  function useNow() {
    saveBrowserConfig(saved.launchpad!, BigInt(saved.block || 0));
    reload();
    router.push("/");
  }

  if (!mounted) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <div className="chip mx-auto mb-3 bg-royal-50 text-royal-600"><ServerCog className="h-3.5 w-3.5" /> One-time setup</div>
        <h1 className="h-display text-4xl font-bold text-royal-950">Deploy Elytheon</h1>
        <p className="mt-2 text-royal-900/60">Put the launchpad on {elysium.name} straight from your wallet. No command line, no private keys.</p>
      </div>

      {/* 1. wallet */}
      <Section n={1} title="Connect the owner wallet" done={isConnected && chainId === elysium.id}>
        <p className="mb-3 text-sm text-royal-900/60">This wallet becomes the owner of the launchpad (it can change fees and settings on the Admin page). Use a wallet you control safely.</p>
        <div className="flex flex-wrap items-center gap-3">
          <LiveConnect />
          {isConnected && <span className="text-sm text-royal-900/60">Balance: <b className="text-royal-900">{hype(bal?.value ?? 0n)} HYPE</b></span>}
        </div>
        {isConnected && (bal?.value ?? 0n) < 10n ** 16n && (
          <div className="mt-3 flex flex-wrap gap-2 rounded-xl bg-royal-50 p-3 text-sm text-royal-800">
            You need a little HYPE for gas (deploying costs a few cents worth).
            {IS_TESTNET && <a href={FAUCET_URL} target="_blank" rel="noreferrer" className="btn-ghost py-1.5 text-xs"><Droplets className="h-3.5 w-3.5" /> Testnet faucet</a>}
            <a href={BRIDGE_URL} target="_blank" rel="noreferrer" className="btn-ghost py-1.5 text-xs"><ArrowRightLeft className="h-3.5 w-3.5" /> Bridge HYPE to Elysium</a>
          </div>
        )}
      </Section>

      {/* 2. options */}
      <Section n={2} title="Choose where tokens ascend" done={false} muted={done}>
        <div className="grid gap-2 sm:grid-cols-3">
          {([
            ["own", "Elytheon DEX", "Deploy our own Uniswap-V2 DEX. Works today. Switch to Nest later on the Admin page."],
            ["existing", "Existing DEX", "Use a Uniswap-V2-compatible router that's already live (e.g. Nest when it launches)."],
            ["none", "Decide later", "Tokens launch and trade now; sold-out tokens wait safely until you set a router."],
          ] as const).map(([id, title, desc]) => (
            <button key={id} disabled={done || !!running} onClick={() => setDexMode(id)} className={`rounded-xl border p-3 text-left transition ${dexMode === id ? "border-royal-500 bg-royal-50 ring-4 ring-royal-500/10" : "border-royal-100 hover:border-royal-300"}`}>
              <div className="text-sm font-bold text-royal-900">{title}</div>
              <div className="mt-1 text-xs text-royal-900/55">{desc}</div>
            </button>
          ))}
        </div>
        {dexMode === "existing" && (
          <div className="mt-3">
            <label className="label">Router address</label>
            <input className="input font-mono" placeholder="0x…" value={existingRouter} onChange={(e) => setExistingRouter(e.target.value.trim())} />
          </div>
        )}
        <div className="mt-3">
          <label className="label">Treasury (receives platform fees)</label>
          <input className="input font-mono" placeholder="0x…" value={treasury} onChange={(e) => setTreasury(e.target.value.trim())} disabled={done} />
        </div>
      </Section>

      {/* 3. deploy */}
      <Section n={3} title="Deploy" done={done}>
        <div className="space-y-2">
          {steps.map((id) => {
            const addr = saved[id];
            const state = addr ? "done" : running === id ? "run" : "todo";
            return (
              <motion.div key={id} layout className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${state === "done" ? "border-royal-200 bg-royal-50/60" : state === "run" ? "border-royal-400 bg-white shadow-glow" : "border-royal-100"}`}>
                {state === "done" ? <Check className="h-5 w-5 text-royal-600" /> : state === "run" ? <Loader2 className="h-5 w-5 animate-spin text-royal-600" /> : <Circle className="h-5 w-5 text-royal-200" />}
                <span className="flex-1 font-semibold text-royal-900">{STEP_LABEL[id]}</span>
                {addr && <a href={explorerAddr(addr)} target="_blank" rel="noreferrer" className="font-mono text-xs text-royal-600 hover:underline">{addr.slice(0, 8)}…{addr.slice(-6)}</a>}
                {state === "run" && <span className="text-xs text-royal-900/50">confirm in your wallet…</span>}
              </motion.div>
            );
          })}
        </div>
        {!done && (
          <button onClick={run} disabled={!isConnected || !!running} className="btn-primary mt-4 w-full py-3.5 text-base">
            {running ? <><Loader2 className="h-5 w-5 animate-spin" /> Deploying ({steps.indexOf(running) + 1}/{steps.length})…</> : <><Rocket className="h-5 w-5" /> Deploy {steps.length > 1 ? `${steps.length} contracts` : "launchpad"}</>}
          </button>
        )}
        {!done && <p className="mt-2 text-center text-xs text-royal-900/45">Your wallet will ask you to confirm {steps.length} transaction{steps.length > 1 ? "s" : ""}. If anything stops halfway, click Deploy again — finished steps are skipped.</p>}
      </Section>

      {/* 4. go live */}
      {done && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Section n={4} title="Go live" done={false}>
            <p className="text-sm text-royal-900/60">Add these to <b>Vercel → your project → Settings → Environment Variables</b>, then <b>Deployments → Redeploy</b>. After that, everyone who visits the site uses your launchpad.</p>
            <div className="relative mt-3">
              <pre className="overflow-x-auto rounded-xl bg-royal-950 p-4 text-xs leading-relaxed text-royal-100">{env}</pre>
              <button onClick={() => { navigator.clipboard.writeText(env); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="absolute right-2 top-2 rounded-lg bg-white/10 p-2 text-white hover:bg-white/20">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={useNow} className="btn-primary"><Rocket className="h-4 w-4" /> Try it now in this browser</button>
              <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer" className="btn-ghost">Open Vercel <ExternalLink className="h-4 w-4" /></a>
              <button onClick={() => { localStorage.removeItem(key); setSaved({}); }} className="btn-ghost">Start over</button>
            </div>
          </Section>
        </motion.div>
      )}
    </div>
  );
}

function Section({ n, title, done, muted, children }: { n: number; title: string; done: boolean; muted?: boolean; children: React.ReactNode }) {
  return (
    <div className={`card p-5 sm:p-6 ${muted ? "opacity-70" : ""}`}>
      <div className="mb-4 flex items-center gap-3">
        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${done ? "bg-royal-600 text-white" : "bg-royal-50 text-royal-700"}`}>{done ? <Check className="h-4 w-4" /> : n}</div>
        <h2 className="h-display text-lg font-bold text-royal-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}
