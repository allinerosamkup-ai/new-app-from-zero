import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("first access home", () => {
  it("takes the completed onboarding directly to the first check-in, not an empty Home", () => {
    const onboardingSource = source("src/routes/story-onboarding-page.tsx");

    expect(onboardingSource).toContain('navigate("/checkin", { replace: true });');
    expect(onboardingSource).not.toContain('navigate("/home", { replace: true });');
  });

  it("shows the initial goal and a visible first-check-in CTA while no check-in exists", () => {
    const homeSource = source("src/routes/home-page.tsx");

    expect(homeSource).toContain("const firstCheckinPending = (state.checkinHistory || []).length === 0;");
    expect(homeSource).toContain("const firstActiveGoal = useMemo(");
    expect(homeSource).toContain('l("Fazer meu primeiro check-in", "Do my first check-in")');
    expect(homeSource).toContain('selectNextStep("checkin", "empty_state", "/checkin")');
  });

  it("opens the Today chart when the first check-in is recorded", () => {
    const homeSource = source("src/routes/home-page.tsx");

    expect(homeSource).toContain("const isFirstRecordedCheckin = (state.checkinHistory || []).length === 1;");
    expect(homeSource).toContain('setHomeChartMode("day");');
    expect(homeSource).toContain("setDayDetailsOpen(true);");
  });
});
