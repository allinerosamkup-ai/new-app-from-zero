# Estratégia Dual Platform — PWA + APK

## Visão geral

Airia é distribuída por 3 canais:

- **PWA iOS**: Safari no iPhone → "Adicionar à Tela Inicial" → roda standalone
- **PWA Android**: Chrome no Android → "Instalar app" (via `beforeinstallprompt`) — fallback
- **APK Android**: download direto via `airia.pro` splash → instalação nativa (ideal para usuários "power")

## Por que PWA é primário

- iOS **não** permite apps nativos fora da App Store sem revisão/custo. PWA é o único caminho viável.
- Android PWA funciona bem no Chrome, mas a UX nativa é melhor via APK.

## Fluxos de instalação

### iOS (Safari)

1. Usuário abre `airia.pro/splash` no Safari
2. Splash detecta iOS via `userAgent` → mostra botão **"Instalar no iPhone"**
3. Botão abre modal com 3 passos: Compartilhar ⬆ → Adicionar à Tela de Início → Adicionar
4. Ícone aparece na home screen; abre em modo `standalone` com status bar translúcida (`black-translucent`)

### Android

Duas rotas — usuário escolhe via CTA:

**A. APK (preferido):**

1. Splash detecta Android → botão **"Baixar APK Android"**
2. Link aponta para `VITE_APK_URL` (env var apontando para o artefato hospedado pela Expo EAS)
3. Usuário baixa, permite "instalação de fontes desconhecidas", instala

**B. PWA fallback:**

1. Se `VITE_APK_URL` não estiver definido, o CTA usa o evento `beforeinstallprompt` do Chrome
2. Chrome oferece instalação via popup nativo

### Desktop

1. Splash mostra "Abra airia.pro no seu celular" + orientação para instalar
2. Usuário Chrome/Edge pode instalar via ícone na barra de URL

## Como gerar APK novo

```bash
cd apps/mobile
npx eas login           # uma vez, autenticar com conta Expo
npm run build:apk       # inicia build na infra Expo (~10-15 min)
```

Ao final, EAS retorna URL tipo `https://expo.dev/artifacts/eas/<hash>.apk`.

Cole essa URL em:

- `apps/web/.env.production` → variável `VITE_APK_URL`
- Rebuild do web (`cd apps/web && npm run build`) para o frontend pegar a env var nova
- Deploy do web via pipeline normal (Docker Compose)

## Manutenção

### Quando atualizar o APK?

- Bugs críticos no app mobile
- Nova feature que exige código nativo (notificações push avançadas, biometria, câmera, etc.)
- A cada release maior da stack mobile (mensal/bimestral)

### Como testar

- **PWA iOS**: iPhone físico ou simulador Xcode com Safari (devtools via Mac)
- **PWA Android**: Chrome Android ou Chrome desktop em modo device emulation
- **APK**: emulador Android Studio ou device físico — habilitar "fontes desconhecidas" para instalar fora da Play Store

## Arquivos relevantes

- `apps/web/src/components/InstallCTA.tsx` — lógica de detecção e CTA platform-aware
- `apps/web/vite.config.ts` — manifest PWA (display, display_override, orientation, lang)
- `apps/web/index.html` — meta tags iOS (status-bar-style, apple-touch-icon multi-size)
- `apps/web/src/styles/globals.css` — classe `.app-viewport` (mobile-frame de 480px)
- `apps/mobile/app.json` — bundleIdentifier e package name (`pro.airia.app`)
- `apps/mobile/eas.json` — build profiles (`preview` → APK, `production` → AAB para Play Store)

## Identificadores

- Domínio: `airia.pro`
- iOS bundleIdentifier: `pro.airia.app`
- Android package: `pro.airia.app`
- Expo slug: `airia`

## Decisões de design

- Frame mobile (`max-width: 480px` via `.app-viewport`) é forçado em qualquer viewport — PWA sempre parece mobile, mesmo em desktop, porque a coluna fica centrada com fundo decorativo nas laterais.
- `display: 'standalone'` + `display_override: ['standalone', 'minimal-ui']` → UX de app nativo com fallback gracioso.
- `apple-mobile-web-app-status-bar-style: black-translucent` → status bar iOS sobre o conteúdo (mais imersivo no PWA).
- Multi-size `apple-touch-icon` (180/167/152/120) → cobre iPhone, iPad Pro, iPad legado e iPhone antigo.
- APK identifier `pro.airia.app` segue padrão Android (domínio invertido).

## Roadmap futuro

- Submeter AAB à Play Store quando UX mobile estiver estável (`npm run build:aab` no apps/mobile)
- Avaliar TestFlight/IPA via `npm run build:ios` se decidirmos publicar PWA wrapper iOS na App Store
- Monitor: Web Push (VAPID) já funciona em PWA Android e desktop; iOS Safari só suporta Web Push em PWAs adicionados à tela inicial (iOS 16.4+)
