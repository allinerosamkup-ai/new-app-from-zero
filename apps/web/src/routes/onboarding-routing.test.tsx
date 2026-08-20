import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const LEGACY_ROUTES = [
  "/onboarding",
  "/onboarding/guiado",
  "/onboarding/energy",
  "/onboarding/cycle",
  "/onboarding/sleep",
  "/onboarding/preferences",
  "/onboarding/done",
] as const;

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("canonical onboarding routing", () => {
  it.each(LEGACY_ROUTES)("redirects %s to /comecar", (legacyRoute) => {
    const appSource = source("src/App.tsx");
    const escaped = legacyRoute.replaceAll("/", "\\/");
    expect(appSource).toMatch(new RegExp(
      `path=["']${escaped}["'][^>]*element=\\{<Navigate to=["']\\/comecar["'] replace \\/>\\}`,
    ));
  });

  it("does not load or render any legacy onboarding screen", () => {
    const appSource = source("src/App.tsx");
    for (const component of [
      "OnboardingPage",
      "GuidedOnboardingPage",
      "OnboardingEnergyPage",
      "OnboardingCyclePage",
      "OnboardingSleepPage",
      "OnboardingPreferencesPage",
      "OnboardingDonePage",
    ]) {
      expect(appSource).not.toMatch(new RegExp(`\\b${component}\\b`));
    }
  });

  it("has no product caller that imperatively opens a legacy onboarding route", () => {
    for (const file of [
      "src/routes/aura-layout.tsx",
      "src/routes/aura-chat-page.tsx",
      "src/routes/routine-builder-page.tsx",
    ]) {
      const fileSource = source(file);
      expect(fileSource, file).not.toMatch(/navigate\(["']\/onboarding(?:\/[^"']*)?["']/);
    }
  });

  it("suppresses the prompt on both canonical and legacy onboarding paths", () => {
    const layoutSource = source("src/routes/aura-layout.tsx");
    expect(layoutSource).toContain("location.pathname.startsWith('/comecar')");
    expect(layoutSource).toContain("location.pathname.startsWith('/onboarding')");
  });

  it("uses one mandatory gate before every authenticated entry can reach Home", () => {
    const appSource = source("src/App.tsx");
    const layoutSource = source("src/routes/aura-layout.tsx");

    expect(appSource).toContain("function AuthenticatedProductEntry()");
    expect(appSource).toContain('return <Navigate to="/comecar" replace />;');
    expect(appSource).toContain('path="/auth/callback" element={<AuthenticatedProductEntry />}');
    expect(layoutSource).toContain("requiresMandatoryOnboarding(state)");
    expect(layoutSource).toContain('return <Navigate to="/comecar" replace />;');
  });
});
