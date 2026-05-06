import { describe, expect, it } from "vitest";

import { getActivationState } from "./activation";
import { initialAuraState } from "./data";
import type { AuraState } from "./types";

function makeState(overrides: Partial<AuraState> = {}): AuraState {
  return {
    ...initialAuraState,
    ...overrides,
  };
}

describe("activation state", () => {
  it("returns empty without check-ins, planner items or journal entries", () => {
    const activation = getActivationState(makeState(), { now: new Date("2026-05-06T12:00:00") });

    expect(activation.activationLevel).toBe("empty");
    expect(activation.isNewUser).toBe(true);
    expect(activation.nextAction.id).toBe("checkin");
  });

  it("recommends check-in when no check-in exists", () => {
    const activation = getActivationState(makeState({
      tasks: [{ id: "t1", title: "Responder Ana", time: "10:00", done: false }],
    }));

    expect(activation.hasPlannerItem).toBe(true);
    expect(activation.nextAction.route).toBe("/checkin");
  });

  it("recommends planner after the first check-in when agenda is empty", () => {
    const activation = getActivationState(makeState({
      checkinHistory: [{ date: "2026-05-06", humor: 6, energia: 5, emotion: "ok" }],
    }));

    expect(activation.activationLevel).toBe("started");
    expect(activation.nextAction.id).toBe("planner");
  });

  it("recommends journal when check-in and planner already exist", () => {
    const activation = getActivationState(makeState({
      checkinHistory: [{ date: "2026-05-06", humor: 6, energia: 5, emotion: "ok" }],
      tasks: [{ id: "t1", title: "Montar roteiro", time: "15:00", done: false }],
    }));

    expect(activation.activationLevel).toBe("calibrating");
    expect(activation.nextAction.id).toBe("journal");
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
      tasks: [{ id: "t1", title: "Revisar agenda", time: "11:00", done: false }],
    }), {
      now: new Date("2026-05-06T12:00:00"),
      journalEntryCount: 1,
    });

    expect(activation.activationLevel).toBe("active");
    expect(activation.isNewUser).toBe(false);
    expect(activation.nextAction.id).toBe("explore");
  });
});
