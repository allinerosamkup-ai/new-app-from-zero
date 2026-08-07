import { describe, expect, it } from "vitest";

import { ACTIVATION_ACTIONS, getActivationState } from "./activation";
import { initialAuraState } from "./data";
import type { AuraState } from "./types";

function makeState(overrides: Partial<AuraState> = {}): AuraState {
  return {
    ...initialAuraState,
    ...overrides,
  };
}

function makeGoal() {
  return {
    id: "g1",
    title: "Deixar a sala pronta para uso",
    category: "casa",
    completedPct: 0,
    subtasks: [],
  } as unknown as AuraState["goals"][number];
}

describe("activation state", () => {
  it("returns empty without check-ins, goals or journal entries", () => {
    const activation = getActivationState(makeState(), { now: new Date("2026-05-06T12:00:00") });

    expect(activation.activationLevel).toBe("empty");
    expect(activation.isNewUser).toBe(true);
    expect(activation.nextAction.id).toBe("checkin");
  });

  it("recommends check-in when no check-in exists", () => {
    const activation = getActivationState(makeState({
      goals: [makeGoal()],
    }));

    expect(activation.hasGoal).toBe(true);
    expect(activation.nextAction.route).toBe("/checkin");
  });

  it("recommends a goal after the first check-in when there is none", () => {
    const activation = getActivationState(makeState({
      checkinHistory: [{ date: "2026-05-06", humor: 6, energia: 5, emotion: "ok" }],
    }), { now: new Date("2026-05-06T12:00:00") });

    expect(activation.activationLevel).toBe("started");
    expect(activation.nextAction.id).toBe("goal");
    expect(activation.nextAction.route).toBe("/goals");
  });

  it("recommends journal when check-in and goal already exist", () => {
    const activation = getActivationState(makeState({
      checkinHistory: [{ date: "2026-05-06", humor: 6, energia: 5, emotion: "ok" }],
      goals: [makeGoal()],
    }), { now: new Date("2026-05-06T12:00:00") });

    expect(activation.activationLevel).toBe("calibrating");
    expect(activation.nextAction.id).toBe("journal");
  });

  it("never routes the first-run path to a removed feature", () => {
    const routes = Object.values(ACTIVATION_ACTIONS).map((action) => action.route);

    expect(routes).not.toContain("/planner");
    expect(routes).not.toContain("/habits");
  });

  it("does not mark check-in as done when today's check-in is missing", () => {
    const activation = getActivationState(makeState({
      checkinHistory: [{ date: "2026-05-05", humor: 6, energia: 5, emotion: "ok" }],
      goals: [makeGoal()],
    }), { now: new Date("2026-05-06T12:00:00") });

    expect(activation.hasCheckin).toBe(false);
    expect(activation.nextAction.id).toBe("checkin");
  });

  it("does not keep an active user in the first-run path", () => {
    const activation = getActivationState(makeState({
      onboardingDone: true,
      accountCreatedAt: "2026-04-01T12:00:00.000Z",
      checkinHistory: [
        { date: "2026-05-04", humor: 6, energia: 5, emotion: "ok" },
        { date: "2026-05-05", humor: 7, energia: 6, emotion: "bem" },
        { date: "2026-05-06", humor: 5, energia: 5, emotion: "neutra" },
      ],
      goals: [makeGoal()],
    }), {
      now: new Date("2026-05-06T12:00:00"),
      journalEntryCount: 1,
    });

    expect(activation.activationLevel).toBe("active");
    expect(activation.isNewUser).toBe(false);
    expect(activation.nextAction.id).toBe("explore");
  });
});
