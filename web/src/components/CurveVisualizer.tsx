"use client";
import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { CURVE_SUPPLY, curvePoints, type CurveState } from "@/lib/curve";
import { compact } from "@/lib/format";

/** Interactive bonding-curve chart: hover to see the market cap at any point; shows where the token is now and where a pending buy would land. */
export default function CurveVisualizer({ curve, previewSold, title = "Bonding curve" }: { curve: CurveState; previewSold?: bigint; title?: string }) {
  const pts = useMemo(() => curvePoints(curve, 80), [curve]);
  const [hover, setHover] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const W = 560, H = 200, P = 8;
  const maxM = pts[pts.length - 1].mcap;
  const x = (f: number) => P + f * (W - 2 * P);
  const y = (m: number) => H - P - (m / maxM) * (H - 2 * P - 10);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(p.sold)},${y(p.mcap)}`).join(" ");
  const area = `${path} L${x(1)},${H - P} L${x(0)},${H - P} Z`;
  const cur = Math.min(1, Number((curve.tokensSold * 10000n) / CURVE_SUPPLY) / 10000);
  const prev = previewSold !== undefined ? Math.min(1, Number((previewSold * 10000n) / CURVE_SUPPLY) / 10000) : null;
  const at = (f: number) => pts[Math.round(f * (pts.length - 1))];
  const filled = pts.filter((p) => p.sold <= cur);
  const filledPath = filled.length > 1 ? `${filled.map((p, i) => `${i ? "L" : "M"}${x(p.sold)},${y(p.mcap)}`).join(" ")} L${x(cur)},${H - P} L${x(0)},${H - P} Z` : "";
  const show = hover ?? prev ?? cur;

  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-royal-900/50">{title}</div>
        <div className="text-xs text-royal-900/60">
          at <b className="text-royal-800">{(show * 100).toFixed(1)}%</b> sold → mcap <b className="text-royal-800">{compact(at(show).mcap, 1)} HYPE</b>
        </div>
      </div>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full cursor-crosshair"
        onMouseMove={(e) => {
          const r = svg.current!.getBoundingClientRect();
          setHover(Math.max(0, Math.min(1, ((e.clientX - r.left) / r.width * W - P) / (W - 2 * P))));
        }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="cv-a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2F5BEA" stopOpacity=".12" /><stop offset="1" stopColor="#2F5BEA" stopOpacity="0" /></linearGradient>
          <linearGradient id="cv-f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1E45D6" stopOpacity=".45" /><stop offset="1" stopColor="#1E45D6" stopOpacity=".05" /></linearGradient>
        </defs>
        <path d={area} fill="url(#cv-a)" />
        {filledPath && <motion.path d={filledPath} fill="url(#cv-f)" initial={false} animate={{ d: filledPath }} />}
        <path d={path} fill="none" stroke="#1E45D6" strokeWidth="2.5" strokeLinecap="round" />
        {prev !== null && prev > cur && (
          <g>
            <rect x={x(cur)} y={P} width={Math.max(1, x(prev) - x(cur))} height={H - 2 * P} fill="#8AA8FF" opacity=".18" />
            <circle cx={x(prev)} cy={y(at(prev).mcap)} r="5" fill="white" stroke="#5A7FF5" strokeWidth="2.5" strokeDasharray="3 2" />
          </g>
        )}
        <motion.circle initial={false} animate={{ cx: x(cur), cy: y(at(cur).mcap) }} r="7" fill="#1E45D6" stroke="white" strokeWidth="3" />
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={P} y2={H - P} stroke="#1E45D6" strokeOpacity=".3" strokeDasharray="4 3" />
            <circle cx={x(hover)} cy={y(at(hover).mcap)} r="4" fill="#1E45D6" />
          </g>
        )}
        <text x={W - P} y={H - 14} textAnchor="end" fontSize="11" fill="#1E45D6" fontWeight="700">ASCENSION ✦</text>
      </svg>
    </div>
  );
}
