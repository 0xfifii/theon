import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        royal: {
          50: "#EEF3FF",
          100: "#DCE6FF",
          200: "#B9CCFF",
          300: "#8AA8FF",
          400: "#5A7FF5",
          500: "#2F5BEA",
          600: "#1E45D6", // primary royal blue
          700: "#1A37B0",
          800: "#162E8C",
          900: "#0F1F5C",
          950: "#0A1440",
        },
      },
      fontFamily: {
        display: ["Cinzel", "'Noto Serif SC'", "'Noto Serif JP'", "'Noto Serif KR'", "'Songti SC'", "'Hiragino Mincho ProN'", "'Yu Mincho'", "'Nanum Myeongjo'", "serif"],
        sans: ["'Inter Variable'", "'PingFang SC'", "'Hiragino Sans'", "'Hiragino Kaku Gothic ProN'", "'Apple SD Gothic Neo'", "'Microsoft YaHei'", "'Yu Gothic UI'", "'Malgun Gothic'", "'Noto Sans CJK SC'", "'Noto Sans SC'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(30,69,214,.08), 0 10px 40px -10px rgba(30,69,214,.35)",
        card: "0 1px 2px rgba(15,31,92,.06), 0 8px 24px -12px rgba(15,31,92,.18)",
      },
      keyframes: {
        marquee: { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
        flash: { "0%": { backgroundColor: "rgba(47,91,234,.18)" }, "100%": { backgroundColor: "transparent" } },
      },
      animation: {
        marquee: "marquee 40s linear infinite",
        shimmer: "shimmer 2.5s linear infinite",
        float: "float 4s ease-in-out infinite",
        flash: "flash 1.2s ease-out",
      },
    },
  },
  plugins: [],
} satisfies Config;
