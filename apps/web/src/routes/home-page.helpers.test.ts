import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  buildQuarterHourRefreshBucket,
  buildHomeAiRequestKey,
  buildHomeAgendaPreview,
  dedupeAgendaBlocks,
  extractAgendaRepeatContext,
  extractHomeRepeatContext,
  resolveHomeAgendaSuggestionDate,
} from "./home-page.helpers.ts";

describe("home page helpers", () => {
  it("changes the AI request key by quarter-hour refresh bucket", () => {
    const keyA = buildHomeAiRequestKey({
      localDate: "2026-04-06",
      partOfDay: "manhã",
      mood: "equilibrada",
      taskCount: 2,
      goalTitles: ["Fechar proposta"],
      pendingTaskTitles: ["Mandar email"],
      latestCheckinKey: "2026-04-06T09:10:00.000Z",
      refreshBucket: "2026-04-06-09-0",
    });

    const keyB = buildHomeAiRequestKey({
      localDate: "2026-04-06",
      partOfDay: "manhã",
      mood: "equilibrada",
      taskCount: 2,
      goalTitles: ["Fechar proposta"],
      pendingTaskTitles: ["Mandar email"],
      latestCheckinKey: "2026-04-06T09:10:00.000Z",
      refreshBucket: "2026-04-06-09-1",
    });

    assert.notEqual(keyA, keyB);
    assert.equal(buildQuarterHourRefreshBucket(new Date("2026-04-06T09:34:00")), "2026-04-06-09-2");
  });

  it("extracts repeat context for home and agenda suggestions", () => {
    assert.deepEqual(
      extractHomeRepeatContext({
        motivacional: "Respira e volta para o corpo.",
        autocuidado: ["💧 Beber água agora", "  💧 Beber água agora  ", "🫁 Fazer 3 respirações longas"],
        proactive: { emoji: "🎯", title: "Abrir planner", desc: "Revise o dia.", actionPath: "/planner" },
      }),
      {
        previousMotivacional: "Respira e volta para o corpo.",
        previousAutocuidado: ["💧 Beber água agora", "🫁 Fazer 3 respirações longas"],
      },
    );

    const deduped = dedupeAgendaBlocks([
      {
        horario_inicio: "08:00",
        horario_fim: "09:00",
        tipo: "trabalho",
        label: "Foco inicial",
        tarefas_sugeridas: ["Abrir o Notion", "Abrir o Notion", "Responder cliente"],
        razao_ia: "Começar leve.",
      },
      {
        horario_inicio: "09:00",
        horario_fim: "10:00",
        tipo: "trabalho",
        label: "Fluxo",
        tarefas_sugeridas: ["responder cliente", "Enviar proposta"],
        razao_ia: "Seguir em fluxo.",
      },
    ]);

    assert.deepEqual(
      deduped.map((block) => block.tarefas_sugeridas),
      [["Abrir o Notion", "Responder cliente"], ["Enviar proposta"]],
    );

    assert.deepEqual(extractAgendaRepeatContext(deduped), {
      previousLabels: ["Foco inicial", "Fluxo"],
      previousTasks: ["Abrir o Notion", "Responder cliente", "Enviar proposta"],
    });
  });

  it("builds a home agenda preview with next commitments and one pending habit", () => {
    const preview = buildHomeAgendaPreview({
      tasks: [
        { id: "late", title: "Enviar contrato", time: "17:00", done: false, category: "trabalho" },
        { id: "done", title: "Reunião encerrada", time: "08:00", done: true, category: "trabalho" },
        { id: "early", title: "Consulta", time: "09:00", done: false, category: "pessoal" },
        { id: "mid", title: "Responder cliente", time: "11:00", done: false, category: "trabalho" },
        { id: "extra", title: "Comprar remédio", time: "19:00", done: false, category: "pessoal" },
      ],
      habits: [
        { id: "habit-done", title: "Beber água", icon: "💧", completions: [{}], reminderTime: "08:00" },
        { id: "habit-open", title: "Alongamento", icon: "🌿", completions: [], reminderTime: "10:00" },
      ],
    });

    assert.deepEqual(
      preview.tasks.map((task) => task.title),
      ["Consulta", "Responder cliente", "Enviar contrato"],
    );
    assert.equal(preview.habit?.title, "Alongamento");
  });

  it("does not repeat a pending habit that is already in the next commitments", () => {
    const preview = buildHomeAgendaPreview({
      tasks: [
        { id: "task-1", title: "Alongamento", time: "09:00", done: false, category: "autocuidado" },
      ],
      habits: [
        { id: "habit-1", title: "Alongamento", icon: "🌿", completions: [], reminderTime: "09:00" },
        { id: "habit-2", title: "Regar as plantas", icon: "🪴", completions: [], reminderTime: "11:00" },
      ],
    });

    assert.equal(preview.habit?.title, "Regar as plantas");
  });

  it("returns an empty home agenda preview when there is no pending content", () => {
    const preview = buildHomeAgendaPreview({
      tasks: [{ id: "done", title: "Fechado", time: "08:00", done: true }],
      habits: [{ id: "habit-done", title: "Beber água", completions: [{}] }],
    });

    assert.deepEqual(preview.tasks, []);
    assert.equal(preview.habit, null);
  });

  it("keeps a habit in the home agenda while multi-count target is not reached", () => {
    const preview = buildHomeAgendaPreview({
      tasks: [],
      habits: [{ id: "water", title: "Beber água", targetCount: 5, completions: [{ completionCount: 3 }], reminderTime: "09:00" }],
    });

    assert.equal(preview.habit?.title, "Beber água");
  });

  it("resolves agenda suggestions to tomorrow from 18h onward", () => {
    assert.equal(resolveHomeAgendaSuggestionDate("2026-04-12", 17), "2026-04-12");
    assert.equal(resolveHomeAgendaSuggestionDate("2026-04-12", 18), "2026-04-13");
  });
});
