import assert from "node:assert/strict";
import { describe, expect, it } from "vitest";

import {
  buildFactorAssociations,
  buildMoodReportEvidence,
  classifyStability,
  pearsonCorrelation,
} from "./mood-reporting";

type Score = { humor: number; energia: number; factors?: string[]; sono?: number };

function history(scores: Score[]) {
  return scores.map((score, index) => ({
    date: `2026-07-${String(index + 1).padStart(2, "0")}`,
    emotion: "calm",
    ...score,
  }));
}

describe("mood reporting", () => {
  it("makes the selected window and insufficient evidence explicit", () => {
    const evidence = buildMoodReportEvidence(history([
      { humor: 7, energia: 6 },
      { humor: 6, energia: 7 },
      { humor: 7, energia: 7 },
    ]), 30);

    assert.equal(evidence.windowDays, 30);
    assert.equal(evidence.sampleCount, 3);
    assert.equal(evidence.confidence, "insufficient");
    assert.equal(evidence.missingDays, 27);
    expect(evidence.label).toMatch(/dados insuficientes/i);
  });

  it("distinguishes stable positive and stable negative patterns without a diagnosis", () => {
    const positive = classifyStability(history(Array.from({ length: 10 }, (_, index) => ({
      humor: 7 + (index % 2), energia: 7,
    }))));
    const negative = classifyStability(history(Array.from({ length: 10 }, (_, index) => ({
      humor: 3 + (index % 2), energia: 3,
    }))));

    assert.equal(positive.kind, "stable_positive");
    assert.equal(negative.kind, "stable_negative");
    expect(negative.description).toMatch(/merecem aten..o/i);
    expect(negative.description).not.toMatch(/depress|transtorno|diagn/i);
  });

  it("refuses to frame sparse factor records as a finding", () => {
    const associations = buildFactorAssociations(history([
      { humor: 8, energia: 7, factors: ["exercise"] },
      { humor: 4, energia: 4 },
      { humor: 7, energia: 7, factors: ["exercise"] },
      { humor: 5, energia: 5 },
      { humor: 6, energia: 6 },
    ]));

    assert.equal(associations.length, 0);
  });

  it("returns a labelled association only with comparison groups and enough observations", () => {
    const associations = buildFactorAssociations(history([
      { humor: 8, energia: 7, factors: ["exercise"] },
      { humor: 7, energia: 7, factors: ["exercise"] },
      { humor: 8, energia: 8, factors: ["exercise"] },
      { humor: 8, energia: 7, factors: ["exercise"] },
      { humor: 3, energia: 4 },
      { humor: 4, energia: 4 },
      { humor: 3, energia: 3 },
      { humor: 4, energia: 3 },
    ]));

    assert.equal(associations.length, 1);
    assert.equal(associations[0]?.factor, "exercise");
    assert.equal(associations[0]?.sampleCount, 8);
    assert.equal(associations[0]?.confidence, "medium");
    expect(associations[0]?.description).toMatch(/associa/i);
    expect(associations[0]?.description).toMatch(/n.o prova causa/i);
  });

  it("uses Pearson only for a minimum paired sample with variance", () => {
    assert.equal(pearsonCorrelation([1, 2], [1, 2]), null);
    assert.equal(pearsonCorrelation([1, 1, 1], [2, 3, 4]), null);
    assert.ok(Math.abs((pearsonCorrelation([1, 2, 3], [1, 2, 3]) ?? 0) - 1) < 0.000001);
  });
});
