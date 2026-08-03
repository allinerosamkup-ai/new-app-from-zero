import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { resolveUnlockedNav } from "./nav-access.helpers";

describe("resolveUnlockedNav", () => {
  it("shows only essentials for a brand-new user", () => {
    // Objetivos entra no essencial: é o núcleo do app, e esperar check-in para
    // deixar a pessoa criar uma meta não faz sentido.
    const unlocked = resolveUnlockedNav({ checkinCount: 0, isNewUser: true });
    assert.deepEqual([...unlocked].sort(), ["aura", "goals", "home", "journal"]);
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
    // "planner" continua aqui de propósito: quem esconde é config/features.ts,
    // não este helper. Assim religar não exige mexer nas regras de destrave.
    const unlocked = resolveUnlockedNav({ checkinCount: 0, isNewUser: false });
    assert.deepEqual([...unlocked].sort(), ["aura", "goals", "home", "insights", "journal", "planner"]);
  });
});
