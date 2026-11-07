"use client";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { AlertTriangle, FlaskConical } from "lucide-react";
import { useLaunchpad, useLaunchpadConfig } from "@/lib/launchpad";
import { clearBrowserConfig } from "@/lib/config";
import { short } from "@/lib/format";

export default function StatusBanner() {
  const { mode, error } = useLaunchpad();
  const { config, reload } = useLaunchpadConfig();
  const { t } = useT();
  if (mode === "live" && error)
    return (
      <div className="bg-rose-50 text-rose-700">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-6 py-2 text-xs font-semibold"><AlertTriangle className="h-4 w-4" /> {error}</div>
      </div>
    );
  if (config.source === "browser")
    return (
      <div className="bg-royal-50 text-royal-800">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-6 py-2 text-xs">
          <FlaskConical className="h-4 w-4" />
          <span>{t("This browser is using your deployed launchpad")} <b className="font-mono">{short(config.address!, 6)}</b>. {t("Add it to Vercel so everyone sees it.")}</span>
          <Link href="/deploy" className="font-bold underline">{t("Setup")}</Link>
          <button className="font-bold underline" onClick={() => { clearBrowserConfig(); reload(); }}>{t("Stop using it")}</button>
        </div>
      </div>
    );
  return null;
}
