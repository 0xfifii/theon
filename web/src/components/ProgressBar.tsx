"use client";
import { motion } from "framer-motion";

export default function ProgressBar({ value, ascended = false, height = 8 }: { value: number; ascended?: boolean; height?: number }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative w-full overflow-hidden rounded-full bg-royal-50 ring-1 ring-inset ring-royal-100" style={{ height }}>
      <motion.div
        className={`relative h-full rounded-full ${ascended ? "bg-gradient-to-r from-royal-700 via-royal-500 to-royal-300" : "bg-gradient-to-r from-royal-600 to-royal-400"}`}
        initial={false}
        animate={{ width: `${Math.max(v * 100, v > 0 ? 2 : 0)}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
      >
        <div className="shine absolute inset-0 rounded-full" />
      </motion.div>
    </div>
  );
}
