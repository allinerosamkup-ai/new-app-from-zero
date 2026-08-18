import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

const appRelease = process.env.VITE_APP_RELEASE?.trim() ?? "";

const releaseMetadataPlugin = (): Plugin => ({
  name: "airia-release-metadata",
  generateBundle() {
    this.emitFile({
      type: "asset",
      fileName: "release.json",
      source: `${JSON.stringify({ release: appRelease })}\n`,
    });
  },
});

export default defineConfig({
  plugins: [
    react(),
    releaseMetadataPlugin(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: false,
      // O SW navega clientes antigos para a release exata. O modo automático
      // também recarregaria no evento activated e poderia disputar essa navegação.
      registerType: 'prompt',
      includeAssets: ['icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        id: '/',
        name: 'Airia — Ciclagem de Humor',
        short_name: 'Airia',
        lang: 'pt-BR',
        dir: 'ltr',
        description: 'PWA da Airia para check-ins, objetivos, diário e leitura de padrões.',
        theme_color: '#FDF9F5',
        background_color: '#FDF9F5',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
        orientation: 'portrait',
        scope: '/',
        start_url: '/?source=pwa',
        prefer_related_applications: false,
        categories: ['health', 'lifestyle', 'productivity'],
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
        shortcuts: [
          {
            name: 'Hoje',
            short_name: 'Hoje',
            description: 'Ver o retrato e o próximo passo do seu dia',
            url: '/home',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }]
          },
          {
            name: 'Check-in',
            short_name: 'Check-in',
            description: 'Fazer meu check-in de humor e energia',
            url: '/checkin',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }]
          },
          {
            name: 'Diário',
            short_name: 'Diário',
            description: 'Conversar com a Airia no Journal',
            url: '/journal',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }]
          },
          {
            name: 'Padrões',
            short_name: 'Padrões',
            description: 'Explorar padrões a partir dos seus check-ins',
            url: '/insights',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }]
          }
        ],
        screenshots: [
          { src: '/screenshots/home-page.png', sizes: '390x844', type: 'image/png', form_factor: 'narrow', label: 'Home — Ciclagem de Humor' },
          { src: '/screenshots/checkin-page.png', sizes: '390x844', type: 'image/png', form_factor: 'narrow', label: 'Check-in Diário' },
          { src: '/screenshots/insights-page.png', sizes: '390x844', type: 'image/png', form_factor: 'narrow', label: 'Analytics & Insights' },
          { src: '/screenshots/aura-page.png', sizes: '390x844', type: 'image/png', form_factor: 'narrow', label: 'Airia — próximo passo' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Impede que o SW sirva index.html (SPA fallback) para rotas /api/
        // Isso é CRÍTICO para o OAuth callback do Google Calendar funcionar
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  define: {
    "import.meta.env.VITE_APP_RELEASE": JSON.stringify(appRelease),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    entries: ['index.html'],
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (
            id.includes("react-router") ||
            id.includes("\\react\\") ||
            id.includes("\\react-dom\\") ||
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("scheduler")
          ) {
            return "vendor-framework";
          }

          if (id.includes("@supabase/") || id.includes("tslib")) {
            return "vendor-supabase";
          }

          if (id.includes("lucide-react")) {
            return "vendor-icons";
          }

          return "vendor-shared";
        },
      },
    },
  },
  server: {
    port: Number(process.env.PORT) || 5051,
    strictPort: false,
    allowedHosts: [".manus.computer"],
  }
});
