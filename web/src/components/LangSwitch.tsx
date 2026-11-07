"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Globe } from "lucide-react";
import { LANGS, useT } from "@/lib/i18n";

export default function LangSwitch() {
  const { lang, setLang } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const cur = LANGS.find((l) => l.id === lang)!;
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 rounded-xl border border-royal-200 bg-white px-2.5 py-2 text-xs font-bold text-royal-700 hover:border-royal-400" aria-label="Language">
        <Globe className="h-4 w-4" /> {cur.short}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} className="card absolute right-0 top-11 z-50 w-40 overflow-hidden p-1">
            {LANGS.map((l) => (
              <button key={l.id} onClick={() => { setLang(l.id); setOpen(false); }} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold ${l.id === lang ? "bg-royal-50 text-royal-700" : "text-royal-900/70 hover:bg-royal-50"}`}>
                {l.label} {l.id === lang && <Check className="h-4 w-4" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
