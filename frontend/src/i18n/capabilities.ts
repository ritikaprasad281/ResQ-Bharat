/**
 * Runtime capability detection for speech. Unlike the static registry, this
 * inspects what the current browser/device can ACTUALLY do:
 *  - Is the Web Speech API (recognition) present at all?
 *  - Is speech synthesis present, and is there a voice whose locale matches a
 *    given language?
 * Everything here degrades gracefully; nothing throws.
 */

import { getLanguage, type LangCode } from "./languages";

type SpeechRecognitionCtor = new () => SpeechRecognition;

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** True if the browser exposes any speech-recognition engine. */
export function speechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

/** True if the browser exposes speech synthesis (TTS). */
export function speechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Voice loading is async in most browsers. Resolve once voices are available
 * (or immediately if they already are / TTS is unsupported).
 */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!speechSynthesisSupported()) return resolve([]);
    const synth = window.speechSynthesis;
    const existing = synth.getVoices();
    if (existing.length) return resolve(existing);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve(synth.getVoices());
    };
    synth.addEventListener("voiceschanged", finish, { once: true });
    // Safety net: some browsers never fire voiceschanged.
    setTimeout(finish, 1200);
  });
}

/**
 * Pick the best available TTS voice for a language, matching on exact locale
 * first, then the base subtag (e.g. "hi"). Returns null when nothing matches —
 * the caller must keep the written text available in that case.
 */
export function pickVoice(
  code: LangCode,
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const def = getLanguage(code);
  const base = def.short.toLowerCase();
  const exact = voices.find((v) => v.lang?.toLowerCase() === code.toLowerCase());
  if (exact) return exact;
  const byBase = voices.find((v) => v.lang?.toLowerCase().startsWith(base + "-"));
  if (byBase) return byBase;
  const justBase = voices.find((v) => v.lang?.toLowerCase() === base);
  return justBase ?? null;
}

export interface LangCapability {
  ttsVoice: boolean;
  recognition: boolean;
}

/** Combined, runtime view of what a given language can do right now. */
export function detectCapability(
  code: LangCode,
  voices: SpeechSynthesisVoice[]
): LangCapability {
  return {
    recognition: speechRecognitionSupported(),
    ttsVoice: pickVoice(code, voices) !== null,
  };
}
