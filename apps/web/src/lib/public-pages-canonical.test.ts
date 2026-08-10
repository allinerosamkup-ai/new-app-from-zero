import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import content from "./seo-content.json";
import { SITE_ORIGIN } from "./seo";

/**
 * Consolidação de host das páginas indexáveis.
 *
 * `airia.pro` e `www.airia.pro` servem o mesmo site com HTTP 200, e continuam
 * assim de propósito: o PWA está instalado no `www` e redirecionar aquele host
 * quebrou a produção uma vez (ver `deploy/airia/nginx.conf`). Com dois hosts
 * servindo 200, o único sinal que diz ao buscador qual URL é a verdadeira é o
 * `rel=canonical` — e ele precisa existir em **toda** página indexável, não só
 * na raiz.
 *
 * O buraco que este teste fecha: `privacy.html` e `terms.html` são arquivos
 * estáticos, não passam pelo `<head>` da SPA, e estavam sem canônica nenhuma
 * embora sejam duas das quatro URLs do sitemap.
 *
 * Isto é varredura de texto de propósito. A alternativa seria testar o HTML
 * servido, que exige a produção no ar — e a falha que interessa nasce no
 * arquivo, não na rede.
 */

// `import.meta.dirname` porque o ambiente do Vitest aqui é jsdom, e nele
// `import.meta.url` não é URL de arquivo. Mesmo caminho de `css-tokens.test.ts`.
const WEB_ROOT = path.resolve(import.meta.dirname, "../..");

function read(relativePath: string): string {
  return readFileSync(path.join(WEB_ROOT, relativePath), "utf8");
}

function canonicalOf(html: string): string | null {
  const match = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i);
  return match ? match[1] : null;
}

/** Páginas cuja canônica está escrita no arquivo, versionada. */
const STATIC_PAGES = [
  { file: "index.html", canonical: `${SITE_ORIGIN}/` },
  { file: "public/privacy.html", canonical: `${SITE_ORIGIN}/privacy` },
  { file: "public/terms.html", canonical: `${SITE_ORIGIN}/terms` },
] as const;

/**
 * Páginas cuja canônica é gerada no build por `scripts/build-seo-html.mjs` a
 * partir de `seo-content.json`. Não há arquivo para ler aqui — o que se
 * verifica é a fonte que o gerador consome.
 */
const GENERATED_PAGES = Object.entries(content.pages).map(([name, page]) => ({
  name,
  path: page.path,
  canonical: page.url,
}));

describe("canônica das páginas públicas", () => {
  it.each(STATIC_PAGES)("$file declara a própria URL como canônica", ({ file, canonical }) => {
    expect(canonicalOf(read(file))).toBe(canonical);
  });

  it.each(GENERATED_PAGES)("$name tem URL própria, coerente com o caminho", ({ path: pagePath, canonical }) => {
    expect(canonical).toBe(`${SITE_ORIGIN}${pagePath}`);
  });

  it("nenhuma canônica aponta para o host com www", () => {
    for (const { file } of STATIC_PAGES) {
      const declared = canonicalOf(read(file)) ?? "";
      expect(declared.includes("www."), `${file} canonicaliza para www`).toBe(false);
    }
    for (const { name, canonical } of GENERATED_PAGES) {
      expect(canonical.includes("www."), `${name} canonicaliza para www`).toBe(false);
    }
  });

  it("toda URL do sitemap tem uma página que a declara como canônica", () => {
    const sitemap = read("public/sitemap.xml");
    const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

    expect(locations.length).toBeGreaterThan(0);

    // `?lang=en` é a mesma raiz com outro `<head>`, e a canônica dela é coberta
    // pelos testes de `buildSeoMetadata`.
    const semParametro = locations.filter((loc) => !loc.includes("?"));
    const declaradas = [
      ...STATIC_PAGES.map((page) => page.canonical),
      ...GENERATED_PAGES.map((page) => page.canonical),
    ];

    for (const loc of semParametro) {
      expect(declaradas, `${loc} está no sitemap e nenhuma página a declara`).toContain(loc);
    }
  });

  it("o sitemap não lista URL no host com www", () => {
    expect(read("public/sitemap.xml")).not.toContain("www.airia.pro");
  });

  /**
   * O gerador do `<head>` do livro depende de encontrar estas tags no
   * `index.html` para substituir. Se alguém remover uma delas da raiz, o build
   * falha na hora — mas falha só no build, e este teste dá o aviso antes.
   */
  it("o index.html tem as tags que o gerador do livro substitui", () => {
    const index = read("index.html");
    for (const tag of [
      '<meta property="og:image" content=',
      '<meta property="og:image:alt" content=',
      '<meta name="twitter:image" content=',
      '<link rel="alternate" hreflang="x-default"',
    ]) {
      expect(index, `o gerador precisa de ${tag}`).toContain(tag);
    }
  });
});
