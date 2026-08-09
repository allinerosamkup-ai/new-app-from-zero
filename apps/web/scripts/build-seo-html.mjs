#!/usr/bin/env node
/**
 * Gera `dist/index.en.html` — a mesma aplicação, com o `<head>` em inglês.
 *
 * O SEO em tempo de execução (`src/lib/seo.ts`) resolve o Google, que executa
 * JavaScript. **Não resolve prévia de link:** WhatsApp, Slack, iMessage e X
 * leem o HTML cru e vão embora. Sem isto, um link em inglês compartilhado por
 * uma pessoa que usa o app em inglês se apresenta em português.
 *
 * A alternativa seria renderizar no servidor, o que troca a arquitetura inteira
 * por causa de sete tags. Aqui o nginx serve este arquivo quando a URL tem
 * `?lang=en`, e o resto da aplicação é byte a byte a mesma — mesmos assets,
 * mesmo bundle, mesma hidratação.
 *
 * O texto vem de `src/lib/seo-content.json`, o mesmo arquivo que o app lê. Uma
 * segunda cópia aqui divergiria em silêncio na primeira alteração de copy.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const content = JSON.parse(readFileSync(path.join(webRoot, 'src/lib/seo-content.json'), 'utf8'));
const en = content.languages.en;
const pt = content.languages.pt;

const source = path.join(webRoot, 'dist/index.html');
const target = path.join(webRoot, 'dist/index.en.html');

let html = readFileSync(source, 'utf8');

/**
 * Cada troca é verificada.
 *
 * Substituição silenciosa que não casa é o modo clássico deste tipo de script
 * apodrecer: alguém edita o `index.html`, o padrão para de bater, e o arquivo
 * em inglês continua sendo gerado — com o conteúdo em português dentro.
 */
function replace(pattern, replacement, label) {
  if (!pattern.test(html)) {
    console.error(`ERRO: não encontrei ${label} em dist/index.html`);
    console.error('O index.html mudou e este gerador ficou para trás. Corrija antes de publicar.');
    process.exit(1);
  }
  html = html.replace(pattern, replacement);
}

replace(/<html lang="[^"]*"/, `<html lang="${en.htmlLang}"`, '<html lang>');
replace(/<title>[^<]*<\/title>/, `<title>${en.title}</title>`, '<title>');
replace(
  /<meta name="description" content="[^"]*"/,
  `<meta name="description" content="${en.description}"`,
  'meta description',
);
replace(
  /<meta name="keywords" content="[^"]*"/,
  `<meta name="keywords" content="${en.keywords}"`,
  'meta keywords',
);
replace(
  /<link rel="canonical" href="[^"]*"/,
  `<link rel="canonical" href="${en.url}"`,
  'canonical',
);
replace(
  /<meta property="og:title" content="[^"]*"/,
  `<meta property="og:title" content="${en.title}"`,
  'og:title',
);
replace(
  /<meta property="og:description" content="[^"]*"/,
  `<meta property="og:description" content="${en.shortDescription}"`,
  'og:description',
);
replace(
  /<meta property="og:image:alt" content="[^"]*"/,
  `<meta property="og:image:alt" content="${en.imageAlt}"`,
  'og:image:alt',
);
replace(
  /<meta property="og:url" content="[^"]*"/,
  `<meta property="og:url" content="${en.url}"`,
  'og:url',
);
replace(
  /<meta property="og:locale" content="[^"]*"/,
  `<meta property="og:locale" content="${en.ogLocale}"`,
  'og:locale',
);
replace(
  /<meta property="og:locale:alternate" content="[^"]*"/,
  `<meta property="og:locale:alternate" content="${pt.ogLocale}"`,
  'og:locale:alternate',
);
replace(
  /<meta name="twitter:title" content="[^"]*"/,
  `<meta name="twitter:title" content="${en.title}"`,
  'twitter:title',
);
replace(
  /<meta name="twitter:description" content="[^"]*"/,
  `<meta name="twitter:description" content="${en.shortDescription}"`,
  'twitter:description',
);

// Dados estruturados: bloco inteiro, para não depender do formato interno.
const structured = JSON.stringify(
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Airia',
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Web, iOS, Android',
    url: en.url,
    description: en.description,
    inLanguage: en.htmlLang,
    image: content.image,
    offers: { '@type': 'Offer', price: '0', priceCurrency: en.currency },
    author: { '@type': 'Organization', name: 'Airia', url: content.origin },
  },
  null,
  2,
);
replace(
  /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
  `<script type="application/ld+json">\n${structured}\n    </script>`,
  'JSON-LD',
);

// Rede final: nenhum texto em português pode sobreviver no head em inglês.
const head = html.slice(0, html.indexOf('</head>'));
for (const marca of [pt.title, pt.description, pt.shortDescription, pt.keywords]) {
  if (head.includes(marca)) {
    console.error('ERRO: texto em português sobreviveu no head em inglês.');
    console.error(`Trecho: ${marca.slice(0, 60)}...`);
    process.exit(1);
  }
}

writeFileSync(target, html);
console.log(`dist/index.en.html gerado (${(html.length / 1024).toFixed(1)} KB)`);
