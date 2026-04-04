import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
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
  plugins: [react(), addComponentDataPlugin()],
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
    port: 5051,
    strictPort: true,
    open: true,
  }
});
