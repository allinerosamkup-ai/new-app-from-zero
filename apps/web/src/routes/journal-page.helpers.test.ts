import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { buildJournalPlannerSlot } from "./journal-page.helpers.ts";

describe("journal page helpers", () => {
  it("never creates a zero-duration planner block at 20h", () => {
    const slot = buildJournalPlannerSlot({
      time: "20:00",
      dayOffset: 0,
      referenceDate: new Date(2026, 3, 12, 18, 0, 0),
    });

    assert.deepEqual(slot, {
      date: "2026-04-12",
      startTime: "19:00",
      endTime: "20:00",
    });
  });

  it("moves late journal suggestions for tomorrow into a morning slot", () => {
    const slot = buildJournalPlannerSlot({
      time: "21:30",
      dayOffset: 1,
      referenceDate: new Date(2026, 3, 12, 21, 0, 0),
    });

    assert.deepEqual(slot, {
      date: "2026-04-13",
      startTime: "09:00",
      endTime: "10:00",
    });
  });
});
