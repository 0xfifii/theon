"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, type IChartApi, type ISeriesApi, type UTCTimestamp, ColorType, CrosshairMode } from "lightweight-charts";
import type { TokenView, TradeView } from "@/lib/types";
import { TOTAL_SUPPLY, WAD, marketCap } from "@/lib/curve";
import { toNum } from "@/lib/format";

const FRAMES = [
  { id: 60, label: "1m" },
  { id: 300, label: "5m" },
  { id: 900, label: "15m" },
  { id: 3600, label: "1h" },
];

function buildCandles(trades: TradeView[], token: TokenView, frame: number) {
  const asc = [...trades].sort((a, b) => a.time - b.time);
  const mcap = (p: bigint) => toNum((p * TOTAL_SUPPLY) / WAD);
  const startPrice = (token.virtualHype0 * WAD) / token.virtualToken0;
  const candles: { time: UTCTimestamp; open: number; high: number; low: number; close: number }[] = [];
  const vols: { time: UTCTimestamp; value: number; color: string }[] = [];
  let prev = mcap(startPrice);
  const first = Math.floor(token.launchTime / frame) * frame;
  if (!asc.length || asc[0].time > token.launchTime) candles.push({ time: first as UTCTimestamp, open: prev, high: prev, low: prev, close: prev });
  for (const tr of asc) {
    const b = Math.floor(tr.time / frame) * frame;
    const v = mcap(tr.price);
    let c = candles[candles.length - 1];
    if (!c || c.time !== b) {
      if (c && c.time > b) continue;
      c = { time: b as UTCTimestamp, open: prev, high: Math.max(prev, v), low: Math.min(prev, v), close: v };
      candles.push(c);
      vols.push({ time: b as UTCTimestamp, value: 0, color: "" });
    } else {
      c.high = Math.max(c.high, v);
      c.low = Math.min(c.low, v);
      c.close = v;
    }
    const vb = vols[vols.length - 1];
    if (vb && vb.time === b) {
      vb.value += toNum(tr.hype);
      vb.color = c.close >= c.open ? "rgba(47,91,234,.35)" : "rgba(244,63,94,.30)";
    }
    prev = v;
  }
  const last = candles[candles.length - 1];
  if (last) last.close = toNum(marketCap(token));
  return { candles, vols };
}

export default function PriceChart({ token, trades }: { token: TokenView; trades: TradeView[] }) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const vol = useRef<ISeriesApi<"Histogram"> | null>(null);
  const [frame, setFrame] = useState(60);
  const fitted = useRef(false);

  useEffect(() => {
    const c = createChart(el.current!, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "#FFFFFF" }, textColor: "#3D4E8A", fontFamily: "Inter Variable, sans-serif" },
      grid: { vertLines: { color: "#F1F4FF" }, horzLines: { color: "#F1F4FF" } },
      rightPriceScale: { borderColor: "#DCE6FF" },
      timeScale: { borderColor: "#DCE6FF", timeVisible: true, secondsVisible: false, barSpacing: 12, minBarSpacing: 3, rightOffset: 4 },
      crosshair: { mode: CrosshairMode.Normal },
    });
    series.current = c.addCandlestickSeries({
      upColor: "#1E45D6", borderUpColor: "#1E45D6", wickUpColor: "#1E45D6",
      downColor: "#F43F5E", borderDownColor: "#F43F5E", wickDownColor: "#F43F5E",
      priceFormat: { type: "custom", minMove: 0.0001, formatter: (v: number) => (v >= 1000 ? (v / 1000).toFixed(2) + "K" : v.toFixed(2)) },
    });
    vol.current = c.addHistogramSeries({ priceScaleId: "vol", priceFormat: { type: "volume" } });
    c.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    chart.current = c;
    return () => c.remove();
  }, []);

  const data = useMemo(() => buildCandles(trades, token, frame), [trades, token, frame]);

  useEffect(() => {
    if (!series.current) return;
    series.current.setData(data.candles);
    vol.current?.setData(data.vols);
    if (!fitted.current && data.candles.length) {
      // only stretch to fit when there is enough history; otherwise keep candles a normal width
      if (data.candles.length > 60) chart.current?.timeScale().fitContent();
      else chart.current?.timeScale().scrollToRealTime();
      fitted.current = true;
    }
  }, [data]);

  useEffect(() => { fitted.current = false; }, [frame]);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-royal-100 px-4 py-2.5">
        <div className="text-xs font-semibold uppercase tracking-wider text-royal-900/50">Market cap (HYPE)</div>
        <div className="flex gap-1 rounded-lg bg-royal-50 p-0.5">
          {FRAMES.map((f) => (
            <button key={f.id} onClick={() => setFrame(f.id)} className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${frame === f.id ? "bg-white text-royal-700 shadow-sm" : "text-royal-900/50 hover:text-royal-700"}`}>{f.label}</button>
          ))}
        </div>
      </div>
      <div ref={el} className="h-[360px] w-full" />
    </div>
  );
}
