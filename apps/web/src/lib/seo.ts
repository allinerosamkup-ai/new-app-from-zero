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

export const SITE_ORIGIN = "https://airia.pro";

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

/**
 * O caminho público que o buscador indexa.
 *
 * `/` redireciona para `/splash`, e as duas URLs devolveriam a mesma página —
 * o caso clássico de conteúdo duplicado. A canônica é a raiz, que é o que as
 * pessoas escrevem e compartilham.
 */
const CANONICAL_PATH = "/";

const CONTENT: Record<SeoLanguage, Pick<SeoMetadata, "title" | "description" | "keywords">> = {
  pt: {
    // O título carrega o termo que a pessoa digita ("app de humor") antes do
    // nome da marca, que ninguém procura ainda.
    title: "Airia — App de humor e energia para TDAH, bipolaridade e ciclotimia",
    description:
      "Acompanhe humor e energia, entenda seu padrão de dias bons e ruins e receba a próxima ação possível — do tamanho do que cabe hoje. Feito para TDAH, ciclotimia e bipolaridade tipo II. Grátis no beta.",
    keywords:
      "app de humor, diário de humor, rastreador de humor, energia, TDAH, ciclotimia, bipolaridade tipo 2, saúde mental, autoconhecimento, produtividade neurodivergente",
  },
  en: {
    title: "Airia — Mood and energy tracker for ADHD, bipolar and cyclothymia",
    description:
      "Track mood and energy, understand your pattern of good and hard days, and get the next possible action — sized to what fits today. Built for ADHD, cyclothymia and bipolar II. Free during beta.",
    keywords:
      "mood tracker, mood journal, energy tracker, ADHD, cyclothymia, bipolar 2, mental health, self-awareness, neurodivergent productivity",
  },
};

const HTML_LANG: Record<SeoLanguage, string> = { pt: "pt-BR", en: "en-US" };
const OG_LOCALE: Record<SeoLanguage, string> = { pt: "pt_BR", en: "en_US" };

/** Normaliza qualquer coisa que o i18n devolva (`pt-BR`, `en-GB`) para o par suportado. */
export function toSeoLanguage(language: string | null | undefined): SeoLanguage {
  return (language ?? "").toLowerCase().startsWith("en") ? "en" : "pt";
}

function urlFor(language: SeoLanguage): string {
  // O português é a versão sem parâmetro porque é o público principal hoje; o
  // inglês ganha `?lang=en`, que o detector de idioma lê antes de tudo.
  return language === "pt"
    ? `${SITE_ORIGIN}${CANONICAL_PATH}`
    : `${SITE_ORIGIN}${CANONICAL_PATH}?lang=en`;
}

export function buildSeoMetadata(language: string | null | undefined): SeoMetadata {
  const lang = toSeoLanguage(language);
  const other: SeoLanguage = lang === "pt" ? "en" : "pt";

  return {
    ...CONTENT[lang],
    htmlLang: HTML_LANG[lang],
    canonical: urlFor(lang),
    alternates: [
      { hreflang: "pt-BR", href: urlFor("pt") },
      { hreflang: "en", href: urlFor("en") },
      // Sem `x-default` o buscador escolhe sozinho o que mostrar para quem não
      // bate com nenhum idioma listado.
      { hreflang: "x-default", href: urlFor("pt") },
    ],
    ogLocale: OG_LOCALE[lang],
    ogAlternateLocale: OG_LOCALE[other],
    ogImage: `${SITE_ORIGIN}/screenshots/home-page.png`,
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
      priceCurrency: lang === "pt" ? "BRL" : "USD",
    },
    author: { "@type": "Organization", name: "Airia", url: SITE_ORIGIN },
  });
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
