import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { buildInsightActionDecision } from "./insights-page.helpers.ts";

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
});
