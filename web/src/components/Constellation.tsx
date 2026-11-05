"use client";
import { useEffect, useRef } from "react";

/** Animated star field that connects nearby stars and reacts to the mouse. */
export default function Constellation({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    let w = 0, h = 0, raf = 0;
    const mouse = { x: -999, y: -999 };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.00025, vy: (Math.random() - 0.5) * 0.00025, r: Math.random() * 1.6 + 0.4 }));
    const resize = () => {
      const r = c.getBoundingClientRect();
      w = r.width; h = r.height;
      c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const move = (e: MouseEvent) => {
      const r = c.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    };
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        s.x += s.vx; s.y += s.vy;
        if (s.x < 0 || s.x > 1) s.vx *= -1;
        if (s.y < 0 || s.y > 1) s.vy *= -1;
      }
      for (let i = 0; i < stars.length; i++) {
        const a = stars[i];
        const ax = a.x * w, ay = a.y * h;
        for (let j = i + 1; j < stars.length; j++) {
          const b = stars[j];
          const d = Math.hypot(ax - b.x * w, ay - b.y * h);
          if (d < 110) {
            ctx.strokeStyle = `rgba(255,255,255,${0.16 * (1 - d / 110)})`;
            ctx.lineWidth = 0.7;
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(b.x * w, b.y * h); ctx.stroke();
          }
        }
        const md = Math.hypot(ax - mouse.x, ay - mouse.y);
        if (md < 160) {
          ctx.strokeStyle = `rgba(185,204,255,${0.5 * (1 - md / 160)})`;
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
        ctx.fillStyle = `rgba(255,255,255,${md < 160 ? 1 : 0.75})`;
        ctx.beginPath(); ctx.arc(ax, ay, md < 160 ? a.r + 0.8 : a.r, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    resize(); draw();
    window.addEventListener("resize", resize);
    c.parentElement?.addEventListener("mousemove", move);
    c.parentElement?.addEventListener("mouseleave", () => { mouse.x = -999; mouse.y = -999; });
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); c.parentElement?.removeEventListener("mousemove", move); };
  }, []);
  return <canvas ref={ref} className={`absolute inset-0 h-full w-full ${className}`} />;
}
