# SEO — airia.pro

*Objetivo: ranquear orgânico em PT-BR pra termos de baixa e média cauda*
*Prioridade: neurodivergência + humor + ciclagem + TDAH*

---

## Meta tags — implementar em `apps/web/index.html`

```html
<!-- Primary -->
<title>Energy Mood — Um lugar seguro para sua mente aterrissar | airia.pro</title>
<meta name="description" content="App de ciclagem de humor para TDAH, ciclotimia e mentes não-lineares. Check-in de 30s, IA que acolhe (Airia), e planner que se adapta ao seu ritmo real. Grátis pra começar." />

<!-- Keywords strategic (não é mais ranking factor forte, mas ajuda crawlers) -->
<meta name="keywords" content="humor, ciclagem de humor, TDAH, ciclotimia, neurodivergência, diário com IA, planner para TDAH, mood tracker brasileiro, saúde mental app, bipolar tipo II" />

<!-- Open Graph (Facebook, WhatsApp, LinkedIn) -->
<meta property="og:type" content="website" />
<meta property="og:url" content="https://airia.pro/" />
<meta property="og:title" content="Energy Mood — Onde seu ritmo é respeitado, não corrigido" />
<meta property="og:description" content="O primeiro app de bio-sincronia para mentes não-lineares. 30 segundos por dia. A Airia cuida do resto." />
<meta property="og:image" content="https://airia.pro/og-image-1200x630.png" />
<meta property="og:locale" content="pt_BR" />
<meta property="og:site_name" content="Energy Mood · Airia" />

<!-- Twitter / X -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:url" content="https://airia.pro/" />
<meta name="twitter:title" content="Energy Mood — Um lugar seguro para sua mente aterrissar" />
<meta name="twitter:description" content="Ciclagem de humor com IA que acolhe. Feito pra TDAH, ciclotimia e neurodivergentes." />
<meta name="twitter:image" content="https://airia.pro/og-image-1200x630.png" />

<!-- Search-specific -->
<link rel="canonical" href="https://airia.pro/" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<meta name="language" content="Portuguese" />
<meta name="geo.region" content="BR" />

<!-- PWA -->
<meta name="theme-color" content="#FAF8F5" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Airia" />
<meta name="application-name" content="Energy Mood" />
<link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192.png" />
<link rel="apple-touch-icon" sizes="167x167" href="/icons/icon-192.png" />
<link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-192.png" />
```

---

## Schema.org JSON-LD — adicionar em `<head>`

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Energy Mood",
  "alternateName": "Airia",
  "description": "App de ciclagem de humor para mentes não-lineares. Check-in diário de 30s + IA que acolhe.",
  "applicationCategory": "HealthApplication",
  "operatingSystem": "iOS, Android, Web",
  "url": "https://airia.pro/",
  "offers": [
    {
      "@type": "Offer",
      "name": "Grátis",
      "price": "0",
      "priceCurrency": "BRL"
    },
    {
      "@type": "Offer",
      "name": "Premium mensal",
      "price": "29.00",
      "priceCurrency": "BRL"
    }
  ],
  "inLanguage": "pt-BR",
  "creator": {
    "@type": "Organization",
    "name": "Airia",
    "url": "https://airia.pro/"
  }
}
</script>
```

---

## Palavras-chave alvo — 3 tiers

### Tier 1 — Intenção comercial alta (focar primeiro)

| Keyword | Volume (est.) | Dificuldade | Onde otimizar |
|---------|---------------|-------------|---------------|
| app para TDAH brasileiro | 1.2K/mês | média | splash + blog |
| mood tracker em português | 800/mês | baixa | splash |
| app de humor com IA | 600/mês | baixa | splash |
| planner para TDAH | 3.5K/mês | alta | blog dedicado |
| diário com inteligência artificial | 1.5K/mês | média | landing Airia |

### Tier 2 — Intenção informacional (blog content)

- "o que é ciclotimia e como conviver"
- "diferença entre bipolar tipo 1 e 2"
- "como rastrear humor com TDAH"
- "por que não consigo manter planner"
- "ciclo de humor explicado"
- "bio-sincronia o que é"

### Tier 3 — Long-tail emocional (posts de Instagram/Pinterest)

- "me sinto quebrada sem motivo"
- "tô com agitação no peito sem razão"
- "por que caio sem aviso"
- "como entender meu ritmo neurodivergente"

---

## Sitemap.xml (gerar em build)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://airia.pro/</loc>
    <lastmod>2026-04-18</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://airia.pro/auth</loc>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://airia.pro/airia</loc>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://airia.pro/mood-cycle-engine</loc>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://airia.pro/para-tdah</loc>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://airia.pro/para-ciclotimia</loc>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://airia.pro/blog/</loc>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://airia.pro/privacidade</loc>
    <priority>0.3</priority>
  </url>
</urlset>
```

---

## robots.txt

```
User-agent: *
Allow: /
Disallow: /auth/
Disallow: /home
Disallow: /checkin
Disallow: /journal
Disallow: /planner
Disallow: /insights
Disallow: /goals
Disallow: /pomodoro
Disallow: /config
Disallow: /api/

Sitemap: https://airia.pro/sitemap.xml
```

Razão: só expomos páginas públicas pro Google. Rotas autenticadas ficam fora do índice.

---

## Landing pages de nicho (criar em sequência)

### 1. `/para-tdah` — "Energy Mood para TDAH"

**H1:** "O planner que respeita seu ritmo real — não o ideal."
**Sub:** "Mentes com TDAH não funcionam em linha reta. Energy Mood é o primeiro app que trata isso como feature, não bug."
**Conteúdo:** explicação da bio-sincronia + prints + depoimentos de usuárias TDAH.

### 2. `/para-ciclotimia` — "Energy Mood para ciclotimia e bipolar II"

**H1:** "Sua energia não é o problema. Sua sincronia é."
**Sub:** "Bio-previsibilidade pra quem vive picos e vales — com respeito, sem diagnóstico."
**Conteúdo:** Mood Cycle Engine em detalhe + como prevê fase hipomaníaca ou esgotamento.

### 3. `/airia` — "Conheça a Airia"

**H1:** "Não é chatbot. É presença."
**Sub:** "A IA que lê sua fase antes de cada resposta."
**Conteúdo:** demonstração com áudio ElevenLabs + conversa real (anonimizada).

### 4. `/mood-cycle-engine` — Página técnica de autoridade

**H1:** "Como o Mood Cycle Engine detecta suas fases."
**Sub:** "Transparência total: EWMA + desvio padrão + tendência de 7 dias."
**Objetivo:** rankear pra "algoritmo de humor" e ganhar confiança de público técnico.

---

## Blog — 10 primeiros posts (pauta)

1. **"Ciclagem de humor vs mudanças de humor: qual a diferença?"** — educacional, alto volume.
2. **"Por que planners tradicionais falham com TDAH (e o que fazer sobre isso)"** — dor forte, conversão alta.
3. **"O que é bio-sincronia e por que neurodivergentes precisam dela"** — autoridade de nicho.
4. **"8 fases de humor: onde você está hoje?"** — gera engajamento.
5. **"Ciclo menstrual e produtividade: o que ninguém te contou"** — SEO alto, polêmica controlada.
6. **"Como eu parei de me sentir culpada nos meus dias baixos"** — first-person, gera compartilhamento.
7. **"Terapia + app: por que os dois se complementam"** — tira objeção ("já faço terapia").
8. **"Streak é a pior coisa que apps de bem-estar fizeram"** — opinião forte, vai viralizar no nicho.
9. **"O que a Airia é e o que ela NÃO é"** — gerenciar expectativa.
10. **"30 dias de dados: o que meu ciclo emocional me mostrou"** — case study da Alline ou beta user.

---

## Backlinks — onde buscar autoridade

**Prioridade alta (nichos):**
- Canais TDAH Brasil (blogs, YouTube)
- Podcasts de saúde mental (Cabeça Feita, Autoconsciente)
- Influenciadoras neurodivergentes no Instagram
- Comunidades Reddit: r/tdahbrasil, r/ciclotimia

**Prioridade média:**
- Mídia tech (Canaltech, Tecmundo) — ângulo "1º app brasileiro de bio-sincronia"
- Product Hunt launch (PT + EN) — audience global
- Portais de bem-estar (Vida Simples, Greenme)

**Prioridade baixa (cuidado):**
- Sites de "ranking de apps" — mancham o brand se aparecer com apps de baixa qualidade.

---

## Core Web Vitals — mínimo aceitável

| Métrica | Alvo | Atual (a medir) |
|---------|------|-----------------|
| LCP | < 2.5s | ? |
| FID | < 100ms | ? |
| CLS | < 0.1 | ? |
| INP | < 200ms | ? |

Rodar `lighthouse airia.pro` antes de indexar pesado.

---

## Checklist rápido pra ativar

- [ ] Substituir meta tags no [index.html](apps/web/index.html)
- [ ] Adicionar JSON-LD schema
- [ ] Gerar `og-image-1200x630.png` com copy "Um lugar seguro para sua mente aterrissar"
- [ ] Criar `sitemap.xml` + `robots.txt` em `apps/web/public/`
- [ ] Submeter ao Google Search Console
- [ ] Submeter ao Bing Webmaster Tools
- [ ] Ativar Plausible ou GA4 em `airia.pro`
- [ ] Verificar Core Web Vitals antes de disparar campanhas
