"use client";
import Link from "next/link";
import { useT } from "@/lib/i18n";

export function TempleMark({ className = "h-8 w-8", light = false }: { className?: string; light?: boolean }) {
  const bg = light ? "#FFFFFF" : "#1E45D6";
  const fg = light ? "#1E45D6" : "#FFFFFF";
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" fill={bg} />
      <path d="M14 22 L32 12 L50 22 Z" fill={fg} />
      <rect x="14" y="24" width="36" height="3" fill={fg} />
      <rect x="18" y="29" width="5" height="18" fill={fg} />
      <rect x="29.5" y="29" width="5" height="18" fill={fg} />
      <rect x="41" y="29" width="5" height="18" fill={fg} />
      <rect x="12" y="49" width="40" height="4" rx="1" fill={fg} />
    </svg>
  );
}

export default function Logo() {
  const { t } = useT();
  return (
    <Link href="/" className="group flex items-center gap-2.5">
      <TempleMark className="h-9 w-9 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105" />
      <div className="leading-none">
        <div className="h-display text-lg font-bold text-royal-900">ELYTHEON</div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-royal-500">{t("Pantheon of Elysium")}</div>
      </div>
    </Link>
  );
}
