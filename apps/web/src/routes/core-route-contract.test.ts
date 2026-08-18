import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("core PWA route contract", () => {
  it("keeps the active product routes available", () => {
    const appSource = source("src/App.tsx");

    for (const path of ["/home", "/checkin", "/goals", "/insights", "/journal", "/aura", "/preferences"]) {
      expect(appSource).toContain(`path="${path}"`);
    }
  });

  it("redirects inactive module routes without loading their page chunks", () => {
    const appSource = source("src/App.tsx");

    for (const path of ["/habits", "/planner", "/pomodoro"]) {
      expect(appSource).toContain(`path="${path}" element={<Navigate to={FEATURE_FALLBACK_ROUTE} replace />}`);
    }

    for (const loader of ["loadHabitsPage", "loadPlannerPage", "loadPomodoroPage"]) {
      expect(appSource).not.toContain(loader);
    }
  });

  it("does not expose inactive module shortcuts on the Home", () => {
    const homeSource = source("src/routes/home-page.tsx");

    expect(homeSource).not.toContain('navigate("/habits")');
    expect(homeSource).not.toContain('navigate("/pomodoro")');
    expect(homeSource).not.toContain("HabitIdeasModal");
  });
});
