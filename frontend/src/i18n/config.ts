/**
 * Centralized i18next initialization. We ship complete UI bundles for all 10
 * supported Indian languages. Any unlisted selection falls back to English for
 * the static interface (safe default) while still receiving AI answers and voice
 * in the chosen language. Add a bundle below and flip `uiReady` in languages.ts
 * to localize the interface for another language — no component changes needed.
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enCommon from "../locales/en-IN/common.json";
import hiCommon from "../locales/hi-IN/common.json";
import bnCommon from "../locales/bn-IN/common.json";
import mrCommon from "../locales/mr-IN/common.json";
import teCommon from "../locales/te-IN/common.json";
import taCommon from "../locales/ta-IN/common.json";
import guCommon from "../locales/gu-IN/common.json";
import knCommon from "../locales/kn-IN/common.json";
import mlCommon from "../locales/ml-IN/common.json";
import paCommon from "../locales/pa-IN/common.json";

export const UI_STORAGE_KEY = "resq.uiLanguage.v1";

export const resources = {
  en: { common: enCommon },
  hi: { common: hiCommon },
  bn: { common: bnCommon },
  mr: { common: mrCommon },
  te: { common: teCommon },
  ta: { common: taCommon },
  gu: { common: guCommon },
  kn: { common: knCommon },
  ml: { common: mlCommon },
  pa: { common: paCommon },
} as const;

/** Short subtags for which a real UI bundle exists. */
export const UI_READY_SHORTS = Object.keys(resources);

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    // Only treat bundled languages as "supported" for the interface; all other
    // selections resolve to English chrome via fallbackLng.
    supportedLngs: [...UI_READY_SHORTS, "cimode"],
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    ns: ["common"],
    defaultNS: "common",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: UI_STORAGE_KEY,
      caches: [],
    },
    returnNull: false,
  });

export default i18n;
