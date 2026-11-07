"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { DICT } from "./locales";

export type Lang = "en" | "zh" | "ja" | "ko";
export const LANGS: { id: Lang; label: string; short: string }[] = [
  { id: "en", label: "English", short: "EN" },
  { id: "zh", label: "简体中文", short: "中文" },
  { id: "ja", label: "日本語", short: "日本語" },
  { id: "ko", label: "한국어", short: "한국어" },
];
const KEY = "elytheon-lang";
const IDX: Record<Exclude<Lang, "en">, number> = { zh: 0, ja: 1, ko: 2 };

let current: Lang = "en";

/** Translate an English UI string. Use {name} placeholders for values. */
export function tr(text: string, vars?: Record<string, string | number>): string {
  let out = text;
  if (current !== "en") {
    const row = DICT[text];
    if (row) out = row[IDX[current]] || text;
    else if (process.env.NODE_ENV !== "production") console.warn("[i18n] missing:", text);
  }
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY) as Lang | null;
    if (saved && LANGS.some((l) => l.id === saved)) return saved;
  } catch {}
  const nav = (typeof navigator !== "undefined" ? navigator.language : "en").toLowerCase();
  if (nav.startsWith("zh")) return "zh";
  if (nav.startsWith("ja")) return "ja";
  if (nav.startsWith("ko")) return "ko";
  return "en";
}

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "en", setLang: () => {} });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setState] = useState<Lang>("en");
  const apply = useCallback((l: Lang) => {
    current = l;
    setState(l);
    document.documentElement.lang = l === "zh" ? "zh-CN" : l;
  }, []);
  useEffect(() => apply(detect()), [apply]);
  const setLang = useCallback(
    (l: Lang) => {
      try { localStorage.setItem(KEY, l); } catch {}
      apply(l);
    },
    [apply]
  );
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

/** Re-renders the component when the language changes. */
export function useT() {
  const { lang, setLang } = useContext(Ctx);
  current = lang;
  const t = useCallback((text: string, vars?: Record<string, string | number>) => tr(text, vars), [lang]); // eslint-disable-line react-hooks/exhaustive-deps
  return { t, lang, setLang };
}
