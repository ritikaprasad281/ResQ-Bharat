/**
 * useResponseLanguage — resolves which language the AI should answer in, keeping
 * it independent from the website (UI) language. Users pick one of:
 *   - "follow"  → answer in the current website language
 *   - "auto"    → detect from the spoken/typed message (script-based)
 *   - a specific BCP 47 language code
 * The resolved language is what we send to Gemini; `detected` is surfaced so the
 * UI can show it and let the user override.
 */

import { useCallback, useMemo, useState } from "react";
import { useUiLanguage } from "../i18n/LanguageProvider";
import { getLanguage, type LangCode } from "../i18n/languages";
import { detectTranscriptLanguage } from "../i18n/detect";

export const FOLLOW = "follow";
export const AUTO = "auto";

const STORE_KEY = "resq.responseLang.v1";

function readPref(): string {
  try {
    return localStorage.getItem(STORE_KEY) || FOLLOW;
  } catch {
    return FOLLOW;
  }
}

export interface ResponseLanguage {
  /** Raw preference: "follow" | "auto" | a LangCode. */
  pref: string;
  setPref: (p: string) => void;
  /** Last auto-detected language (null until a message is analysed). */
  detected: LangCode | null;
  /** Whether the last detection was script-ambiguous (e.g. Devanagari). */
  ambiguous: boolean;
  /** The concrete language to send to the backend right now. */
  resolved: LangCode;
  /** Feed a message to refine detection in "auto" mode; returns the language. */
  resolveForMessage: (text: string) => LangCode;
  /** Explicitly override the detected language for this conversation. */
  overrideDetected: (code: LangCode) => void;
}

export function useResponseLanguage(): ResponseLanguage {
  const { uiLang } = useUiLanguage();
  const [pref, setPrefState] = useState<string>(() => readPref());
  const [detected, setDetected] = useState<LangCode | null>(null);
  const [ambiguous, setAmbiguous] = useState(false);

  const setPref = useCallback((p: string) => {
    setPrefState(p);
    try {
      localStorage.setItem(STORE_KEY, p);
    } catch {
      /* ignore */
    }
  }, []);

  const baseResolved = useMemo<LangCode>(() => {
    if (pref === FOLLOW) return getLanguage(uiLang).code;
    if (pref === AUTO) return detected ?? getLanguage(uiLang).code;
    return getLanguage(pref).code;
  }, [pref, uiLang, detected]);

  const resolveForMessage = useCallback(
    (text: string): LangCode => {
      if (pref !== AUTO) {
        // Explicit or follow-website: ignore message content.
        return pref === FOLLOW ? getLanguage(uiLang).code : getLanguage(pref).code;
      }
      const res = detectTranscriptLanguage(text);
      setAmbiguous(res.ambiguous);
      if (res.lang) {
        // Keep an ambiguous Devanagari guess only if we had nothing better.
        setDetected(res.lang);
        return res.lang;
      }
      return detected ?? getLanguage(uiLang).code;
    },
    [pref, uiLang, detected]
  );

  const overrideDetected = useCallback((code: LangCode) => {
    setDetected(getLanguage(code).code);
    setAmbiguous(false);
  }, []);

  return {
    pref,
    setPref,
    detected,
    ambiguous,
    resolved: baseResolved,
    resolveForMessage,
    overrideDetected,
  };
}
