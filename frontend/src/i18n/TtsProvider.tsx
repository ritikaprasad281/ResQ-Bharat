/**
 * TtsProvider — one shared text-to-speech controller for the whole app so that
 * only a single answer can ever play at a time and each SpeakButton knows
 * whether IT is the active one. Keeps the written response untouched; audio is
 * purely additive and optional.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  useSpeechSynthesis,
  type SpeakStatus,
} from "../hooks/useSpeechSynthesis";
import type { LangCode } from "./languages";

interface TtsContextValue {
  supported: boolean;
  status: SpeakStatus;
  activeId: string | null;
  hasVoice: (lang: LangCode) => boolean;
  play: (id: string, text: string, lang: LangCode) => void;
  stop: () => void;
}

const TtsContext = createContext<TtsContextValue | null>(null);

export function TtsProvider({ children }: { children: ReactNode }) {
  const synth = useSpeechSynthesis();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Clear the active marker once playback finishes on its own.
  useEffect(() => {
    if (synth.status === "idle") setActiveId(null);
  }, [synth.status]);

  const play = useCallback(
    (id: string, text: string, lang: LangCode) => {
      setActiveId(id);
      synth.speak(text, lang);
    },
    [synth]
  );

  const stop = useCallback(() => {
    synth.stop();
    setActiveId(null);
  }, [synth]);

  const value = useMemo<TtsContextValue>(
    () => ({
      supported: synth.supported,
      status: synth.status,
      activeId,
      hasVoice: synth.hasVoice,
      play,
      stop,
    }),
    [synth.supported, synth.status, synth.hasVoice, activeId, play, stop]
  );

  return <TtsContext.Provider value={value}>{children}</TtsContext.Provider>;
}

export function useTts(): TtsContextValue {
  const ctx = useContext(TtsContext);
  if (!ctx) {
    return {
      supported: false,
      status: "idle",
      activeId: null,
      hasVoice: () => false,
      play: () => {},
      stop: () => {},
    };
  }
  return ctx;
}
