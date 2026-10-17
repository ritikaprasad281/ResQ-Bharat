/**
 * ResQ Bharat language & capability registry — the single source of truth for
 * every language the app can present. Each entry uses a stable BCP 47 tag so
 * UI translation, speech recognition (STT) and text-to-speech (TTS) can all be
 * keyed off the same identifier.
 *
 * IMPORTANT (honesty): a language appearing here with `uiReady: true` means we
 * ship a complete UI translation bundle. It does NOT guarantee that speech
 * recognition or a speech voice actually exists on the user's device/browser —
 * that is FEATURE-DETECTED at runtime (see capabilities.ts) because it depends
 * entirely on the browser, OS and installed voices. Never assume a language is
 * fully supported just because its interface translation exists.
 *
 * Extensible: add an entry (and a locale bundle wired in config.ts) to support
 * another language without restructuring the app.
 */

export type LangCode = string; // BCP 47, e.g. "hi-IN"

export interface LanguageDef {
  /** Stable BCP 47 tag, e.g. "hi-IN". Primary key everywhere. */
  code: LangCode;
  /** Short subtag used for i18next resource folders, e.g. "hi". */
  short: string;
  /** Name in English. */
  englishName: string;
  /** Endonym — the language's own name in its own script. */
  nativeName: string;
  /** Writing system, for font/rendering notes. */
  script: string;
  /** Right-to-left layout required. (None of the current 10 are RTL.) */
  rtl?: boolean;
  /** True when we ship a complete UI translation bundle for this language. */
  uiReady: boolean;
  /**
   * Fallback locales to try for browser speech recognition when the exact tag
   * is unavailable. The Web Speech API only exposes a handful of Indian
   * locales reliably; we degrade gracefully (and ultimately to text input).
   */
  sttHints: string[];
  /** Honest, user-facing note about known limitations. */
  note?: string;
}

/** The 10 supported major Indian languages (ordered by number of speakers). */
export const LANGUAGES: LanguageDef[] = [
  { code: "en-IN", short: "en", englishName: "English", nativeName: "English", script: "Latin", uiReady: true, sttHints: ["en-IN", "en-US", "en-GB"] },
  { code: "hi-IN", short: "hi", englishName: "Hindi", nativeName: "हिन्दी", script: "Devanagari", uiReady: true, sttHints: ["hi-IN"] },
  { code: "bn-IN", short: "bn", englishName: "Bengali", nativeName: "বাংলা", script: "Bengali", uiReady: true, sttHints: ["bn-IN", "bn-BD"] },
  { code: "mr-IN", short: "mr", englishName: "Marathi", nativeName: "मराठी", script: "Devanagari", uiReady: true, sttHints: ["mr-IN", "hi-IN"] },
  { code: "te-IN", short: "te", englishName: "Telugu", nativeName: "తెలుగు", script: "Telugu", uiReady: true, sttHints: ["te-IN"] },
  { code: "ta-IN", short: "ta", englishName: "Tamil", nativeName: "தமிழ்", script: "Tamil", uiReady: true, sttHints: ["ta-IN"] },
  { code: "gu-IN", short: "gu", englishName: "Gujarati", nativeName: "ગુજરાતી", script: "Gujarati", uiReady: true, sttHints: ["gu-IN"] },
  { code: "kn-IN", short: "kn", englishName: "Kannada", nativeName: "ಕನ್ನಡ", script: "Kannada", uiReady: true, sttHints: ["kn-IN"] },
  { code: "ml-IN", short: "ml", englishName: "Malayalam", nativeName: "മലയാളം", script: "Malayalam", uiReady: true, sttHints: ["ml-IN"] },
  { code: "pa-IN", short: "pa", englishName: "Punjabi", nativeName: "ਪੰਜਾਬੀ", script: "Gurmukhi", uiReady: true, sttHints: ["pa-IN", "pa-Guru-IN"] },
];

const BY_CODE = new Map(LANGUAGES.map((l) => [l.code, l]));
const BY_SHORT = new Map(LANGUAGES.map((l) => [l.short, l]));

export const DEFAULT_LANG = "en-IN";

export function getLanguage(code?: string | null): LanguageDef {
  if (!code) return BY_CODE.get(DEFAULT_LANG)!;
  if (BY_CODE.has(code)) return BY_CODE.get(code)!;
  const short = code.split("-")[0];
  return BY_SHORT.get(short) ?? BY_CODE.get(DEFAULT_LANG)!;
}

export function isRtl(code?: string | null): boolean {
  return Boolean(getLanguage(code).rtl);
}

/** Supported short subtags, for i18next `supportedLngs`. */
export const SUPPORTED_SHORTS = LANGUAGES.map((l) => l.short);
