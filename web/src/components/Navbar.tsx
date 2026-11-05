"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, Plus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import Logo from "./Logo";
import ConnectButton from "./ConnectButton";
import { useLaunchpad } from "@/lib/launchpad";

const LINKS = [
  { href: "/", label: "Discover" },
  { href: "/pantheon", label: "Pantheon" },
  { href: "/profile", label: "My Altar" },
];

export default function Navbar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const { mode } = useLaunchpad();
  return (
    <header className="sticky top-0 z-50 border-b border-royal-100 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => {
              const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
              return (
                <Link key={l.href} href={l.href} className={`relative rounded-lg px-3 py-2 text-sm font-semibold transition ${active ? "text-royal-700" : "text-royal-900/60 hover:text-royal-700"}`}>
                  {l.label}
                  {active && <motion.span layoutId="nav-underline" className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-royal-600" />}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <span className={`chip hidden sm:inline-flex ${mode === "demo" ? "bg-royal-50 text-royal-600" : "bg-emerald-50 text-emerald-700"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${mode === "demo" ? "bg-royal-500" : "bg-emerald-500"} animate-pulse`} />
            {mode === "demo" ? "Demo market" : "Elysium live"}
          </span>
          <Link href="/create" className="btn-primary hidden sm:inline-flex">
            <Plus className="h-4 w-4" /> Launch
          </Link>
          <div className="hidden md:block"><ConnectButton /></div>
          <button className="rounded-lg p-2 text-royal-700 md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-royal-100 md:hidden">
            <div className="flex flex-col gap-1 p-4">
              {[...LINKS, { href: "/create", label: "Launch a token" }].map((l) => (
                <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 font-semibold text-royal-800 hover:bg-royal-50">
                  {l.label}
                </Link>
              ))}
              <div className="pt-2"><ConnectButton /></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
