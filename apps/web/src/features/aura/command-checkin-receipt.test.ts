import { describe, expect, it } from "vitest";

import { checkinReceiptFromExecution, shouldRenderCommandPlan } from "./command-checkin-receipt";

describe("command check-in receipt", () => {
  it("preserves failed analysis and safety from an applied check-in", () => {
    const receipt = checkinReceiptFromExecution({ planId: "p", status: "applied", operations: [{ id: "op", type: "record_checkin", status: "applied", result: { checkinId: "c", moodScore: 2, energyScore: 2, analysisStatus: "unavailable", riskSafety: { route: "human_support" } } }] });
    expect(receipt?.analysisStatus).toBe("unavailable");
    expect(receipt?.riskSafety?.route).toBe("human_support");
  });
  it("does not render an empty plan", () => {
    expect(shouldRenderCommandPlan({ operations: [] })).toBe(false);
    expect(shouldRenderCommandPlan({ operations: [{ id: "one" }] })).toBe(true);
  });

  it("uses the persisted execution receipt", () => {
    const receipt = checkinReceiptFromExecution({
      planId: "plan-1",
      status: "applied",
      operations: [{
        id: "checkin-op-1",
        type: "record_checkin",
        status: "applied",
        result: {
          checkinId: "checkin-1",
          moodScore: 3,
          energyScore: 3,
          stateLabel: "Energia protegida",
          stateSummary: "Hoje pede carga menor.",
        },
      }],
    });
    expect(receipt).toEqual({
      checkinId: "checkin-1",
      moodScore: 3,
      energyScore: 3,
      stateLabel: "Energia protegida",
      stateSummary: "Hoje pede carga menor.",
    });
  });
});
