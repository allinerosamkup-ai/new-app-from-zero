import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { computeMoodCycle } from "./mood-cycle-engine";
import type { CheckinEntry } from "../features/aura/types";

function makeHistory(
  startDate: Date,
  scores: Array<{ humor: number; energia: number }>,
): CheckinEntry[] {
  return scores.map((score, index) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + index);
    return {
      date: date.toISOString().slice(0, 10),
      humor: score.humor,
      energia: score.energia,
      emotion: "calm",
    };
  });
}

describe("mood cycle engine", () => {
  it("classifies the same recent values differently when the baseline changes", () => {
    const recent = [
      { humor: 6, energia: 6 },
      { humor: 6, energia: 6 },
      { humor: 6, energia: 6 },
    ];

    const highBaselineHistory = makeHistory(new Date(2026, 3, 1), [
      ...Array.from({ length: 8 }, () => ({ humor: 9, energia: 9 })),
      ...recent,
    ]);
    const lowBaselineHistory = makeHistory(new Date(2026, 3, 1), [
      ...Array.from({ length: 8 }, () => ({ humor: 3, energia: 3 })),
      ...recent,
    ]);

    const highBaselineReport = computeMoodCycle(highBaselineHistory);
    const lowBaselineReport = computeMoodCycle(lowBaselineHistory);

    assert.notEqual(highBaselineReport.phaseLabel, lowBaselineReport.phaseLabel);
    assert.ok(
      ["Em queda", "Atenção"].includes(highBaselineReport.phaseLabel),
      `expected a lower band for the high-baseline history, got ${highBaselineReport.phaseLabel}`,
    );
    assert.ok(
      ["Fluindo", "Em alta"].includes(lowBaselineReport.phaseLabel),
      `expected a higher band for the low-baseline history, got ${lowBaselineReport.phaseLabel}`,
    );
  });

  it("raises a sustained low warning when the recent pattern stays below the baseline", () => {
    const history = makeHistory(new Date(2026, 3, 1), [
      ...Array.from({ length: 7 }, () => ({ humor: 8, energia: 8 })),
      { humor: 4, energia: 4 },
      { humor: 4, energia: 4 },
      { humor: 3, energia: 3 },
      { humor: 3, energia: 3 },
    ]);

    const report = computeMoodCycle(history);

    assert.ok(report.warningFlags.includes("sustained_low"));
    assert.ok(report.baselineComposite > report.currentComposite);
    assert.ok(["Em queda", "Atenção"].includes(report.personalTrendLabel));
  });

  it("exposes the personalized baseline and EWMA values", () => {
    const history = makeHistory(new Date(2026, 3, 1), [
      { humor: 4, energia: 4 },
      { humor: 5, energia: 5 },
      { humor: 6, energia: 6 },
      { humor: 7, energia: 7 },
      { humor: 8, energia: 8 },
      { humor: 9, energia: 9 },
    ]);

    const report = computeMoodCycle(history);

    assert.equal(report.personalTrendLabel, report.personalTrend.trendBandLabel);
    assert.equal(report.baselineMood, report.personalTrend.baselineMood);
    assert.equal(report.currentComposite, report.personalTrend.currentComposite);
    assert.equal(report.baselineDeltaComposite, report.personalTrend.deltaComposite);
  });
});
