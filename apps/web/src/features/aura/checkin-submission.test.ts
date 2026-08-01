import { describe, expect, it } from "vitest";

import { buildCheckinSubmission } from "./checkin-submission";

describe("manual check-in submission", () => {
  it("does not invent optional neutral signals", () => {
    const payload = buildCheckinSubmission({
      localDate: "2026-07-31",
      checkinSlot: "morning",
      entry: { humor: 3, energia: 3, emotion: "sad" },
    });
    expect(payload).not.toHaveProperty("clarityScore");
    expect(payload).not.toHaveProperty("irritabilityScore");
    expect(payload).not.toHaveProperty("physicalScore");
    expect(payload).not.toHaveProperty("socialScore");
  });

  it("keeps sleep hours separate from the optional sleep score", () => {
    const payload = buildCheckinSubmission({
      localDate: "2026-07-31",
      checkinSlot: "morning",
      entry: { humor: 6, energia: 5, emotion: "calm", sleepHours: 7.5 },
    });
    expect(payload.sleepHours).toBe(7.5);
    expect(payload).not.toHaveProperty("sleepScore");
  });

  it("never turns an older journal draft into the check-in note", () => {
    const payload = buildCheckinSubmission({
      localDate: "2026-08-01",
      checkinSlot: "morning",
      entry: { humor: 3, energia: 7, emotion: "angry" },
    });

    expect(payload).not.toHaveProperty("note");
  });
});
