/**
 * VoiceInput — a microphone control for the chat composers. It records only
 * after an explicit tap, shows every interaction state clearly, streams the
 * recognized transcript into the parent's text input for review/editing, and
 * degrades to a disabled, explained state when the browser has no speech
 * recognition. It never auto-starts and always releases the mic on stop/cancel.
 */

import { useEffect } from "react";
import { Mic, Square, X, RotateCcw, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useSpeechRecognition,
  type RecognitionError,
} from "../hooks/useSpeechRecognition";
import { getLanguage, type LangCode } from "../i18n/languages";

interface Props {
  /** Recognition locale to use (the resolved spoken/answer language). */
  lang: LangCode;
  /** Streams interim + final transcript text to the parent input. */
  onTranscript: (text: string) => void;
  /** Fired once per completed utterance, with any confidence metadata. */
  onFinal?: (text: string) => void;
  /** Notifies parent when recording starts/stops so it can lock other UI. */
  onListeningChange?: (listening: boolean) => void;
  disabled?: boolean;
}

function errorKey(err: RecognitionError): string {
  switch (err) {
    case "permission-denied":
      return "voice.permissionDenied";
    case "language-unavailable":
      return "voice.unsupportedLanguage";
    case "network":
      return "voice.networkError";
    case "not-supported":
      return "voice.notSupported";
    default:
      return "voice.networkError";
  }
}

export default function VoiceInput({
  lang,
  onTranscript,
  onFinal,
  onListeningChange,
  disabled,
}: Props) {
  const { t } = useTranslation();
  const rec = useSpeechRecognition();
  const def = getLanguage(lang);

  // Stream interim text live; commit final text and notify parent.
  useEffect(() => {
    if (rec.interim) onTranscript(rec.interim);
  }, [rec.interim, onTranscript]);

  useEffect(() => {
    if (rec.finalText) {
      onTranscript(rec.finalText);
      onFinal?.(rec.finalText);
    }
  }, [rec.finalText, onTranscript, onFinal]);

  const listening =
    rec.status === "listening" || rec.status === "requesting";
  useEffect(() => {
    onListeningChange?.(listening);
  }, [listening, onListeningChange]);

  if (!rec.supported) {
    return (
      <button
        type="button"
        disabled
        title={t("voice.notSupported")}
        aria-label={t("voice.notSupported")}
        className="grid h-9 w-9 place-items-center rounded-lg bg-ink-800/60 text-slate-600 cursor-not-allowed"
      >
        <Mic className="h-4 w-4" />
      </button>
    );
  }

  const idle = rec.status === "idle" && !rec.error;

  if (idle) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => rec.start(lang)}
        title={`${t("voice.startRecording")} · ${def.nativeName}`}
        aria-label={t("voice.micLabel")}
        className="grid h-9 w-9 place-items-center rounded-lg bg-ink-800/70 text-slate-200 hover:bg-violet-600 hover:text-white transition disabled:opacity-50"
      >
        <Mic className="h-4 w-4" />
      </button>
    );
  }

  if (rec.error) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => rec.start(lang)}
          title={t("voice.retry")}
          aria-label={t("voice.retry")}
          className="grid h-9 w-9 place-items-center rounded-lg bg-ink-800/70 text-amber-300 hover:bg-ink-700 transition"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <span className="max-w-[12rem] text-[11px] leading-tight text-amber-300/90">
          {t(errorKey(rec.error))}
        </span>
      </div>
    );
  }

  // Active: listening / requesting / processing.
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="flex items-center gap-1.5 rounded-lg bg-rose-600/15 border border-rose-500/30 px-2 py-1.5"
        role="status"
        aria-live="polite"
      >
        {rec.status === "processing" ? (
          <Loader2 className="h-3.5 w-3.5 text-rose-300 animate-spin" />
        ) : (
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
          </span>
        )}
        <span className="text-[11px] font-medium text-rose-200">
          {rec.status === "requesting"
            ? t("voice.requestingPermission")
            : rec.status === "processing"
            ? t("voice.processing")
            : t("voice.listening")}
        </span>
      </div>

      <button
        type="button"
        onClick={() => rec.stop()}
        title={t("voice.stop")}
        aria-label={t("voice.stop")}
        className="grid h-9 w-9 place-items-center rounded-lg bg-violet-600 text-white hover:bg-violet-500 transition"
      >
        <Square className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => rec.cancel()}
        title={t("voice.cancel")}
        aria-label={t("voice.cancel")}
        className="grid h-9 w-9 place-items-center rounded-lg bg-ink-800/70 text-slate-300 hover:bg-ink-700 transition"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
