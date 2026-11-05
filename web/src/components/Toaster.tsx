"use client";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, XCircle, X } from "lucide-react";
import { useToasts } from "@/lib/toast";

export default function Toaster() {
  const { toasts, remove } = useToasts();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60 }}
            className="card pointer-events-auto flex items-start gap-3 p-4"
          >
            {t.kind === "success" ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-royal-600" /> : t.kind === "error" ? <XCircle className="mt-0.5 h-5 w-5 text-red-500" /> : <Info className="mt-0.5 h-5 w-5 text-royal-500" />}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-royal-950">{t.title}</div>
              {t.body && <div className="mt-0.5 text-xs text-royal-900/60">{t.body}</div>}
              {t.link && <a href={t.link} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-royal-600 hover:underline">View on explorer ↗</a>}
            </div>
            <button onClick={() => remove(t.id)} className="text-royal-900/30 hover:text-royal-900/70"><X className="h-4 w-4" /></button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
