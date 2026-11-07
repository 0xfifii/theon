"use client";
import { Shield } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { TokenView } from "@/lib/types";
import type { Params } from "@/lib/curve";
import { sniperTaxBps } from "@/lib/curve";

export default function SniperShield({ token, params, now }: { token: TokenView; params: Params; now: number }) {
  const { t } = useT();
  const win = Number(params.protectWindow);
  const left = Math.max(0, token.launchTime + win - now);
  if (left <= 0 || token.complete) return null;
  const frac = left / win;
  const r = 22, c = 2 * Math.PI * r;
  const tax = Number(sniperTaxBps(token, params, now)) / 100;
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-royal-600 p-4 text-white shadow-glow">
      <div className="relative h-14 w-14">
        <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
          <circle cx="28" cy="28" r={r} stroke="white" strokeOpacity=".2" strokeWidth="5" fill="none" />
          <circle cx="28" cy="28" r={r} stroke="white" strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ transition: "stroke-dashoffset 1s linear" }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-sm font-bold">{Math.ceil(left)}s</div>
      </div>
      <div className="text-sm">
        <div className="flex items-center gap-1.5 font-bold"><Shield className="h-4 w-4" /> {t("Sniper shield active")}</div>
        <div className="text-white/75">{t("Sniper tax now")} <b className="text-white">{tax.toFixed(1)}%</b> {t("(falls to 0) · max 2% of supply per wallet")}</div>
      </div>
    </div>
  );
}
