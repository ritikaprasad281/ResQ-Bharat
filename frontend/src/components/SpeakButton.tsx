/**
 * SpeakButton — plays an AI answer aloud in the response language using the
 * shared TTS controller. Shows a speaking indicator while active, stops cleanly,
 * and honestly disables itself (with an explanation) when no voice exists for
 * the language on this device. The written answer always stays visible.
 */

import { Volume2, Square, VolumeX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTts } from "../i18n/TtsProvider";
import type { LangCode } from "../i18n/languages";

interface Props {
  id: string;
  text: string;
  lang: LangCode;
}

export default function SpeakButton({ id, text, lang }: Props) {
  const { t } = useTranslation();
  const tts = useTts();

  if (!tts.supported) return null;

  const voiceAvailable = tts.hasVoice(lang);
  const isActive = tts.activeId === id && tts.status !== "idle";

  if (!voiceAvailable) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] text-slate-500"
        title={t("voice.ttsUnavailable")}
      >
        <VolumeX className="h-3.5 w-3.5" />
        {t("language.voice")}: {t("language.notAvailable")}
      </span>
    );
  }

  if (isActive) {
    return (
      <button
        type="button"
        onClick={() => tts.stop()}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-emerald-300 hover:bg-white/5 transition"
        aria-label={t("voice.stopPlayback")}
      >
        <Square className="h-3 w-3" />
        {t("voice.speaking")}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => tts.play(id, text, lang)}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-slate-400 hover:text-white hover:bg-white/5 transition"
      aria-label={t("voice.playResponse")}
    >
      <Volume2 className="h-3.5 w-3.5" />
      {t("voice.playResponse")}
    </button>
  );
}
