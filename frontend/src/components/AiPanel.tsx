import { useState } from "react";
import { motion } from "framer-motion";
import { Bot, Send, Sparkles } from "lucide-react";
import { api } from "../api";

interface Props {
  pilot: string;
}

export default function AiPanel({ pilot }: Props) {
  const [briefing, setBriefing] = useState<string>("");
  const [loadingBrief, setLoadingBrief] = useState(false);
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState<{ q: string; a: string }[]>([]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");

  async function runBriefing() {
    setLoadingBrief(true);
    setError("");
    try {
      setBriefing(await api.briefing(pilot));
    } catch {
      setError("AI unavailable — is the Gemini key set on the backend?");
    } finally {
      setLoadingBrief(false);
    }
  }

  async function ask() {
    if (!question.trim()) return;
    const q = question;
    setQuestion("");
    setThinking(true);
    try {
      const a = await api.chat(pilot, q);
      setChat((c) => [...c, { q, a }]);
    } catch {
      setChat((c) => [...c, { q, a: "AI unavailable right now." }]);
    } finally {
      setThinking(false);
    }
  }

  return (
    <div className="rounded-xl bg-ink-800/60 border border-white/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-semibold">Gemini briefing</span>
        </div>
        <button
          onClick={runBriefing}
          disabled={loadingBrief}
          className="text-[11px] px-2.5 py-1 rounded-lg bg-violet-600/80 hover:bg-violet-600 disabled:opacity-50"
        >
          {loadingBrief ? "Generating…" : "Generate"}
        </button>
      </div>

      {error && <p className="text-[11px] text-amber-400 mb-2">{error}</p>}

      {briefing && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[13px] leading-relaxed text-slate-200 bg-ink-900/60 rounded-lg p-3 mb-3"
        >
          {briefing}
        </motion.p>
      )}

      <div className="space-y-2 mb-2 max-h-48 overflow-y-auto">
        {chat.map((c, i) => (
          <div key={i} className="text-[12px]">
            <p className="text-slate-400">You: {c.q}</p>
            <p className="text-slate-100 flex gap-1.5">
              <Bot className="h-3.5 w-3.5 text-violet-400 shrink-0 mt-0.5" />
              {c.a}
            </p>
          </div>
        ))}
        {thinking && <p className="text-[12px] text-slate-500">Thinking…</p>}
      </div>

      <div className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="Ask: what if rainfall doubles?"
          className="flex-1 text-[12px] bg-ink-900/70 border border-white/5 rounded-lg px-3 py-2 outline-none focus:border-violet-500"
        />
        <button
          onClick={ask}
          className="grid place-items-center h-8 w-8 rounded-lg bg-violet-600/80 hover:bg-violet-600"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
