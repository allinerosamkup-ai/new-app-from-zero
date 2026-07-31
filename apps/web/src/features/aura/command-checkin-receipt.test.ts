import { describe, expect, it } from "vitest";

import { checkinReceiptFromExecution, shouldRenderCommandPlan } from "./command-checkin-receipt";

describe("command check-in receipt", () => {
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
