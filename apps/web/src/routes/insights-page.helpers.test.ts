import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  buildInsightActionDecision,
  formatEstimatedMenstrualPhase,
  resolveMoodDayHighlights,
} from "./insights-page.helpers.ts";

describe("insights page helpers", () => {
  it("blocks planner actions when insight evidence is too thin", () => {
    const decision = buildInsightActionDecision({
      checkins: 2,
      action: "Reduzir a carga de hoje",
      actionTitle: "Reduzir carga",
      category: "rotina",
      source: "local_fallback",
    });

    assert.equal(decision.canSaveToPlanner, false);
    assert.equal(decision.reason, "Precisa de pelo menos 3 check-ins para virar ação no Planner.");
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

  it("labels menstrual phase and cycle day as estimates", () => {
    assert.equal(formatEstimatedMenstrualPhase("Ovulação", 14), "Estimativa: Ovulação · D14");
    assert.equal(formatEstimatedMenstrualPhase("TPM", 24), "Estimativa: TPM · D24");
    assert.equal(formatEstimatedMenstrualPhase("TPM", null), "Estimativa: TPM");
  });
});
