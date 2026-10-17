/**
 * LanguageProvider — owns the user's INTERFACE language as a full BCP 47 code,
 * persists it, keeps i18next in sync (short subtag) and sets the document's
 * `lang`/`dir` so right-to-left scripts (Urdu, Kashmiri, Sindhi) render
 * correctly. The spoken/answer language is tracked separately per AI surface and
 * is intentionally NOT coupled to this value.
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
import i18n, { UI_STORAGE_KEY } from "./config";
import {
  DEFAULT_LANG,
  getLanguage,
  isRtl,
  type LangCode,
} from "./languages";

interface LanguageContextValue {
  /** Full BCP 47 interface language, e.g. "hi-IN". */
  uiLang: LangCode;
  setUiLang: (code: LangCode) => void;
  rtl: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readStored(): LangCode {
  try {
    const raw = localStorage.getItem(UI_STORAGE_KEY);
    if (raw) {
      // languagedetector may have stored a short subtag ("hi"); normalise to
      // the registry's full code.
      return getLanguage(raw).code;
    }
  } catch {
    /* ignore */
  }
  // Browser preference, then English.
  const nav = typeof navigator !== "undefined" ? navigator.language : "";
  return getLanguage(nav).code;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [uiLang, setUiLangState] = useState<LangCode>(() => {
    const code = readStored();
    return code;
  });

  const applyLang = useCallback((code: LangCode) => {
    const def = getLanguage(code);
    void i18n.changeLanguage(def.short);
    if (typeof document !== "undefined") {
      document.documentElement.lang = def.code;
      document.documentElement.dir = def.rtl ? "rtl" : "ltr";
    }
    try {
      localStorage.setItem(UI_STORAGE_KEY, def.code);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    applyLang(uiLang);
  }, [uiLang, applyLang]);

  const setUiLang = useCallback((code: LangCode) => {
    setUiLangState(getLanguage(code).code);
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({ uiLang, setUiLang, rtl: isRtl(uiLang) }),
    [uiLang, setUiLang]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useUiLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    // Safe fallback so a stray consumer never crashes the app.
    return { uiLang: DEFAULT_LANG, setUiLang: () => {}, rtl: false };
  }
  return ctx;
}
