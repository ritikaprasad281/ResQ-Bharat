import { useEffect, useMemo, useRef, useState } from "react";
import {
  LifeBuoy,
  MapPin,
  Navigation,
  Hospital,
  Home,
  Mountain,
  Route,
  Phone,
  HeartPulse,
  Send,
  Loader2,
  Bot,
  User,
  Copy,
  Check,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  ExternalLink,
  Info,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import LanguageSelect from "../components/LanguageSelect";
import AssistantMarkdown from "../components/AssistantMarkdown";
import VoiceInput from "../components/VoiceInput";
import SpeakButton from "../components/SpeakButton";
import { loadVoices } from "../i18n/capabilities";
import { getLanguage } from "../i18n/languages";
import {
  useResponseLanguage,
  FOLLOW,
  AUTO,
} from "../hooks/useResponseLanguage";
import {
  EMERGENCY_CONTACTS,
  OFFICIAL_SOURCES,
  mapsSearchUrl,
  type Coords,
} from "../emergency";

type Msg = {
  id: number;
  who: "user" | "ai";
  text: string;
  lang?: string;
  error?: boolean;
};

const SUGGESTIONS = [
  "Water is entering my house — what should I do right now?",
  "How do I help an elderly person evacuate safely?",
  "What should I carry when leaving my home?",
  "How can I find safe drinking water after a flood?",
];

export default function AiHelpPage() {
  const { t } = useTranslation();
  const rl = useResponseLanguage();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [locationText, setLocationText] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showContacts, setShowContacts] = useState(false);
  const inputModeRef = useRef<"text" | "voice">("text");
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contactsRef = useRef<HTMLDivElement>(null);
  const lastQuestionRef = useRef<string>("");

  const nextId = () => ++idRef.current;

  const specials = useMemo(
    () => [
      { value: FOLLOW, label: t("language.followWebsite") },
      { value: AUTO, label: t("language.autoDetect") },
    ],
    [t]
  );

  const locationForApi = coords
    ? `${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)} (shared GPS)`
    : locationText.trim() || undefined;
  const hasLocation = Boolean(coords || locationText.trim());

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

  function shareLocation() {
    if (!("geolocation" in navigator)) {
      setLocError("Location is not supported on this device.");
      return;
    }
    setLocating(true);
    setLocError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setLocError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — you can type your area instead."
            : "Could not get your location — type your area instead."
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function clearLocation() {
    setCoords(null);
    setLocationText("");
    setLocError("");
  }

  async function ask(text: string, mode: "text" | "voice" = "text") {
    const q = text.trim();
    if (!q || busy) return;
    const answerLang = rl.resolveForMessage(q);
    lastQuestionRef.current = q;
    setQuestion("");
    inputModeRef.current = "text";
    setMessages((m) => [...m, { id: nextId(), who: "user", text: q }]);
    setBusy(true);
    try {
      const a = await api.assist(q, answerLang, locationForApi, {
        input_mode: mode,
        ui_language: getLanguage(rl.resolved).code,
        detected_language: rl.detected ?? undefined,
      });
      setMessages((m) => [
        ...m,
        { id: nextId(), who: "ai", text: a, lang: answerLang },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: nextId(),
          who: "ai",
          text: t("aiHelp.disclaimer"),
          error: true,
          lang: answerLang,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function retry() {
    if (lastQuestionRef.current) ask(lastQuestionRef.current);
  }

  async function copy(m: Msg) {
    try {
      await navigator.clipboard.writeText(m.text);
      setCopiedId(m.id);
      setTimeout(() => setCopiedId((c) => (c === m.id ? null : c)), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  function openMaps(query: string) {
    if (!hasLocation) {
      setLocError("Add your area or share your location first.");
      return;
    }
    const url = mapsSearchUrl(query, coords ?? locationText.trim());
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const QUICK: {
    icon: typeof Hospital;
    label: string;
    tint: string;
    run: () => void;
  }[] = [
    {
      icon: Hospital,
      label: t("aiHelp.quick.hospitals"),
      tint: "text-rose-300",
      run: () => {
        openMaps("hospitals and emergency medical");
        ask("Where is the nearest hospital or emergency medical help, and how do I reach it safely during a flood?");
      },
    },
    {
      icon: Home,
      label: t("aiHelp.quick.shelters"),
      tint: "text-sky-300",
      run: () => {
        openMaps("flood relief shelter cyclone shelter community hall");
        ask("Which flood shelters or relief centres might be available, and how do I confirm one is open?");
      },
    },
    {
      icon: Mountain,
      label: t("aiHelp.quick.higherGround"),
      tint: "text-emerald-300",
      run: () =>
        ask("Where can I find a safer, accessible high-ground location to evacuate to, and what should I check before going there?"),
    },
    {
      icon: Route,
      label: t("aiHelp.quick.roads"),
      tint: "text-amber-300",
      run: () =>
        ask("Which roads or routes could be flooded in my area and how do I travel safely? Where can I check official road and flood updates?"),
    },
    {
      icon: Phone,
      label: t("aiHelp.quick.contacts"),
      tint: "text-orange-300",
      run: () => {
        setShowContacts(true);
        setTimeout(
          () =>
            contactsRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            }),
          50
        );
      },
    },
    {
      icon: HeartPulse,
      label: t("aiHelp.quick.firstAid"),
      tint: "text-pink-300",
      run: () =>
        ask("Give me immediate first-aid and personal safety steps during a flood emergency."),
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        {/* Header */}
        <header>
          <div className="flex items-center gap-2">
            <span className="grid place-items-center h-9 w-9 rounded-xl bg-violet-500/15 border border-violet-500/25">
              <LifeBuoy className="h-5 w-5 text-violet-300" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">
                {t("aiHelp.title")}
              </h1>
              <p className="text-[13px] text-slate-400">
                {t("aiHelp.subtitle")}
              </p>
            </div>
          </div>
        </header>

        {/* Emergency disclaimer banner */}
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-start gap-2.5 flex-1">
            <ShieldAlert className="h-5 w-5 text-rose-300 shrink-0 mt-0.5" />
            <p className="text-[13px] text-rose-100/90 leading-relaxed">
              {t("aiHelp.disclaimer")}
            </p>
          </div>
          <a
            href="tel:112"
            className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-2.5 text-sm font-bold text-white transition"
          >
            <Phone className="h-4 w-4" /> 112
          </a>
        </div>

        {/* Controls: language + location */}
        <div className="glass rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-slate-500">
                {t("language.responseLanguage")}
              </span>
              <LanguageSelect
                value={rl.pref}
                onChange={rl.setPref}
                voices={voices}
                specials={specials}
                size="md"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={shareLocation}
                disabled={locating}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-ink-900/60 hover:border-white/25 px-3 py-1.5 text-[12px] text-slate-200 disabled:opacity-60"
              >
                {locating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Navigation className="h-3.5 w-3.5 text-cyan-300" />
                )}
                {t("aiHelp.useMyLocation")}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-ink-800/70 border border-white/10 px-3 py-2.5 focus-within:border-sky-500/60">
            <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              value={coords ? `GPS: ${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}` : locationText}
              onChange={(e) => {
                setLocationText(e.target.value);
                if (coords) setCoords(null);
              }}
              placeholder={t("aiHelp.locationPlaceholder")}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500"
              readOnly={!!coords}
            />
            {hasLocation && (
              <button
                onClick={clearLocation}
                title={t("actions.clear")}
                className="text-slate-500 hover:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {locError ? (
            <p className="text-[11px] text-amber-300 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {locError}
            </p>
          ) : (
            <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0 mt-px" />
              Location is only used when you choose to share it, to tailor
              guidance and open map searches. It is not stored or tracked.
            </p>
          )}
        </div>

        {/* Quick actions */}
        <section>
          <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">
            {t("aiHelp.quickActions", { defaultValue: "Quick actions" })}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {QUICK.map((a) => (
              <button
                key={a.label}
                onClick={a.run}
                disabled={busy}
                className="text-left rounded-xl bg-ink-900/50 border border-white/5 hover:border-violet-500/40 p-3 transition disabled:opacity-60 group"
              >
                <a.icon className={`h-5 w-5 ${a.tint}`} />
                <p className="mt-2 text-[13px] font-semibold leading-tight">
                  {a.label}
                </p>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Map searches open your map app for the area you provide. The
            assistant does not confirm live availability of any facility.
          </p>
        </section>

        {/* Chat workspace */}
        <section className="glass rounded-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <span className="grid place-items-center h-7 w-7 rounded-lg bg-violet-500/15 border border-violet-500/25">
                <Bot className="h-3.5 w-3.5 text-violet-300" />
              </span>
              <span className="text-sm font-semibold">
                {t("aiHelp.askForHelp", { defaultValue: "Ask for help" })}
              </span>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200"
              >
                <Trash2 className="h-3.5 w-3.5" />{" "}
                {t("aiHelp.newChat", { defaultValue: "New chat" })}
              </button>
            )}
          </div>

          <div
            ref={scrollRef}
            className="min-h-[220px] max-h-[48vh] overflow-y-auto px-4 py-4 space-y-3"
          >
            {messages.length === 0 && (
              <div className="text-center py-8">
                <LifeBuoy className="h-7 w-7 text-violet-400/70 mx-auto mb-2" />
                <p className="text-[13px] text-slate-400 max-w-sm mx-auto leading-relaxed">
                  {t("aiHelp.emptyHint", {
                    defaultValue:
                      "Ask urgent, practical questions about evacuation, shelter, safety, first aid, or reaching emergency services.",
                  })}
                </p>
              </div>
            )}
            {messages.map((m) =>
              m.who === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-xl rounded-br-sm bg-sky-600/20 border border-sky-500/20 px-3 py-2 text-[13px] text-slate-100">
                    <span className="inline-flex items-center gap-1 text-[10px] text-sky-300/80 mb-0.5">
                      <User className="h-3 w-3" /> {t("ai.you")}
                    </span>
                    <div className="whitespace-pre-wrap">{m.text}</div>
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex justify-start">
                  <div
                    className={`max-w-[88%] rounded-xl rounded-bl-sm px-3 py-2 text-[13px] leading-relaxed border ${
                      m.error
                        ? "bg-rose-500/[0.07] border-rose-500/25 text-rose-100"
                        : "bg-ink-900/70 border-white/5 text-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="inline-flex items-center gap-1 text-[10px] text-violet-300/80">
                        <Bot className="h-3 w-3" /> {t("ai.assistant")}
                      </span>
                      {!m.error && (
                        <button
                          onClick={() => copy(m)}
                          title={t("actions.copy")}
                          className="text-slate-500 hover:text-slate-300"
                        >
                          {copiedId === m.id ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      )}
                    </div>
                    <AssistantMarkdown text={m.text} />
                    <div className="mt-1 flex items-center justify-between gap-2">
                      {m.error ? (
                        <button
                          onClick={retry}
                          className="text-[11px] font-medium text-rose-200 underline underline-offset-2"
                        >
                          {t("actions.retry")}
                        </button>
                      ) : (
                        <span />
                      )}
                      {!m.error && (
                        <SpeakButton
                          id={`aihelp-${m.id}`}
                          text={m.text}
                          lang={m.lang ?? rl.resolved}
                        />
                      )}
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
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                disabled={busy}
                className="text-[11px] rounded-full border border-white/10 bg-ink-900/60 hover:border-violet-500/40 text-slate-400 px-2.5 py-1 disabled:opacity-50 transition"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Composer */}
          <div className="px-4 pb-4 flex items-center gap-2">
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
              className="flex-1 text-[13px] bg-ink-900/70 border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-violet-500"
            />
            <button
              onClick={() => ask(question, inputModeRef.current)}
              disabled={busy || !question.trim()}
              className="grid place-items-center h-10 w-10 rounded-lg bg-violet-600/80 hover:bg-violet-600 disabled:opacity-40"
              aria-label={t("actions.send")}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </section>

        {/* Emergency contacts */}
        <section ref={contactsRef} className="scroll-mt-20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-rose-400" />
              <h2 className="text-sm font-bold">Emergency contacts (India)</h2>
            </div>
            <button
              onClick={() => setShowContacts((v) => !v)}
              className="text-[11px] text-slate-400 hover:text-slate-200"
            >
              {showContacts ? "Hide" : "Show"}
            </button>
          </div>
          {showContacts && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {EMERGENCY_CONTACTS.map((c) => (
                  <a
                    key={c.number}
                    href={`tel:${c.number}`}
                    className={`glass rounded-2xl p-3 block transition border ${
                      c.primary
                        ? "border-rose-500/30 hover:border-rose-500/60"
                        : "border-white/5 hover:border-cyan-500/40"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Phone
                        className={`h-4 w-4 ${
                          c.primary ? "text-rose-300" : "text-cyan-300"
                        }`}
                      />
                      <span className="text-lg font-extrabold">{c.number}</span>
                    </div>
                    <p className="mt-1 text-[12px] font-semibold leading-tight">
                      {c.label}
                    </p>
                    <p className="text-[10px] text-slate-500 leading-snug mt-0.5">
                      {c.note}
                    </p>
                  </a>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                These are national helplines. Local control-room numbers differ
                by district — confirm your local number where possible.
              </p>

              <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                {OFFICIAL_SOURCES.map((s) => (
                  <a
                    key={s.url}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="glass rounded-2xl p-3 border border-white/5 hover:border-cyan-500/40 transition block"
                  >
                    <ExternalLink className="h-4 w-4 text-cyan-300" />
                    <p className="mt-1.5 text-[13px] font-semibold">{s.label}</p>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      {s.detail}
                    </p>
                  </a>
                ))}
              </div>
            </>
          )}
        </section>

        <p className="text-[11px] text-slate-600 leading-relaxed">
          AI-generated guidance for preparedness and personal safety — it does
          not replace instructions from local authorities and cannot confirm
          live shelter, hospital or road conditions. Validate before acting.
        </p>
      </div>
    </div>
  );
}
