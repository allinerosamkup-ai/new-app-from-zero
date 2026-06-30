// i18n bootstrap — react-i18next + browser language detector
// Usage:
//   import "./i18n"; // once at app entry (main.tsx)
//   import { useTranslation } from "react-i18next";
//   const { t } = useTranslation();
//   t("phases.depleted.label")
//
// Persistência: localStorage.airia_lang (chave dedicada do app).
// Fallback: pt-BR.

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import pt from "./locales/pt.json";
import en from "./locales/en.json";

export const SUPPORTED_LANGUAGES = ["pt", "en"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const STORAGE_KEY = "airia_lang";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      pt: { translation: pt },
      en: { translation: en },
    },
    fallbackLng: "pt",
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    nonExplicitSupportedLngs: true, // pt-BR -> pt
    interpolation: { escapeValue: false }, // react já escapa
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: STORAGE_KEY,
      caches: ["localStorage"],
    },
    returnNull: false,
  });

export function setLanguage(lang: SupportedLanguage) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
  return i18n.changeLanguage(lang);
}

export function getCurrentLanguage(): SupportedLanguage {
  const raw = (i18n.language ?? "pt").split("-")[0];
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(raw)
    ? (raw as SupportedLanguage)
    : "pt";
}

export default i18n;
