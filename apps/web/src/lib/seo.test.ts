import { describe, expect, it } from "vitest";

import { buildSeoMetadata, buildStructuredData, SITE_ORIGIN, toSeoLanguage } from "./seo";

describe("idioma do SEO", () => {
  it("aceita as variantes de região que o i18n devolve", () => {
    expect(toSeoLanguage("en")).toBe("en");
    expect(toSeoLanguage("en-GB")).toBe("en");
    expect(toSeoLanguage("pt-BR")).toBe("pt");
    // Idioma não suportado cai no principal, nunca em string vazia.
    expect(toSeoLanguage("fr-FR")).toBe("pt");
    expect(toSeoLanguage(null)).toBe("pt");
  });
});

describe("metadados da página pública", () => {
  it("entrega título e descrição próprios em cada idioma", () => {
    const pt = buildSeoMetadata("pt");
    const en = buildSeoMetadata("en");

    expect(pt.title).not.toBe(en.title);
    expect(pt.description).not.toBe(en.description);
    expect(pt.htmlLang).toBe("pt-BR");
    expect(en.htmlLang).toBe("en-US");
  });

  /**
   * Título e descrição truncados na busca desperdiçam o espaço que o Google dá.
   * Os limites são os de exibição habituais — não são regra do buscador, são o
   * ponto onde o texto vira reticências e a promessa some.
   */
  it("cabe no que o resultado de busca mostra", () => {
    for (const language of ["pt", "en"] as const) {
      const meta = buildSeoMetadata(language);
      expect(meta.title.length, `título ${language}: ${meta.title.length} chars`).toBeLessThanOrEqual(70);
      expect(meta.description.length, `descrição ${language}: ${meta.description.length} chars`).toBeLessThanOrEqual(300);
      expect(meta.description.length).toBeGreaterThanOrEqual(110);
    }
  });

  it("cada idioma tem URL própria, senão hreflang não significa nada", () => {
    expect(buildSeoMetadata("pt").canonical).not.toBe(buildSeoMetadata("en").canonical);
    expect(buildSeoMetadata("en").canonical).toContain("lang=en");
  });

  it("declara os dois idiomas e um x-default, apontando para URL absoluta", () => {
    const alternates = buildSeoMetadata("en").alternates;
    expect(alternates.map((a) => a.hreflang).sort()).toEqual(["en", "pt-BR", "x-default"]);
    for (const alternate of alternates) {
      expect(alternate.href.startsWith(SITE_ORIGIN), `${alternate.hreflang} precisa ser absoluto`).toBe(true);
    }
  });

  it("as duas versões apontam uma para a outra com o mesmo conjunto de alternativas", () => {
    // Hreflang só vale se for recíproco: o Google descarta declaração unilateral.
    expect(buildSeoMetadata("pt").alternates).toEqual(buildSeoMetadata("en").alternates);
  });

  it("imagem de compartilhamento é absoluta", () => {
    // Caminho relativo em og:image não resolve fora do site — a prévia do link
    // sai sem imagem, que é o único momento em que ela importa.
    expect(buildSeoMetadata("pt").ogImage.startsWith("https://")).toBe(true);
  });
});

describe("dados estruturados", () => {
  it("são JSON válido e declaram o idioma da página", () => {
    const data = JSON.parse(buildStructuredData("en"));
    expect(data["@type"]).toBe("SoftwareApplication");
    expect(data.inLanguage).toBe("en-US");
    expect(data.offers.price).toBe("0");
  });

  /**
   * Nota inventada é penalidade manual garantida, e mentira para quem vai
   * instalar o app achando que outras pessoas avaliaram.
   */
  it("não declaram avaliação que não existe", () => {
    for (const language of ["pt", "en"] as const) {
      const data = JSON.parse(buildStructuredData(language));
      expect(data.aggregateRating).toBeUndefined();
      expect(data.review).toBeUndefined();
    }
  });
});
