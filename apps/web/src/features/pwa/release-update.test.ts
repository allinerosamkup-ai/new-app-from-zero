import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getReleaseNavigationUrl,
  navigateClientsToRelease,
} from "./release-update";

describe("getReleaseNavigationUrl", () => {
  it("does not navigate a client that is already on the current release", () => {
    expect(
      getReleaseNavigationUrl(
        "https://airia.pro/home?__airia_release=release-2",
        "release-2",
      ),
    ).toBeNull();
  });

  it("adds the current release to an unidentified client", () => {
    expect(
      getReleaseNavigationUrl("https://airia.pro/home", "release-2"),
    ).toBe("https://airia.pro/home?__airia_release=release-2");
  });

  it("replaces an older release while preserving route, query and hash", () => {
    expect(
      getReleaseNavigationUrl(
        "https://airia.pro/aura?source=pwa&__airia_release=release-1#message",
        "release-2",
      ),
    ).toBe(
      "https://airia.pro/aura?source=pwa&__airia_release=release-2#message",
    );
  });

  it("disables forced navigation when the build id is empty", () => {
    expect(
      getReleaseNavigationUrl("https://airia.pro/home?source=pwa", "  "),
    ).toBeNull();
  });

  it("updates every eligible client even when one navigation rejects", async () => {
    const navigated: string[] = [];
    const clients = [
      {
        url: "https://airia.pro/home?__airia_release=release-1",
        navigate: async () => {
          throw new Error("client closed during activation");
        },
      },
      {
        url: "https://airia.pro/aura?source=pwa",
        navigate: async (url: string) => {
          navigated.push(url);
        },
      },
      {
        url: "https://airia.pro/planner?__airia_release=release-2",
        navigate: async () => {
          throw new Error("current client must not navigate");
        },
      },
    ];

    await expect(
      navigateClientsToRelease(clients, "release-2"),
    ).resolves.toBeUndefined();
    expect(navigated).toEqual([
      "https://airia.pro/aura?source=pwa&__airia_release=release-2",
    ]);
  });

  it("keeps deep links available offline without intercepting API navigation", () => {
    const serviceWorkerSource = readFileSync(
      resolve(process.cwd(), "src/sw.ts"),
      "utf8",
    );

    expect(serviceWorkerSource).toContain("createHandlerBoundToURL('index.html')");
    expect(serviceWorkerSource).toContain("new NavigationRoute");
    expect(serviceWorkerSource).toContain("denylist: [/^\\/api\\//]");
    expect(serviceWorkerSource).toContain("await navigateClientsToRelease");
  });

  it("keeps the release-aware service worker as the only navigation authority", () => {
    const mainSource = readFileSync(
      resolve(process.cwd(), "src/main.tsx"),
      "utf8",
    );
    const viteConfigSource = readFileSync(
      resolve(process.cwd(), "vite.config.ts"),
      "utf8",
    );

    expect(mainSource).not.toContain("virtual:pwa-register");
    expect(mainSource).not.toContain("controllerchange");
    expect(mainSource).not.toContain("location.reload");
    expect(mainSource).not.toContain("updateSW");
    expect(viteConfigSource).toContain("injectRegister: false");
  });

  it("requires rollback, public gates and scoped immutable caching in production", () => {
    const deploySource = readFileSync(
      resolve(process.cwd(), "../../deploy/airia/deploy.sh"),
      "utf8",
    );
    const composeSource = readFileSync(
      resolve(process.cwd(), "../../deploy/airia/compose.yml"),
      "utf8",
    );
    const nginxSource = readFileSync(
      resolve(process.cwd(), "../../deploy/airia/nginx.conf"),
      "utf8",
    );

    expect(composeSource).toContain("image: airia-web:current");
    expect(composeSource).toContain("image: airia-backend:current");
    expect(deploySource).toContain("PREVIOUS_WEB_IMAGE=");
    expect(deploySource).toContain("PREVIOUS_BACKEND_IMAGE=");
    expect(deploySource).toContain("rollback_on_error()");
    expect(deploySource).toContain("trap rollback_on_error EXIT");
    expect(deploySource).toContain("DESTRUCTIVE_MIGRATION_PATTERN=");
    // A lista de rotas validadas cresce; o que não pode cair é a cobertura.
    // Casar a linha inteira travava a lista num tamanho fixo e quebrava a cada
    // rota nova — e a rota nova é justamente o que precisa de validação.
    for (const rota of ["/home", "/aura", "/sw.js", "/robots.txt", "/sitemap.xml", "/?lang=en"]) {
      expect(deploySource, `${rota} precisa ser validada no deploy`).toContain(rota);
    }
    expect(deploySource).toContain("for PUBLIC_PATH in");
    expect(deploySource).toContain("PUBLIC_SW=");
    expect(nginxSource).toContain("location ^~ /assets/");
    expect(nginxSource).toContain("location = /manifest.webmanifest");
    expect(nginxSource).toContain("location ^~ /icons/");
    expect(nginxSource).toContain("location ^~ /screenshots/");
    expect(nginxSource.match(/immutable/g)).toHaveLength(1);
  });
});
