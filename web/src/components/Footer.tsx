import Link from "next/link";
import { TempleMark } from "./Logo";

export default function Footer() {
  return (
    <footer className="mt-10 bg-royal-900 text-white">
      <div className="meander-white" />
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <TempleMark light className="h-10 w-10" />
          <div>
            <div className="h-display text-lg font-bold">ELYTHEON</div>
            <div className="text-xs text-white/60">The Pantheon of Elysium · Fair launches on Hyperliquid&apos;s L2</div>
            <div className="mt-2 flex gap-4 text-xs font-semibold text-white/70">
              <Link href="/deploy" className="hover:text-white">Deploy</Link>
              <Link href="/admin" className="hover:text-white">Admin</Link>
            </div>
          </div>
        </div>
        <div className="max-w-md text-xs leading-relaxed text-white/50">
          Tokens launched here are created by users. Trading is risky; only use what you can afford to lose. Elytheon is an independent project and is not affiliated with Kinetiq or Hyperliquid.
        </div>
      </div>
    </footer>
  );
}
