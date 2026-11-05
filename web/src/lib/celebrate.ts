"use client";
import confetti from "canvas-confetti";

const ROYAL = ["#1E45D6", "#2F5BEA", "#8AA8FF", "#FFFFFF", "#0F1F5C"];

export function burst(x = 0.5, y = 0.6) {
  confetti({ particleCount: 70, spread: 70, startVelocity: 38, origin: { x, y }, colors: ROYAL, scalar: 0.9 });
}

export function ascend() {
  const end = Date.now() + 1400;
  (function frame() {
    confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: ROYAL });
    confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: ROYAL });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
