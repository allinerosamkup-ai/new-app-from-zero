import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

const addComponentDataPlugin = () => {
  return {
    name: 'previewbridge-component-data',
    transformIndexHtml(html) {
      return html.replace('</body>', `
        <script src="https://html2canvas.hertzen.com/dist/html2canvas.min.js"></script>
        <script>
          window.previewErrors = [];
          window.addEventListener('error', (e) => window.previewErrors.push(e.message));
          window.addEventListener('message', async (event) => {
            if (event.data && event.data.command === 'focusComponent') {
              const el = document.querySelector('[data-component="' + event.data.componentName + '"]');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const oldOutline = el.style.outline;
                el.style.outline = '3px solid #ff00ff';
                setTimeout(() => el.style.outline = oldOutline, 2000);
              }
            }
            if (event.data && event.data.command === 'takeScreenshot') {
              try {
                // Wait for any animations to finish
                setTimeout(async () => {
                  const canvas = await window.html2canvas(document.body, { useCORS: true, allowTaint: true });
                  window.parent.postMessage({ command: 'screenshotResult', data: canvas.toDataURL('image/jpeg', 0.8) }, '*');
                }, 500);
              } catch(e) {
                window.parent.postMessage({ command: 'screenshotResult', data: '' }, '*');
              }
            }
            if (event.data && event.data.command === 'getErrors') {
              window.parent.postMessage({ command: 'errorsResult', errors: window.previewErrors }, '*');
            }
          });
        </script>
      </body>`);
    },
    transform(code: string, id: string) {
      // Basic heuristic: inject data-component attribute into JSX/TSX
      if (id.endsWith('.jsx') || id.endsWith('.tsx')) {
        return code.replace(/(function\s+([A-Z][a-zA-Z0-9]*)\s*\([^)]*\)\s*\{\s*(?:return\s+)?<([a-zA-Z0-9]+)(\s|>))/g, (match, p1, p2, p3, p4) => {
            return match.replace('<' + p3, `<${p3} data-component="${p2}"`);
        });
      }
      return null;
    }
  };
};

export default defineConfig({
  plugins: [
    react(),
    addComponentDataPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Airia — Ciclagem de Humor',
        short_name: 'Airia',
        description: 'Seu assistente pessoal de ciclagem de humor. Entenda seus padrões, preveja suas fases.',
        theme_color: '#F4A896',
        background_color: '#FDF9F5',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
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
            name: 'Abrir Airia',
            short_name: 'Chat Airia',
            description: 'Conversar com a inteligência central da Airia',
            url: '/aura',
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
            name: 'Planner',
            short_name: 'Planner',
            description: 'Ver meu planner de energia',
            url: '/planner',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }]
          }
        ],
        screenshots: [
          { src: '/screenshots/home-page.png', sizes: '390x844', type: 'image/png', form_factor: 'narrow', label: 'Home — Ciclagem de Humor' },
          { src: '/screenshots/checkin-page.png', sizes: '390x844', type: 'image/png', form_factor: 'narrow', label: 'Check-in Diário' },
          { src: '/screenshots/insights-page.png', sizes: '390x844', type: 'image/png', form_factor: 'narrow', label: 'Analytics & Insights' },
          { src: '/screenshots/planner-page.png', sizes: '390x844', type: 'image/png', form_factor: 'narrow', label: 'Planner de Energia' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Impede que o SW sirva index.html (SPA fallback) para rotas /api/
        // Isso é CRÍTICO para o OAuth callback do Google Calendar funcionar
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
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
    port: 5173,
    strictPort: false,
  }
});
