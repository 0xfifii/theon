"use client";
import { useAccount, useBalance, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { Wallet, LogOut, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { useLaunchpad } from "@/lib/launchpad";
import { elysium, FAUCET_URL, IS_TESTNET } from "@/lib/config";
import { hype, short } from "@/lib/format";
import { toast } from "@/lib/toast";

export function LiveConnect() {
  const { address, isConnected, chainId } = useAccount();
  const { data: bal } = useBalance({ address, chainId: elysium.id, query: { refetchInterval: 6000 } });
  const hypeBalance = bal?.value ?? 0n;
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-10 w-36 rounded-xl bg-royal-50" />;

  if (!isConnected)
    return (
      <button
        className="btn-primary"
        disabled={isPending}
        onClick={async () => {
          const c = connectors[0];
          if (!c) return toast({ kind: "error", title: "No wallet found", body: "Install MetaMask or Rabby to continue." });
          try {
            await connectAsync({ connector: c, chainId: elysium.id });
          } catch (e) {
            toast({ kind: "error", title: "Could not connect", body: (e as Error).message.slice(0, 120) });
          }
        }}
      >
        <Wallet className="h-4 w-4" /> {isPending ? "Connecting…" : "Connect"}
      </button>
    );

  if (chainId !== elysium.id)
    return (
      <button className="btn bg-amber-500 text-white hover:bg-amber-600" onClick={() => switchChain({ chainId: elysium.id })}>
        <AlertTriangle className="h-4 w-4" /> Switch to Elysium
      </button>
    );

  return (
    <div className="flex items-center gap-1 rounded-xl border border-royal-200 bg-white p-1 pl-3">
      <span className="text-sm font-semibold text-royal-800">{hype(hypeBalance)} HYPE</span>
      {IS_TESTNET && hypeBalance < 10n ** 16n && (
        <a href={FAUCET_URL} target="_blank" rel="noreferrer" className="ml-1 rounded-md bg-royal-50 px-2 py-1 text-[11px] font-bold text-royal-600 hover:bg-royal-100" title="Free testnet HYPE">Get HYPE</a>
      )}
      <span className="ml-2 rounded-lg bg-royal-600 px-2.5 py-1.5 text-xs font-semibold text-white">{short(address)}</span>
      <button title="Disconnect" onClick={() => disconnect()} className="rounded-lg p-1.5 text-royal-900/40 hover:bg-royal-50 hover:text-royal-700">
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

function DemoConnect() {
  const { hypeBalance } = useLaunchpad();
  return (
    <div className="flex items-center gap-1 rounded-xl border border-royal-200 bg-white p-1 pl-3" title="Demo wallet with play-money HYPE">
      <span className="text-sm font-semibold text-royal-800">{hype(hypeBalance)} HYPE</span>
      <span className="ml-2 rounded-lg bg-royal-600 px-2.5 py-1.5 text-xs font-semibold text-white">Demo wallet</span>
    </div>
  );
}

export default function ConnectButton() {
  const { mode } = useLaunchpad();
  return mode === "live" ? <LiveConnect /> : <DemoConnect />;
}
