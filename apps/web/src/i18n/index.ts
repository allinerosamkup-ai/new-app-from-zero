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
import { useSyncExternalStore } from "react";
import LanguageDetector from "i18next-browser-languagedetector";

import pt from "./locales/pt.json";
import en from "./locales/en.json";

export const SUPPORTED_LANGUAGES = ["pt", "en"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const STORAGE_KEY = "airia_lang";

/**
 * Limpa o idioma que o detector gravou sozinho em versões anteriores.
 *
 * Até 2026-08-09 o detector cacheava o que ele mesmo detectou, então quem já
 * usou o app tem `airia_lang` preenchido sem nunca ter escolhido nada — e esse
 * valor passaria a vencer o idioma do aparelho para sempre, que é justo o
 * problema que estamos consertando.
 *
 * Os dois casos se distinguem pelo formato: `setLanguage()` só grava `pt` ou
 * `en`; o detector gravava a etiqueta completa do navegador (`pt-BR`, `en-US`).
 * Valor com região é cache antigo e pode sair.
 */
export function dropDetectorCache() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && !(SUPPORTED_LANGUAGES as readonly string[]).includes(stored)) {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* modo privado, storage bloqueado: seguir sem cache é o comportamento certo */
  }
}

dropDetectorCache();

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
    /**
     * O idioma segue o aparelho, até a pessoa escolher outro.
     *
     * `caches: ["localStorage"]` gravava o idioma **detectado**, não o
     * escolhido. Efeito: a primeira visita cravava `airia_lang` para sempre, e
     * quem depois trocasse o idioma do celular ficava preso no antigo — o app
     * respeitava uma preferência que ninguém expressou.
     *
     * Sem cache, `navigator` é relido a cada carregamento e o aparelho manda.
     * Escolha explícita continua ganhando porque `setLanguage()` escreve na
     * mesma chave à mão, e `localStorage` vem antes na ordem.
     *
     * `querystring` na frente existe para o `?lang=en` do `hreflang`: link de
     * busca em inglês precisa abrir em inglês mesmo num aparelho em português.
     */
    detection: {
      order: ["querystring", "localStorage", "navigator"],
      lookupQuerystring: "lang",
      lookupLocalStorage: STORAGE_KEY,
      caches: [],
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

export function resolveIntlLocale(language = i18n.language): "pt-BR" | "en-US" {
  return language.toLowerCase().startsWith("en") ? "en-US" : "pt-BR";
}

export function selectLocalizedCopy(language: string, portuguese: string, english: string): string {
  return language.toLowerCase().startsWith("en") ? english : portuguese;
}

/**
 * Idioma ativo, reagindo à troca.
 *
 * Deliberadamente **sem** `useTranslation`: aquele hook resolve a instância por
 * contexto do React, e sem `I18nextProvider` em volta ele quebra — foi o que
 * derrubou o teste da splash, que renderiza a página sem provedor nenhum. Aqui
 * a assinatura é direta na instância, então funciona em qualquer render.
 */
export function useLanguage(): string {
  return useSyncExternalStore(
    (notify) => {
      i18n.on("languageChanged", notify);
      return () => i18n.off("languageChanged", notify);
    },
    () => i18n.language,
    () => i18n.language,
  );
}

/** Reactive helper for long-form/editorial copy that would make locale catalogs unreadable. */
export function useLocalizedCopy() {
  const language = useLanguage();
  return (portuguese: string, english: string) => selectLocalizedCopy(language, portuguese, english);
}

export default i18n;
