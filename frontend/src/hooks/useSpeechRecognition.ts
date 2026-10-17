/**
 * useSpeechRecognition — a thin, safe wrapper over the browser Web Speech API.
 * It feature-detects support, only starts after an explicit caller action,
 * exposes clear states for the UI, surfaces interim + final transcripts, and
 * always releases the engine when it ends. It never throws; unsupported
 * browsers simply report `supported: false` so the caller can fall back to text.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { getSpeechRecognitionCtor } from "../i18n/capabilities";
import { getLanguage, type LangCode } from "../i18n/languages";

export type RecognitionStatus =
  | "idle"
  | "requesting"
  | "listening"
  | "processing"
  | "error";

export type RecognitionError =
  | "not-supported"
  | "permission-denied"
  | "no-speech"
  | "language-unavailable"
  | "network"
  | "aborted"
  | "unknown";

export interface UseSpeechRecognition {
  supported: boolean;
  status: RecognitionStatus;
  interim: string;
  finalText: string;
  error: RecognitionError | null;
  /** Locale the engine actually used (after sttHint fallback). */
  activeLocale: string | null;
  start: (lang: LangCode) => void;
  stop: () => void;
  cancel: () => void;
  reset: () => void;
}

export function useSpeechRecognition(): UseSpeechRecognition {
  const Ctor = getSpeechRecognitionCtor();
  const supported = Ctor !== null;

  const [status, setStatus] = useState<RecognitionStatus>("idle");
  const [interim, setInterim] = useState("");
  const [finalText, setFinalText] = useState("");
  const [error, setError] = useState<RecognitionError | null>(null);
  const [activeLocale, setActiveLocale] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognition | null>(null);
  const stoppingRef = useRef(false);

  const teardown = useCallback(() => {
    const rec = recRef.current;
    if (rec) {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
      recRef.current = null;
    }
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  const start = useCallback(
    (lang: LangCode) => {
      if (!Ctor) {
        setError("not-supported");
        setStatus("error");
        return;
      }
      // Reset any prior run.
      teardown();
      setInterim("");
      setFinalText("");
      setError(null);
      stoppingRef.current = false;

      const def = getLanguage(lang);
      const locale = def.sttHints[0] ?? def.code;
      setActiveLocale(locale);

      const rec = new Ctor();
      rec.lang = locale;
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onstart = () => setStatus("listening");
      rec.onspeechstart = () => setStatus("listening");

      rec.onresult = (ev: SpeechRecognitionEvent) => {
        let interimText = "";
        let finalChunk = "";
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const res = ev.results[i];
          const txt = res[0]?.transcript ?? "";
          if (res.isFinal) finalChunk += txt;
          else interimText += txt;
        }
        if (interimText) setInterim(interimText);
        if (finalChunk) {
          setFinalText((prev) => (prev ? prev + " " : "") + finalChunk.trim());
          setInterim("");
          setStatus("processing");
        }
      };

      rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
        const code = ev.error;
        let mapped: RecognitionError = "unknown";
        if (code === "not-allowed" || code === "service-not-allowed")
          mapped = "permission-denied";
        else if (code === "no-speech") mapped = "no-speech";
        else if (code === "language-not-supported") mapped = "language-unavailable";
        else if (code === "network") mapped = "network";
        else if (code === "aborted") mapped = "aborted";
        // An explicit stop() surfaces as "aborted"; don't flag that as an error.
        if (mapped === "aborted" && stoppingRef.current) return;
        setError(mapped);
        setStatus("error");
      };

      rec.onend = () => {
        setStatus((s) => (s === "error" ? s : "idle"));
        recRef.current = null;
      };

      recRef.current = rec;
      setStatus("requesting");
      try {
        rec.start();
      } catch {
        // Calling start() twice throws InvalidStateError — treat as benign.
        setStatus("listening");
      }
    },
    [Ctor, teardown]
  );

  const stop = useCallback(() => {
    stoppingRef.current = true;
    const rec = recRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
    setStatus((s) => (s === "error" ? s : "processing"));
  }, []);

  const cancel = useCallback(() => {
    stoppingRef.current = true;
    teardown();
    setInterim("");
    setStatus("idle");
  }, [teardown]);

  const reset = useCallback(() => {
    setInterim("");
    setFinalText("");
    setError(null);
    setStatus("idle");
  }, []);

  return {
    supported,
    status,
    interim,
    finalText,
    error,
    activeLocale,
    start,
    stop,
    cancel,
    reset,
  };
}
