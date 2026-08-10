/**
 * Metadados de busca da página pública, nos dois idiomas.
 *
 * O `index.html` é estático e monolíngue: título, descrição e Open Graph em
 * português, `<html lang="pt-BR">` cravado. Quem abre o app em inglês vê a
 * interface em inglês e **compartilha um link que se apresenta em português**;
 * e o buscador só conhece uma versão da página, embora existam duas.
 *
 * Aqui a parte que decide é função pura, testada, e a parte que toca o DOM é
 * boba de propósito. Assim o conteúdo de SEO — o que costuma apodrecer — tem
 * onde ser verificado sem navegador.
 *
 * **Limite honesto:** isto roda no cliente. O Googlebot executa JS e enxerga;
 * pré-visualização de link no WhatsApp e no Slack **não executa**, então o
 * primeiro compartilhamento sempre mostra o que está no `index.html` estático.
 * Resolver isso de verdade exige renderizar no servidor, que é decisão de
 * arquitetura, não ajuste de tag.
 */

import content from "./seo-content.json";

export const SITE_ORIGIN = content.origin;

export type SeoLanguage = "pt" | "en";

export type SeoMetadata = {
  /** Vai para `<html lang>`; região explícita ajuda leitor de tela e busca. */
  htmlLang: string;
  title: string;
  description: string;
  /** Sem duplicata: cada idioma tem uma URL própria. */
  canonical: string;
  /** `hreflang` → URL. Inclui `x-default`. */
  alternates: Array<{ hreflang: string; href: string }>;
  ogLocale: string;
  ogAlternateLocale: string;
  ogImage: string;
  keywords: string;
};

// A canônica é a raiz, e não `/splash`: as duas servem a mesma página, e sem
// canônica declarada elas disputam entre si na indexação. A raiz é o que as
// pessoas escrevem e compartilham.
//
// O texto vive em `seo-content.json`, e não aqui, porque o gerador do HTML
// estático em inglês (`scripts/build-seo-html.mjs`) lê o mesmo arquivo. Se cada
// lado tivesse a própria cópia, a página servida ao WhatsApp divergiria da que
// o app aplica em tempo de execução — e ninguém perceberia.
const CONTENT = content.languages;

/** Normaliza qualquer coisa que o i18n devolva (`pt-BR`, `en-GB`) para o par suportado. */
export function toSeoLanguage(language: string | null | undefined): SeoLanguage {
  return (language ?? "").toLowerCase().startsWith("en") ? "en" : "pt";
}

// O português é a versão sem parâmetro porque é o público principal hoje; o
// inglês ganha `?lang=en`, que o detector de idioma lê antes de tudo.
function urlFor(language: SeoLanguage): string {
  return CONTENT[language].url;
}

export function buildSeoMetadata(language: string | null | undefined): SeoMetadata {
  const lang = toSeoLanguage(language);
  const other: SeoLanguage = lang === "pt" ? "en" : "pt";
  const entry = CONTENT[lang];

  return {
    title: entry.title,
    description: entry.description,
    keywords: entry.keywords,
    htmlLang: entry.htmlLang,
    canonical: urlFor(lang),
    alternates: [
      { hreflang: "pt-BR", href: urlFor("pt") },
      { hreflang: "en", href: urlFor("en") },
      // Sem `x-default` o buscador escolhe sozinho o que mostrar para quem não
      // bate com nenhum idioma listado.
      { hreflang: "x-default", href: urlFor("pt") },
    ],
    ogLocale: entry.ogLocale,
    ogAlternateLocale: CONTENT[other].ogLocale,
    ogImage: content.image,
  };
}

/**
 * Dados estruturados. O que aparece no resultado rico do Google.
 *
 * Só afirma o que é verdade: aplicativo gratuito no beta. Inventar `aggregateRating`
 * sem avaliação real é o caminho mais rápido para punição manual — e seria
 * mentira na cara de quem vai instalar.
 */
export function buildStructuredData(language: string | null | undefined): string {
  const lang = toSeoLanguage(language);
  const meta = buildSeoMetadata(lang);

  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Airia",
    applicationCategory: "HealthApplication",
    operatingSystem: "Web, iOS, Android",
    url: meta.canonical,
    description: meta.description,
    inLanguage: meta.htmlLang,
    image: meta.ogImage,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: CONTENT[lang].currency,
    },
    author: { "@type": "Organization", name: "Airia", url: SITE_ORIGIN },
  });
}

// ── Páginas públicas que não são a raiz ───────────────────────────────────

const PAGES = content.pages;

export type StandalonePageName = keyof typeof PAGES;

export type StandalonePageSeo = {
  htmlLang: string;
  title: string;
  description: string;
  shortDescription: string;
  keywords: string;
  /** URL própria. É o ponto inteiro: sem ela a página herda a canônica da raiz. */
  canonical: string;
  ogLocale: string;
  ogImage: string;
  imageAlt: string;
};

/**
 * Metadados de uma página pública com URL própria.
 *
 * Diferença que importa em relação à raiz: **os dois idiomas dividem a mesma
 * URL**. A página troca de idioma sozinha e não existe `?lang=` para ela, então
 * não há `hreflang` a declarar — e o `hreflang` que ela herda do `index.html`
 * precisa ser removido, porque afirma que as versões desta página são `/` e
 * `/?lang=en`. Declaração errada é pior que ausente: o Google segue a errada.
 */
export function buildStandalonePageSeo(
  page: StandalonePageName,
  language: string | null | undefined,
): StandalonePageSeo {
  const entry = PAGES[page];
  const copy = entry.languages[toSeoLanguage(language)];

  return {
    htmlLang: copy.htmlLang,
    title: copy.title,
    description: copy.description,
    shortDescription: copy.shortDescription,
    keywords: copy.keywords,
    canonical: entry.url,
    ogLocale: copy.ogLocale,
    ogImage: entry.image,
    imageAlt: copy.imageAlt,
  };
}

// ── Aplicação no documento ────────────────────────────────────────────────
// Daqui para baixo não há decisão, só escrita. Tudo marcado com
// `data-seo-managed` para a troca de idioma poder substituir o que ela mesma
// criou sem tocar no que veio do `index.html`.

const MANAGED = "data-seo-managed";

function setMeta(selector: string, attribute: "name" | "property", key: string, content: string) {
  const doc = document;
  let tag = doc.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = doc.createElement("meta");
    tag.setAttribute(attribute, key);
    tag.setAttribute(MANAGED, "true");
    doc.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function setLink(rel: string, href: string, hreflang?: string) {
  const selector = hreflang
    ? `link[rel="alternate"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]`;
  let tag = document.head.querySelector<HTMLLinkElement>(selector);
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", rel);
    if (hreflang) tag.setAttribute("hreflang", hreflang);
    tag.setAttribute(MANAGED, "true");
    document.head.appendChild(tag);
  }
  tag.setAttribute("href", href);
}

export function applySeoMetadata(language: string | null | undefined): void {
  if (typeof document === "undefined") return;

  const meta = buildSeoMetadata(language);

  document.documentElement.lang = meta.htmlLang;
  document.title = meta.title;

  setMeta('meta[name="description"]', "name", "description", meta.description);
  setMeta('meta[name="keywords"]', "name", "keywords", meta.keywords);
  setMeta('meta[property="og:title"]', "property", "og:title", meta.title);
  setMeta('meta[property="og:description"]', "property", "og:description", meta.description);
  setMeta('meta[property="og:url"]', "property", "og:url", meta.canonical);
  setMeta('meta[property="og:image"]', "property", "og:image", meta.ogImage);
  setMeta('meta[property="og:locale"]', "property", "og:locale", meta.ogLocale);
  setMeta('meta[property="og:locale:alternate"]', "property", "og:locale:alternate", meta.ogAlternateLocale);
  setMeta('meta[name="twitter:title"]', "name", "twitter:title", meta.title);
  setMeta('meta[name="twitter:description"]', "name", "twitter:description", meta.description);
  setMeta('meta[name="twitter:image"]', "name", "twitter:image", meta.ogImage);

  setLink("canonical", meta.canonical);
  for (const alternate of meta.alternates) {
    setLink("alternate", alternate.href, alternate.hreflang);
  }

  let script = document.head.querySelector<HTMLScriptElement>(`script[type="application/ld+json"][${MANAGED}]`);
  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute(MANAGED, "true");
    document.head.appendChild(script);
  }
  script.textContent = buildStructuredData(language);
}

/**
 * Aplica o `<head>` de uma página pública com URL própria.
 *
 * O `<head>` estático correto já vem do servidor (`scripts/build-seo-html.mjs`
 * gera `dist/livro.html` e o nginx o serve em `/livro`), que é o que resolve
 * crawler e prévia de link. Isto aqui cobre o outro caminho: quem chega pela
 * raiz e navega por dentro do app leva no documento o `<head>` da raiz, com a
 * canônica da home — e é esse DOM que o buscador enxerga se rastrear a partir
 * de um link interno.
 */
export function applyStandalonePageSeo(
  page: StandalonePageName,
  language: string | null | undefined,
): void {
  if (typeof document === "undefined") return;

  const meta = buildStandalonePageSeo(page, language);

  document.documentElement.lang = meta.htmlLang;
  document.title = meta.title;

  setMeta('meta[name="description"]', "name", "description", meta.description);
  setMeta('meta[name="keywords"]', "name", "keywords", meta.keywords);
  setMeta('meta[property="og:title"]', "property", "og:title", meta.title);
  setMeta('meta[property="og:description"]', "property", "og:description", meta.shortDescription);
  setMeta('meta[property="og:url"]', "property", "og:url", meta.canonical);
  setMeta('meta[property="og:image"]', "property", "og:image", meta.ogImage);
  setMeta('meta[property="og:image:alt"]', "property", "og:image:alt", meta.imageAlt);
  setMeta('meta[property="og:locale"]', "property", "og:locale", meta.ogLocale);
  setMeta('meta[name="twitter:title"]', "name", "twitter:title", meta.title);
  setMeta('meta[name="twitter:description"]', "name", "twitter:description", meta.shortDescription);
  setMeta('meta[name="twitter:image"]', "name", "twitter:image", meta.ogImage);

  setLink("canonical", meta.canonical);

  // Uma URL só para os dois idiomas: `hreflang` herdado da raiz aqui é
  // afirmação falsa sobre esta página, não declaração incompleta.
  for (const alternate of document.head.querySelectorAll('link[rel="alternate"][hreflang]')) {
    alternate.remove();
  }
}
