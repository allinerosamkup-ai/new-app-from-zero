import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { buildDailyCloseSummary } from "./daily-summary-page.helpers.ts";

describe("daily summary page helpers", () => {
  it("shows an actionable empty state without grounded data", () => {
    const summary = buildDailyCloseSummary({
      tasks: [],
      habits: [],
      goals: [],
      checkinHistory: [],
      journal: "",
    });

    assert.equal(summary.hasData, false);
    assert.equal(summary.tomorrowAdjustments.length, 0);
    assert.equal(summary.primaryAction.path, "/checkin");
  });

  it("summarizes completed and pending planner tasks", () => {
    const summary = buildDailyCloseSummary({
      tasks: [
        { id: "1", title: "Enviar proposta", time: "09:00", done: true, category: "trabalho" },
        { id: "2", title: "Revisar contrato", time: "15:00", done: false, category: "trabalho" },
      ],
      habits: [],
      goals: [],
      checkinHistory: [],
      journal: "",
    });

    assert.equal(summary.hasData, true);
    assert.equal(summary.stats.completedTasks, 1);
    assert.equal(summary.stats.pendingTasks, 1);
    assert.match(summary.headline, /1 coisa/);
    assert.match(summary.tomorrowAdjustments[0]?.title ?? "", /Revisar contrato/);
  });

  it("prioritizes reducing load when the latest check-in has low energy", () => {
    const summary = buildDailyCloseSummary({
      tasks: [
        { id: "1", title: "Preparar reuniao", time: "11:00", done: false, category: "trabalho" },
      ],
      habits: [],
      goals: [],
      checkinHistory: [
        { date: "2026-05-10", humor: 3, energia: 2, emotion: "cansada", stateLabel: "Dia cansativo" },
      ],
      journal: "",
    });

    assert.equal(summary.hasData, true);
    assert.match(summary.tomorrowAdjustments[0]?.description ?? "", /reduzir carga/i);
    assert.match(summary.evidence.join(" "), /energia 2\/10/);
  });

  it("turns a pending habit into a light adjustment, not an automatic commitment", () => {
    const summary = buildDailyCloseSummary({
      tasks: [],
      habits: [
        {
          id: "habit-1",
          title: "Diario",
          category: "autocuidado",
          frequency: "daily",
          targetDays: [],
          targetCount: 1,
          streakCount: 0,
          bestStreak: 0,
          totalCompletions: 0,
          reminderEnabled: true,
          reminderTime: "20:00",
          completions: [],
        },
      ],
      goals: [],
      checkinHistory: [],
      journal: "",
    });

    assert.equal(summary.hasData, true);
    assert.equal(summary.stats.pendingHabits, 1);
    assert.match(summary.tomorrowAdjustments[0]?.description ?? "", /leve/i);
  });

  it("uses active goals as anchors without inventing extra suggestions", () => {
    const summary = buildDailyCloseSummary({
      tasks: [],
      habits: [],
      goals: [{ id: 1, title: "Lancar Airia", progress: "Em andamento", completedPct: 35, subtasks: [] }],
      checkinHistory: [],
      journal: "",
    });

    assert.equal(summary.hasData, true);
    assert.match(summary.tomorrowAdjustments[0]?.title ?? "", /Lancar Airia/);
    assert.equal(summary.tomorrowAdjustments.length, 1);
  });
});
