import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { resolveUnlockedNav } from "./nav-access.helpers";

describe("resolveUnlockedNav", () => {
  it("shows only essentials for a brand-new user", () => {
    const unlocked = resolveUnlockedNav({ checkinCount: 0, isNewUser: true });
    assert.deepEqual([...unlocked].sort(), ["aura", "home", "journal"]);
  });

  it("unlocks the planner after the first check-in", () => {
    const unlocked = resolveUnlockedNav({ checkinCount: 1, isNewUser: true });
    assert.equal(unlocked.has("planner"), true);
    assert.equal(unlocked.has("insights"), false);
  });

  it("unlocks patterns after three check-ins", () => {
    const unlocked = resolveUnlockedNav({ checkinCount: 3, isNewUser: true });
    assert.equal(unlocked.has("insights"), true);
    assert.equal(unlocked.has("planner"), true);
  });

  it("shows everything for an established user regardless of count", () => {
    const unlocked = resolveUnlockedNav({ checkinCount: 0, isNewUser: false });
    assert.deepEqual([...unlocked].sort(), ["aura", "home", "insights", "journal", "planner"]);
  });
});
