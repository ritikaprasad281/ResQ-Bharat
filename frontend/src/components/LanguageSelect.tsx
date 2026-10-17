/**
 * LanguageSelect — the per-chat RESPONSE language picker (distinct from the
 * website language). Thin wrapper over LanguagePicker that shows capability
 * badges and any sentinel options (e.g. "Follow website", "Auto-detect").
 * Kept as a named component so the two chat surfaces import it consistently.
 */

import LanguagePicker, { type SpecialOption } from "./LanguagePicker";

interface Props {
  value: string;
  onChange: (value: string) => void;
  voices?: SpeechSynthesisVoice[];
  specials?: SpecialOption[];
  align?: "left" | "right";
  size?: "sm" | "md";
}

export default function LanguageSelect({
  value,
  onChange,
  voices,
  specials,
  align = "right",
  size = "sm",
}: Props) {
  return (
    <LanguagePicker
      value={value}
      onChange={onChange}
      voices={voices}
      specials={specials}
      align={align}
      size={size}
      showCapabilities
    />
  );
}
