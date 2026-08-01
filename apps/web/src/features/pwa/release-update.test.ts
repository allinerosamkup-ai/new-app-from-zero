import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getReleaseNavigationUrl } from "./release-update";

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
});
