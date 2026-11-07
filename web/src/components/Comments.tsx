"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, MessageCircle, Send } from "lucide-react";
import type { TokenView } from "@/lib/types";
import { useLaunchpad } from "@/lib/launchpad";
import { short, timeAgo } from "@/lib/format";
import { errMsg, toast } from "@/lib/toast";

function hue(addr: string) {
  return parseInt(addr.slice(2, 8), 16) % 360;
}

export default function Comments({ token }: { token: TokenView }) {
  const { comments, postComment, account, now, mode } = useLaunchpad();
  const { t } = useT();
  const list = comments[token.address] ?? [];
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function post() {
    if (!account) return toast({ kind: "info", title: t("Connect your wallet to comment") });
    const msg = text.trim();
    if (!msg) return;
    setBusy(true);
    try {
      await postComment(token.address, msg);
      setText("");
      toast({ kind: "success", title: t("Comment posted"), body: mode === "live" ? t("Stored on-chain forever.") : undefined });
    } catch (e) {
      toast({ kind: "error", title: t("Could not post"), body: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <MessageCircle className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-royal-900/30" />
          <textarea
            value={text}
            maxLength={280}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); post(); } }}
            placeholder={t("Say something about {s}…", { s: "$" + token.symbol })}
            className="input min-h-[46px] resize-none pl-9"
            rows={1}
          />
          <span className="absolute bottom-2 right-3 text-[10px] text-royal-900/30">{text.length}/280</span>
        </div>
        <button onClick={post} disabled={busy || !text.trim()} className="btn-primary h-[46px] px-4">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
      {mode === "live" && <p className="-mt-2 text-[11px] text-royal-900/40">{t("Comments live on-chain (a tiny HYPE gas fee per post — it keeps spam away).")}</p>}
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {list.map((c) => (
            <motion.div key={c.id} layout initial={{ opacity: 0, y: -8, backgroundColor: "rgba(47,91,234,.10)" }} animate={{ opacity: 1, y: 0, backgroundColor: "rgba(255,255,255,0)" }} transition={{ duration: 0.6 }} className="flex gap-3 rounded-xl border border-royal-50 p-3">
              <div className="h-8 w-8 shrink-0 rounded-full" style={{ background: `linear-gradient(135deg, hsl(${hue(c.author)},70%,55%), hsl(${(hue(c.author) + 40) % 360},70%,45%))` }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono font-semibold text-royal-800">{short(c.author)}</span>
                  {c.author.toLowerCase() === token.creator.toLowerCase() && <span className="chip bg-royal-600 py-0.5 text-[10px] text-white">{t("creator")}</span>}
                  {account && c.author.toLowerCase() === account.toLowerCase() && <span className="chip bg-royal-50 py-0.5 text-[10px] text-royal-600">{t("you")}</span>}
                  <span className="text-royal-900/40">{timeAgo(c.time, now)}</span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-royal-950">{c.text}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {!list.length && <div className="py-6 text-center text-sm text-royal-900/45">{t("No comments yet. Start the conversation.")}</div>}
      </div>
    </div>
  );
}
