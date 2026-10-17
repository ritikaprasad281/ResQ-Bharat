import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Send,
  Siren,
  Check,
  Radio,
  Bot,
  User,
  Maximize2,
  Minimize2,
  Loader2,
  Wand2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import type { AlertDispatch, RiskLevel } from "../types";
import LanguageSelect from "./LanguageSelect";
import AssistantMarkdown from "./AssistantMarkdown";
import VoiceInput from "./VoiceInput";
import SpeakButton from "./SpeakButton";
import { loadVoices } from "../i18n/capabilities";
import { getLanguage } from "../i18n/languages";
import { useResponseLanguage, FOLLOW, AUTO } from "../hooks/useResponseLanguage";

interface Props {
  pilot: string;
  regionName: string;
  riskLevel?: RiskLevel;
  expanded: boolean;
  onToggleExpand: () => void;
}

type Msg = {
  id: number;
  who: "user" | "ai";
  text: string;
  lang?: string;
  kind?: "chat" | "briefing" | "alert";
  dispatch?: AlertDispatch["dispatch"];
};

const SUGGESTION_KEYS = [
  "summarize",
  "rainfallDouble",
  "highestExposure",
  "draftWarning",
] as const;

export default function Copilot({
  pilot,
  regionName,
  expanded,
  onToggleExpand,
}: Props) {
  const { t } = useTranslation();
  const rl = useResponseLanguage();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const inputModeRef = useRef<"text" | "voice">("text");
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const nextId = () => ++idRef.current;

  useEffect(() => {
    let alive = true;
    loadVoices().then((v) => alive && setVoices(v));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const specials = useMemo(
    () => [
      { value: FOLLOW, label: t("language.followWebsite") },
      { value: AUTO, label: t("language.autoDetect") },
    ],
    [t]
  );

  const respondingLabel = getLanguage(rl.resolved).nativeName;

  async function ask(text: string, mode: "text" | "voice" = "text") {
    const q = text.trim();
    if (!q || busy) return;
    const answerLang = rl.resolveForMessage(q);
    setQuestion("");
    inputModeRef.current = "text";
    setMessages((m) => [...m, { id: nextId(), who: "user", text: q }]);
    setBusy(true);
    try {
      const a = await api.chat(pilot, q, answerLang, {
        input_mode: mode,
        ui_language: getLanguage(rl.resolved).code,
        detected_language: rl.detected ?? undefined,
      });
      setOnline(true);
      setMessages((m) => [
        ...m,
        { id: nextId(), who: "ai", text: a, kind: "chat", lang: answerLang },
      ]);
    } catch {
      setOnline(false);
      setMessages((m) => [
        ...m,
        {
          id: nextId(),
          who: "ai",
          text: t("ai.unavailable"),
          kind: "chat",
          lang: answerLang,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function runBriefing() {
    if (busy) return;
    const answerLang = rl.resolved;
    setBusy(true);
    setMessages((m) => [
      ...m,
      { id: nextId(), who: "user", text: t("ai.briefing") },
    ]);
    try {
      const b = await api.briefing(pilot, answerLang);
      setOnline(true);
      setMessages((m) => [
        ...m,
        { id: nextId(), who: "ai", text: b, kind: "briefing", lang: answerLang },
      ]);
    } catch {
      setOnline(false);
      setMessages((m) => [
        ...m,
        {
          id: nextId(),
          who: "ai",
          text: t("ai.unavailable"),
          kind: "briefing",
          lang: answerLang,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function dispatchAlert() {
    if (busy) return;
    const answerLang = rl.resolved;
    setBusy(true);
    setMessages((m) => [
      ...m,
      { id: nextId(), who: "user", text: t("ai.citizenAlert") },
    ]);
    try {
      const res = await api.alert(pilot, answerLang);
      setOnline(true);
      setMessages((m) => [
        ...m,
        {
          id: nextId(),
          who: "ai",
          text: res.message,
          kind: "alert",
          lang: answerLang,
          dispatch: res.dispatch,
        },
      ]);
    } catch {
      setOnline(false);
      setMessages((m) => [
        ...m,
        {
          id: nextId(),
          who: "ai",
          text: t("ai.unavailable"),
          kind: "alert",
          lang: answerLang,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-white/5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="grid place-items-center h-7 w-7 rounded-lg bg-violet-500/15 border border-violet-500/25 shrink-0">
            <Sparkles className="h-3.5 w-3.5 text-violet-300" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight truncate">
              Gemini {t("ai.assistant")}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-500">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  online ? "bg-emerald-400" : "bg-amber-400"
                }`}
              />
              {online ? t("ai.online") : t("ai.offline")}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <LanguageSelect
            value={rl.pref}
            onChange={rl.setPref}
            voices={voices}
            specials={specials}
          />
          <button
            onClick={onToggleExpand}
            title={expanded ? t("actions.close") : t("actions.open")}
            className="grid place-items-center h-7 w-7 rounded-lg border border-white/10 bg-ink-900/60 hover:border-white/25 text-slate-300"
          >
            {expanded ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Response-language hint */}
      <div className="px-3 pt-2 text-[10px] text-slate-500">
        {t("ai.respondingIn", { language: respondingLabel })}
        {rl.pref === AUTO && rl.ambiguous && (
          <span className="ml-1 text-amber-400/80">
            · {t("language.voiceUnverified")}
          </span>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 px-3 pt-2">
        <button
          onClick={runBriefing}
          disabled={busy}
          className="flex-1 inline-flex items-center justify-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg bg-violet-600/80 hover:bg-violet-600 disabled:opacity-50 transition"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {t("ai.briefing")}
        </button>
        <button
          onClick={dispatchAlert}
          disabled={busy}
          className="flex-1 inline-flex items-center justify-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 disabled:opacity-50 transition"
        >
          <Siren className="h-3.5 w-3.5" />
          {t("ai.citizenAlert")}
        </button>
      </div>

      {/* Conversation */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3"
      >
        {messages.length === 0 && (
          <div className="text-center py-6">
            <Wand2 className="h-6 w-6 text-violet-400/70 mx-auto mb-2" />
            <p className="text-[12px] text-slate-400">
              {t("ai.placeholder")}{" "}
              <span className="text-slate-200 font-medium">{regionName}</span>.
            </p>
          </div>
        )}
        {messages.map((m) =>
          m.who === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-xl rounded-br-sm bg-sky-600/20 border border-sky-500/20 px-3 py-2 text-[12.5px] text-slate-100">
                <span className="inline-flex items-center gap-1 text-[10px] text-sky-300/80 mb-0.5">
                  <User className="h-3 w-3" /> {t("ai.you")}
                </span>
                <div>{m.text}</div>
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex justify-start">
              <div
                className={`max-w-[88%] rounded-xl rounded-bl-sm px-3 py-2 text-[12.5px] leading-relaxed border ${
                  m.kind === "alert"
                    ? "bg-rose-500/[0.07] border-rose-500/25 text-slate-100"
                    : "bg-ink-900/70 border-white/5 text-slate-200"
                }`}
              >
                <span className="inline-flex items-center gap-1 text-[10px] text-violet-300/80 mb-0.5">
                  <Bot className="h-3 w-3" />
                  {m.kind === "briefing"
                    ? t("ai.briefing")
                    : m.kind === "alert"
                    ? t("ai.citizenAlert")
                    : "Gemini"}
                </span>
                {m.kind === "alert" && m.dispatch && (
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1">
                    <Radio className="h-3 w-3" />
                    {m.dispatch.published ? (
                      <span className="inline-flex items-center gap-1">
                        <Check className="h-3 w-3 text-emerald-400" /> published
                        to Pub/Sub
                      </span>
                    ) : (
                      <>queued ({m.dispatch.channel ?? "simulated"})</>
                    )}
                  </div>
                )}
                <AssistantMarkdown text={m.text} />
                <div className="mt-1 flex justify-end">
                  <SpeakButton
                    id={`copilot-${m.id}`}
                    text={m.text}
                    lang={m.lang ?? rl.resolved}
                  />
                </div>
              </div>
            </div>
          )
        )}
        {busy && (
          <div className="flex items-center gap-2 text-[12px] text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
            {t("ai.thinking")}
          </div>
        )}
      </div>

      {/* Suggested prompts */}
      <div className="px-3 pb-2 flex flex-wrap gap-1.5">
        {SUGGESTION_KEYS.map((k) => {
          const label = t(`ai.prompts.${k}`);
          return (
            <button
              key={k}
              onClick={() => ask(label)}
              disabled={busy}
              className="text-[10.5px] rounded-full border border-white/10 bg-ink-900/60 hover:border-violet-500/40 text-slate-400 px-2 py-1 disabled:opacity-50 transition"
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Composer */}
      <div className="px-3 pb-3 flex items-center gap-2">
        <VoiceInput
          lang={rl.resolved}
          onTranscript={(txt) => {
            inputModeRef.current = "voice";
            setQuestion(txt);
          }}
          disabled={busy}
        />
        <input
          value={question}
          onChange={(e) => {
            inputModeRef.current = "text";
            setQuestion(e.target.value);
          }}
          onKeyDown={(e) =>
            e.key === "Enter" && ask(question, inputModeRef.current)
          }
          placeholder={t("ai.placeholder")}
          className="flex-1 text-[12.5px] bg-ink-900/70 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-violet-500"
        />
        <button
          onClick={() => ask(question, inputModeRef.current)}
          disabled={busy || !question.trim()}
          className="grid place-items-center h-9 w-9 rounded-lg bg-violet-600/80 hover:bg-violet-600 disabled:opacity-40"
          aria-label={t("actions.send")}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      <motion.p className="px-3 pb-2 text-[10px] text-slate-600 leading-relaxed">
        {t("ai.contextNote")}
      </motion.p>
    </div>
  );
}
