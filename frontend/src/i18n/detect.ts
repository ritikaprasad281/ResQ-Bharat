/**
 * Transcript language identification by script. The browser Web Speech API
 * transcribes in the locale it was given and does NOT reliably report a
 * different spoken language, so when "auto-detect" is enabled we infer the
 * language from the Unicode script of the transcript. This is reliable for
 * distinct scripts (Tamil, Telugu, Bengali, …) and honestly AMBIGUOUS for
 * languages that share a script (Hindi vs Marathi, both Devanagari) — callers
 * should confirm with the user or keep the configured preference in that case.
 */

import { getLanguage, type LangCode } from "./languages";

interface Range {
  re: RegExp;
  lang: LangCode;
  ambiguous?: boolean; // script shared by multiple supported languages
}

const RANGES: Range[] = [
  { re: /[\u0B80-\u0BFF]/, lang: "ta-IN" }, // Tamil
  { re: /[\u0C00-\u0C7F]/, lang: "te-IN" }, // Telugu
  { re: /[\u0C80-\u0CFF]/, lang: "kn-IN" }, // Kannada
  { re: /[\u0D00-\u0D7F]/, lang: "ml-IN" }, // Malayalam
  { re: /[\u0A80-\u0AFF]/, lang: "gu-IN" }, // Gujarati
  { re: /[\u0A00-\u0A7F]/, lang: "pa-IN" }, // Gurmukhi → Punjabi
  { re: /[\u0980-\u09FF]/, lang: "bn-IN" }, // Bengali (also Assamese)
  { re: /[\u0900-\u097F]/, lang: "hi-IN", ambiguous: true }, // Devanagari: hi/mr
];

export interface DetectResult {
  lang: LangCode | null;
  ambiguous: boolean;
}

/**
 * Identify the dominant script in `text`. Returns the best-guess language and
 * whether that script is shared by more than one supported language.
 */
export function detectTranscriptLanguage(text: string): DetectResult {
  const counts = RANGES.map((r) => ({
    r,
    n: (text.match(new RegExp(r.re, "g")) ?? []).length,
  }));
  const best = counts.sort((a, b) => b.n - a.n)[0];
  if (!best || best.n === 0) {
    // No Indic script → assume Latin/English.
    return { lang: /[A-Za-z]/.test(text) ? "en-IN" : null, ambiguous: false };
  }
  return { lang: best.r.lang, ambiguous: Boolean(best.r.ambiguous) };
}

/** Human label for a detected language, in its own script. */
export function detectedLabel(code: LangCode): string {
  return getLanguage(code).nativeName;
}
