"use client";
import { create } from "zustand";
import { tr } from "./i18n";

export type Toast = { id: number; kind: "success" | "error" | "info"; title: string; body?: string; link?: string };
type S = { toasts: Toast[]; push: (t: Omit<Toast, "id">) => void; remove: (id: number) => void };
let n = 0;
export const useToasts = create<S>((set) => ({
  toasts: [],
  push: (t) => {
    const id = ++n;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 5200);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));
export const toast = (t: Omit<Toast, "id">) => useToasts.getState().push(t);

export function errMsg(e: unknown): string {
  const m = (e as { shortMessage?: string; message?: string })?.shortMessage || (e as Error)?.message || tr("Something went wrong");
  if (/User rejected|denied/i.test(m)) return tr("You cancelled the transaction");
  const custom = m.match(/reverted with the following reason:\s*(.*)/) || m.match(/Error: (\w+)\(\)/);
  const map: Record<string, string> = {
    Slippage: "Price moved too much — try again or raise slippage",
    WalletCapExceeded: "Anti-sniper cap: max 2% per wallet in the first 60s",
    CurveComplete: "This token already ascended — trade it on the DEX",
    CreationFeeNotPaid: "Creation fee not paid",
    BadName: "Name must be 1–32 characters, ticker 1–10",
    CreationPaused: "Launches are paused right now",
    BadComment: "Comments must be 1–280 characters",
  };
  for (const k of Object.keys(map)) if (m.includes(k)) return tr(map[k]);
  if (m.includes("isn't live yet")) return tr("Elytheon isn't live yet — deploy the contracts on the Deploy page first.");
  return custom ? custom[1] : m.slice(0, 140);
}
