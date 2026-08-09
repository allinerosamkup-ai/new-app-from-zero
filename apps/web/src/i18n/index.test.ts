import { afterEach, describe, expect, it, vi } from "vitest";
import i18next from "i18next";
import { dropDetectorCache, resolveIntlLocale, selectLocalizedCopy } from "./index";
import pt from "./locales/pt.json";
import en from "./locales/en.json";

function leafKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, nested]) =>
    leafKeys(nested, prefix ? `${prefix}.${key}` : key),
  );
}

describe("resolveIntlLocale", () => {
  it("uses a region-aware locale for each supported app language", () => {
    expect(resolveIntlLocale("pt")).toBe("pt-BR");
    expect(resolveIntlLocale("pt-BR")).toBe("pt-BR");
    expect(resolveIntlLocale("en")).toBe("en-US");
    expect(resolveIntlLocale("en-GB")).toBe("en-US");
  });
});

describe("translation catalog", () => {
  it("keeps Portuguese and English leaf keys in exact parity", () => {
    expect(leafKeys(en).sort()).toEqual(leafKeys(pt).sort());
  });
});

/**
 * O idioma segue o aparelho até a pessoa escolher outro.
 *
 * A configuração antiga tinha `caches: ["localStorage"]`, que gravava o idioma
 * **detectado** como se fosse escolhido: a primeira visita cravava o valor para
 * sempre, e quem depois trocasse o idioma do celular ficava preso no antigo.
 * São três linhas de config, e é exatamente o tipo de linha que volta sem
 * ninguém notar.
 */
describe("detecção de idioma", () => {
  it("consulta a query, depois a escolha salva, depois o aparelho", () => {
    expect(i18next.options.detection?.order).toEqual(["querystring", "localStorage", "navigator"]);
  });

  it("não guarda o idioma que apenas detectou", () => {
    expect(i18next.options.detection?.caches).toEqual([]);
  });

  it("lê `?lang=` para o link de busca em inglês abrir em inglês", () => {
    expect(i18next.options.detection?.lookupQuerystring).toBe("lang");
  });
});

describe("limpeza do cache antigo do detector", () => {
  /**
   * Dublê explícito em vez do `localStorage` do ambiente: aqui o global do
   * Node se sobrepõe ao do jsdom (é a origem do aviso `--localstorage-file` na
   * suíte) e `setItem` chega a não existir. Testar contra um objeto controlado
   * mede a regra, não o ambiente.
   */
  function comStorage(inicial: string | null) {
    const store = new Map<string, string>();
    if (inicial !== null) store.set("airia_lang", inicial);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    });
    return store;
  }

  afterEach(() => vi.unstubAllGlobals());

  // Escolha explícita e cache do detector se distinguem pelo formato:
  // `setLanguage()` grava `pt`/`en`, o detector gravava `pt-BR`/`en-US`.
  it("descarta a etiqueta com região, que ninguém escolheu", () => {
    const store = comStorage("pt-BR");
    dropDetectorCache();
    expect(store.get("airia_lang")).toBeUndefined();
  });

  it("preserva a escolha explícita", () => {
    for (const chosen of ["pt", "en"]) {
      const store = comStorage(chosen);
      dropDetectorCache();
      expect(store.get("airia_lang")).toBe(chosen);
    }
  });

  it("não quebra quando o storage está bloqueado", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("modo privado"); },
      setItem: () => {},
      removeItem: () => {},
    });
    expect(() => dropDetectorCache()).not.toThrow();
  });
});

describe("localized long-form copy", () => {
  it("selects the active language without changing user content", () => {
    expect(selectLocalizedCopy("pt-BR", "Texto autoral", "Authored copy")).toBe("Texto autoral");
    expect(selectLocalizedCopy("en-US", "Texto autoral", "Authored copy")).toBe("Authored copy");
  });
});
