import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  computeDaysSinceLastCheckin,
  deriveExpressEmotion,
  mergeVoiceFactors,
  nearestQuickLevel,
  predictCheckinDefaults,
  type CheckinHistoryLike,
} from "./checkin-page.helpers";

function entry(date: string, humor: number, energia: number, checkinSlot?: string): CheckinHistoryLike {
  return { date, humor, energia, checkinSlot };
}

describe("nearestQuickLevel", () => {
  it("snaps to the closest quick level", () => {
    assert.equal(nearestQuickLevel(1), 2);
    assert.equal(nearestQuickLevel(5), 4);
    assert.equal(nearestQuickLevel(7), 6);
    assert.equal(nearestQuickLevel(9.6), 10);
  });

  it("falls back to neutral on invalid input", () => {
    assert.equal(nearestQuickLevel(Number.NaN), 6);
  });
});

describe("computeDaysSinceLastCheckin", () => {
  it("returns null without history", () => {
    assert.equal(computeDaysSinceLastCheckin([], "2026-06-12"), null);
  });

  it("returns 0 when there is a check-in today", () => {
    assert.equal(computeDaysSinceLastCheckin([entry("2026-06-12", 6, 6)], "2026-06-12"), 0);
  });

  it("counts the gap in days from the latest check-in", () => {
    const history = [entry("2026-06-05", 4, 4), entry("2026-06-09", 6, 6)];
    assert.equal(computeDaysSinceLastCheckin(history, "2026-06-12"), 3);
  });

  it("ignores future-dated entries", () => {
    const history = [entry("2026-06-20", 8, 8), entry("2026-06-10", 6, 6)];
    assert.equal(computeDaysSinceLastCheckin(history, "2026-06-12"), 2);
  });
});

describe("predictCheckinDefaults", () => {
  it("returns neutral defaults without history", () => {
    assert.deepEqual(predictCheckinDefaults([], "morning", "2026-06-12"), {
      humor: 6,
      energia: 6,
      source: "neutral",
    });
  });

  it("uses the median of the same slot when there is enough pattern", () => {
    const history = [
      entry("2026-06-11", 8, 8, "morning-0810"),
      entry("2026-06-10", 8, 6, "morning-0755"),
      entry("2026-06-09", 6, 6, "morning-0820"),
      entry("2026-06-09", 2, 2, "evening-2100"),
    ];
    const prediction = predictCheckinDefaults(history, "morning", "2026-06-12");
    assert.deepEqual(prediction, { humor: 8, energia: 6, source: "pattern" });
  });

  it("falls back to the most recent check-in within 7 days", () => {
    const history = [entry("2026-06-10", 3, 5, "evening-2030")];
    const prediction = predictCheckinDefaults(history, "morning", "2026-06-12");
    // empates no snap resolvem para o nível mais baixo (predição conservadora)
    assert.deepEqual(prediction, { humor: 2, energia: 4, source: "last" });
  });

  it("returns neutral when the history is too old", () => {
    const history = [entry("2026-05-01", 2, 2, "morning-0900")];
    const prediction = predictCheckinDefaults(history, "morning", "2026-06-12");
    assert.equal(prediction.source, "neutral");
  });
});

describe("deriveExpressEmotion", () => {
  it("maps high mood to radiant", () => {
    assert.equal(deriveExpressEmotion(10, 8), "radiant");
  });

  it("maps good mood with high energy to focused", () => {
    assert.equal(deriveExpressEmotion(8, 8), "focused");
  });

  it("maps medium mood with low energy to tired", () => {
    assert.equal(deriveExpressEmotion(6, 2), "tired");
  });

  it("maps low mood with low energy to exhausted", () => {
    assert.equal(deriveExpressEmotion(4, 2), "exhausted");
  });

  it("maps the lowest mood to sad", () => {
    assert.equal(deriveExpressEmotion(2, 6), "sad");
  });
});

describe("voice check-in context", () => {
  it("keeps existing factors and adds only new factors extracted from speech", () => {
    assert.deepEqual(
      mergeVoiceFactors(["sono ruim", "trabalho"], ["trabalho", "dor de cabeca"]),
      ["sono ruim", "trabalho", "dor de cabeca"],
    );
  });

});
