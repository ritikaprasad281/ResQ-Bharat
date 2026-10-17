/**
 * useSpeechSynthesis — browser text-to-speech with locale-matched voice
 * selection, sentence-boundary chunking for long answers, single-playback
 * guarantee (new playback cancels any previous one), and honest capability
 * reporting (no voice → caller keeps the written text and explains the gap).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadVoices,
  pickVoice,
  speechSynthesisSupported,
} from "../i18n/capabilities";
import type { LangCode } from "../i18n/languages";

export type SpeakStatus = "idle" | "speaking" | "paused";

/** Strip Markdown so we never read raw symbols (**, #, `, [], etc.) aloud. */
function plainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~>#]/g, "")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Break text into <=220-char chunks at sentence boundaries. */
function chunk(text: string, max = 220): string[] {
  const parts = text.split(/(?<=[.!?。！？\u0964])\s+/); // includes Devanagari danda
  const out: string[] = [];
  let buf = "";
  for (const p of parts) {
    if ((buf + " " + p).trim().length > max) {
      if (buf) out.push(buf.trim());
      buf = p;
    } else {
      buf = buf ? buf + " " + p : p;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out.length ? out : [text];
}

export interface UseSpeechSynthesis {
  supported: boolean;
  status: SpeakStatus;
  voices: SpeechSynthesisVoice[];
  /** True if a voice exists for the given language right now. */
  hasVoice: (lang: LangCode) => boolean;
  speak: (text: string, lang: LangCode) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
}

export function useSpeechSynthesis(): UseSpeechSynthesis {
  const supported = speechSynthesisSupported();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [status, setStatus] = useState<SpeakStatus>("idle");
  const queueRef = useRef<string[]>([]);
  const activeRef = useRef(false);

  useEffect(() => {
    let alive = true;
    void loadVoices().then((v) => {
      if (alive) setVoices(v);
    });
    return () => {
      alive = false;
      if (supported) window.speechSynthesis.cancel();
    };
  }, [supported]);

  const hasVoice = useCallback(
    (lang: LangCode) => pickVoice(lang, voices) !== null,
    [voices]
  );

  const stop = useCallback(() => {
    if (!supported) return;
    activeRef.current = false;
    queueRef.current = [];
    window.speechSynthesis.cancel();
    setStatus("idle");
  }, [supported]);

  const speak = useCallback(
    (text: string, lang: LangCode) => {
      if (!supported) return;
      const voice = pickVoice(lang, voices);
      const clean = plainText(text);
      if (!clean) return;

      // Single-playback guarantee: cancel whatever was playing.
      window.speechSynthesis.cancel();
      queueRef.current = chunk(clean);
      activeRef.current = true;

      const speakNext = () => {
        if (!activeRef.current) return;
        const next = queueRef.current.shift();
        if (!next) {
          activeRef.current = false;
          setStatus("idle");
          return;
        }
        const u = new SpeechSynthesisUtterance(next);
        if (voice) {
          u.voice = voice;
          u.lang = voice.lang;
        } else {
          u.lang = lang;
        }
        u.rate = 1;
        u.pitch = 1;
        u.onend = speakNext;
        u.onerror = () => {
          activeRef.current = false;
          setStatus("idle");
        };
        window.speechSynthesis.speak(u);
      };

      setStatus("speaking");
      speakNext();
    },
    [supported, voices]
  );

  const pause = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.pause();
    setStatus("paused");
  }, [supported]);

  const resume = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.resume();
    setStatus("speaking");
  }, [supported]);

  return { supported, status, voices, hasVoice, speak, stop, pause, resume };
}
