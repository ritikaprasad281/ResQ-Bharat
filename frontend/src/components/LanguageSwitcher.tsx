/**
 * Global website-language switcher for the header. Bound to the shared UI
 * language context so a change instantly re-renders every route (no reload)
 * while route, map and form state are preserved by React.
 */

import { useUiLanguage } from "../i18n/LanguageProvider";
import LanguagePicker from "./LanguagePicker";

export default function LanguageSwitcher({
  align = "right",
}: {
  align?: "left" | "right";
}) {
  const { uiLang, setUiLang } = useUiLanguage();
  return <LanguagePicker value={uiLang} onChange={setUiLang} align={align} />;
}
