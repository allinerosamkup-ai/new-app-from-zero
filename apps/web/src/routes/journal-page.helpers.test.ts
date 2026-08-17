import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { buildJournalClosePrompt, buildJournalPlannerSlot } from "./journal-page.helpers.ts";

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

  const pt = (portuguese: string) => portuguese;
  const en = (_portuguese: string, english: string) => english;

  it("frames the journal close action from actual summary data", () => {
    const prompt = buildJournalClosePrompt({
      hasSummary: true,
      suggestedTaskCount: 2,
      commitmentCount: 1,
      l: pt,
    });

    assert.equal(prompt.label, "Revisar o dia");
    assert.equal(prompt.description, "Use o resumo, 2 tarefas e 1 compromisso para escolher a próxima ação.");
  });

  it("does not imply planner work when the journal has no extracted action", () => {
    const prompt = buildJournalClosePrompt({
      hasSummary: false,
      suggestedTaskCount: 0,
      commitmentCount: 0,
      l: pt,
    });

    assert.equal(prompt.label, "Fechar");
    assert.equal(prompt.description, "Sessão salva. Sem ação nova extraída deste diário.");
  });

  it("keeps the close copy in English for an English session", () => {
    assert.deepEqual(
      buildJournalClosePrompt({ hasSummary: false, suggestedTaskCount: 0, commitmentCount: 0, l: en }),
      { label: "Close", description: "Session saved. No new action extracted from this journal entry." },
    );
    assert.equal(
      buildJournalClosePrompt({ hasSummary: true, suggestedTaskCount: 1, commitmentCount: 2, l: en }).description,
      "Use the summary, 1 task, and 2 commitments to pick the next action.",
    );
  });
});
