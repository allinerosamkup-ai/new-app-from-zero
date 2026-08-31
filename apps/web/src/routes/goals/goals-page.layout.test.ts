import { describe, expect, it } from "vitest";

import { pickActiveWorkspaceGoal, readWideGoalsLayout } from "../../utils/goal-workspace";

describe("Goals master-detail selection", () => {
  it("keeps aria selection on an active goal and drops paused ids", () => {
    const active = [
      { id: "walk", title: "Caminhar" },
      { id: "desk", title: "Mesa" },
    ];
    expect(pickActiveWorkspaceGoal(active, "desk")?.id).toBe("desk");
    expect(pickActiveWorkspaceGoal(active, "walk")?.id).toBe("walk");
    expect(pickActiveWorkspaceGoal(active, "paused")?.id).toBe("walk");
  });

  it("treats a matching media query as wide on the first paint", () => {
    expect(readWideGoalsLayout({ matches: true })).toBe(true);
    expect(readWideGoalsLayout({ matches: false })).toBe(false);
  });
});
