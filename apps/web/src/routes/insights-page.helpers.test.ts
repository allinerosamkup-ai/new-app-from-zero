import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  buildTemporalRhythmSignal,
  buildInsightActionDecision,
  formatEstimatedMenstrualPhase,
  resolveMoodDayHighlights,
} from "./insights-page.helpers.ts";

describe("insights page helpers", () => {
  it("blocks next actions when insight evidence is too thin", () => {
    const decision = buildInsightActionDecision({
      checkins: 2,
      action: "Reduzir a carga de hoje",
      actionTitle: "Reduzir carga",
      category: "rotina",
      source: "local_fallback",
    });

    assert.equal(decision.canSaveToPlanner, false);
    assert.equal(decision.reason, "Precisa de pelo menos 3 check-ins para virar uma próxima ação.");
  });

  it("allows planner actions when the insight has enough check-ins", () => {
    const decision = buildInsightActionDecision({
      checkins: 7,
      action: "Separar 30 minutos para revisar prioridades",
      actionTitle: "Revisar prioridades",
      category: "rotina",
      source: "weekly_endpoint",
    });

    assert.equal(decision.canSaveToPlanner, true);
    assert.equal(decision.evidence, "Base: 7 check-ins no período e recomendação semanal.");
  });

  it("keeps best and worst day highlights distinct without duplicating a weekday", () => {
    assert.deepEqual(
      resolveMoodDayHighlights(
        { day: "Seg", mood: 8.2 },
        { day: "Qua", mood: 3.4 },
      ),
      {
        bestDay: { day: "Seg", mood: 8.2 },
        worstDay: { day: "Qua", mood: 3.4 },
      },
    );

    assert.deepEqual(
      resolveMoodDayHighlights(
        { day: "Seg", mood: 6 },
        { day: "Seg", mood: 6 },
      ),
      {
        bestDay: { day: "Seg", mood: 6 },
        worstDay: null,
      },
    );
  });

  it("does not infer a temporal signal from fewer than seven observed days", () => {
    const signal = buildTemporalRhythmSignal([
      { date: "2026-08-01", humor: 7, energia: 7 },
      { date: "2026-08-02", humor: 5, energia: 5 },
      { date: "2026-08-03", humor: 8, energia: 8 },
    ]);

    assert.equal(signal.confidence, "insufficient");
    assert.equal(signal.moodChange, null);
    assert.equal(signal.lowerRhythmStreak, 0);
  });

  it("describes a recent change from ordered personal records without using calendar days", () => {
    const signal = buildTemporalRhythmSignal([
      { date: "2026-08-01", humor: 8, energia: 8 },
      { date: "2026-08-03", humor: 8, energia: 7 },
      { date: "2026-08-05", humor: 7, energia: 7 },
      { date: "2026-08-06", humor: 5, energia: 5 },
      { date: "2026-08-08", humor: 4, energia: 4 },
      { date: "2026-08-09", humor: 4, energia: 3 },
      { date: "2026-08-10", humor: 4, energia: 3 },
    ]);

    assert.equal(signal.confidence, "early");
    assert.equal(signal.moodChange, -0.5);
    assert.equal(signal.energyChange, -1.5);
    assert.equal(signal.lowerRhythmStreak, 4);
  });

  it("labels menstrual phase and cycle day as estimates", () => {
    assert.equal(formatEstimatedMenstrualPhase("Ovulação", 14), "Estimativa: Ovulação · D14");
    assert.equal(formatEstimatedMenstrualPhase("TPM", 24), "Estimativa: TPM · D24");
    assert.equal(formatEstimatedMenstrualPhase("TPM", null), "Estimativa: TPM");
  });
});
