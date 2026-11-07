"use client";
import { useAccount, useBalance, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { useT } from "@/lib/i18n";
import { Wallet, LogOut, AlertTriangle, X, ExternalLink, } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { Connector } from "wagmi";
import { useEffect, useState } from "react";
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
  const { t } = useT();
  const [mounted, setMounted] = useState(false);
  const [picker, setPicker] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-10 w-36 rounded-xl bg-royal-50" />;

  if (!isConnected)
    return (
      <>
        <button className="btn-primary" disabled={isPending} onClick={() => setPicker(true)}>
          <Wallet className="h-4 w-4" /> {isPending ? t("Connecting…") : t("Connect")}
        </button>
        <WalletPicker
          open={picker}
          onClose={() => setPicker(false)}
          connectors={connectors}
          onPick={async (c) => {
            setPicker(false);
            try {
              await connectAsync({ connector: c, chainId: elysium.id });
            } catch (e) {
              toast({ kind: "error", title: t("Could not connect"), body: (e as Error).message.slice(0, 120) });
            }
          }}
        />
      </>
    );

  if (chainId !== elysium.id)
    return (
      <button className="btn bg-amber-500 text-white hover:bg-amber-600" onClick={() => switchChain({ chainId: elysium.id })}>
        <AlertTriangle className="h-4 w-4" /> {t("Switch to Elysium")}
      </button>
    );

  return (
    <div className="flex items-center gap-1 rounded-xl border border-royal-200 bg-white p-1 pl-3">
      <span className="text-sm font-semibold text-royal-800">{hype(hypeBalance)} HYPE</span>
      {IS_TESTNET && hypeBalance < 10n ** 16n && (
        <a href={FAUCET_URL} target="_blank" rel="noreferrer" className="ml-1 rounded-md bg-royal-50 px-2 py-1 text-[11px] font-bold text-royal-600 hover:bg-royal-100" title={t("Free testnet HYPE")}>{t("Get HYPE")}</a>
      )}
      <span className="ml-2 rounded-lg bg-royal-600 px-2.5 py-1.5 text-xs font-semibold text-white">{short(address)}</span>
      <button title={t("Disconnect")} onClick={() => disconnect()} className="rounded-lg p-1.5 text-royal-900/40 hover:bg-royal-50 hover:text-royal-700">
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

const OKX_ICON =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><rect width='40' height='40' rx='9' fill='black'/><g fill='white'><rect x='8' y='8' width='7.5' height='7.5' rx='1'/><rect x='24.5' y='8' width='7.5' height='7.5' rx='1'/><rect x='16.25' y='16.25' width='7.5' height='7.5' rx='1'/><rect x='8' y='24.5' width='7.5' height='7.5' rx='1'/><rect x='24.5' y='24.5' width='7.5' height='7.5' rx='1'/></g></svg>"
  );

function hasOkx() {
  return typeof window !== "undefined" && !!(window as unknown as { okxwallet?: unknown }).okxwallet;
}

/** Lists every wallet in the browser, with OKX Wallet first. */
function WalletPicker({ open, onClose, connectors, onPick }: { open: boolean; onClose: () => void; connectors: readonly Connector[]; onPick: (c: Connector) => void }) {
  const { t } = useT();
  // one entry per wallet: prefer the auto-discovered (EIP-6963) version, which carries the real icon
  const seen = new Map<string, Connector>();
  for (const c of connectors) {
    const isOkx = /okx/i.test(c.name) || c.id === "okxWallet" || c.id === "com.okex.wallet";
    const key = isOkx ? "okx" : c.name.toLowerCase();
    if (isOkx && c.id === "okxWallet" && !hasOkx()) continue;
    if (c.id === "injected" && connectors.length > 1) continue; // generic "Injected" only as a last resort
    const prev = seen.get(key);
    if (!prev || (c.icon && !prev.icon)) seen.set(key, c);
  }
  if (!seen.size) {
    const generic = connectors.find((c) => c.id === "injected");
    if (generic) seen.set("browser", generic);
  }
  const list = [...seen.entries()].sort((a, b) => (a[0] === "okx" ? -1 : b[0] === "okx" ? 1 : 0));
  const okxListed = seen.has("okx");

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[90] flex items-center justify-center bg-royal-950/40 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} className="card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="h-display text-lg font-bold text-royal-900">{t("Choose a wallet")}</div>
              <button onClick={onClose} className="rounded-lg p-1 text-royal-900/40 hover:bg-royal-50" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-2">
              {list.map(([key, c]) => (
                <button key={c.uid} onClick={() => onPick(c)} className="flex w-full items-center gap-3 rounded-xl border border-royal-100 p-3 text-left transition hover:border-royal-400 hover:bg-royal-50">
                  {c.icon || key === "okx" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.icon || OKX_ICON} alt="" className="h-9 w-9 rounded-lg" />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-royal-50 text-royal-600"><Wallet className="h-5 w-5" /></span>
                  )}
                  <span className="flex-1 font-semibold text-royal-900">{key === "browser" ? t("Browser wallet") : key === "okx" ? "OKX Wallet" : c.name}</span>
                  {key === "okx" && <span className="chip bg-royal-50 text-royal-600">{t("Recommended")}</span>}
                </button>
              ))}
              {!okxListed && (
                <a href="https://www.okx.com/web3" target="_blank" rel="noreferrer" className="flex w-full items-center gap-3 rounded-xl border border-dashed border-royal-200 p-3 text-left text-sm hover:bg-royal-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={OKX_ICON} alt="" className="h-9 w-9 rounded-lg" />
                  <span className="flex-1 font-semibold text-royal-900">{t("Install OKX Wallet")}</span>
                  <ExternalLink className="h-4 w-4 text-royal-500" />
                </a>
              )}
              {!list.length && <p className="pt-1 text-center text-xs text-royal-900/50">{t("Install a wallet like Zerion, MetaMask or Rabby to continue.")}</p>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function ConnectButton() {
  return <LiveConnect />;
}
