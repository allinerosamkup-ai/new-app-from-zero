import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  HOME_AUTONOMY_FEEDBACK_KEY,
  buildQuarterHourRefreshBucket,
  buildHomeAiRequestKey,
  buildHomeAgendaPreview,
  dedupeAgendaBlocks,
  extractAgendaRepeatContext,
  extractBlockedHomeAutonomyTitles,
  extractHomeRepeatContext,
  isHomeAutonomyTitleBlocked,
  readHomeAutonomyFeedback,
  rememberHomeAutonomyActionFeedback,
  resolveGroundedHomeCare,
  resolveHomeAgendaSuggestionDate,
  shouldRefreshHomeSuggestionAfterAction,
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

  it("removes care suggestions that introduce unanchored concrete objects", () => {
    const resolved = resolveGroundedHomeCare({
      actions: [
        "☕ Tome seu café sem abrir abas, só até terminar o primeiro gole.",
        "🧤 Separe luvas ou algo pra manusear poeira por 10 minutos, depois pare.",
        "🧼 Limpe uma superfície pequena com pano úmido e pronto, sem expandir.",
      ],
      hour: 8,
      partOfDay: "manhã",
      moodLabel: "Ansiosa",
      energy: 6,
      latestCheckin: { humor: 5, energia: 6, emotions: ["anxious"], factors: [], note: "Ansiedade com a mudança" },
      pendingTaskTitles: ["Separar camas e itens de dormir para mudança"],
      goalTitles: [],
      hasMoodCycle: true,
    });

    assert.deepEqual(resolved.actions, [
      "📦 Escolha uma caixa pequena e feche só ela por 20 minutos.",
      "🧾 Separe fita, saco e etiqueta antes de mexer no resto.",
      "⏱️ Pare quando a caixa fechar, mesmo se ainda houver bagunça.",
    ]);
    assert.match(resolved.evidence || "", /check-in/);
    assert.match(resolved.evidence || "", /agenda/);
  });

  it("does not show care actions when there is no real anchor", () => {
    const resolved = resolveGroundedHomeCare({
      actions: ["🌿 Faça algo leve agora."],
      hour: 10,
      partOfDay: "manhã",
      pendingTaskTitles: [],
      goalTitles: [],
      hasMoodCycle: false,
    });

    assert.deepEqual(resolved.actions, []);
    assert.equal(resolved.evidence, null);
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

  it("keeps AI suggestion metadata on the home agenda preview", () => {
    const preview = buildHomeAgendaPreview({
      tasks: [
        { id: "ai", title: "Enviar proposta", time: "10:00", done: false, category: "trabalho", isAiSuggested: true },
      ],
      habits: [],
    });

    assert.equal(preview.tasks[0]?.isAiSuggested, true);
    assert.equal(shouldRefreshHomeSuggestionAfterAction(preview.tasks[0]!), true);
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

  it("orders habits and commitments chronologically in the home agenda", () => {
    const preview = buildHomeAgendaPreview({
      tasks: [
        { id: "noon", title: "Almoço", time: "12:00", done: false },
        { id: "ten", title: "Ligação", time: "10:00", done: false },
        { id: "eleven", title: "Banco", time: "11:00", done: false },
      ],
      habits: [{ id: "habit", title: "Limpar areia das gatas", icon: "✨", completions: [], reminderTime: "09:00" }],
    });

    assert.deepEqual(
      preview.items.map((item) => item.title),
      ["Limpar areia das gatas", "Ligação", "Banco", "Almoço"],
    );
  });

  it("removes overdue commitments from the home preview but keeps overdue habits pending", () => {
    const preview = buildHomeAgendaPreview({
      referenceDate: new Date("2026-04-25T10:30:00"),
      tasks: [
        { id: "past", title: "Reunião antiga", time: "09:00", done: false },
        { id: "future", title: "Consulta", time: "11:00", done: false },
      ],
      habits: [{ id: "habit", title: "Medicação", icon: "💊", completions: [], reminderTime: "08:00" }],
    });

    assert.deepEqual(preview.tasks.map((task) => task.title), ["Consulta"]);
    assert.equal(preview.habit?.title, "Medicação");
    assert.deepEqual(preview.items.map((item) => item.title), ["Medicação", "Consulta"]);
  });

  it("resolves agenda suggestions to tomorrow from 18h onward", () => {
    assert.equal(resolveHomeAgendaSuggestionDate("2026-04-12", 17), "2026-04-12");
    assert.equal(resolveHomeAgendaSuggestionDate("2026-04-12", 18), "2026-04-13");
  });

  it("does not regenerate AI suggestions after regular task or habit actions", () => {
    assert.equal(shouldRefreshHomeSuggestionAfterAction({ kind: "task", isAiSuggested: false }), false);
    assert.equal(shouldRefreshHomeSuggestionAfterAction({ kind: "habit" }), false);
  });

  it("persists home autonomy feedback and exposes blocked titles", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const now = new Date("2026-04-29T12:00:00.000Z");

    const first = rememberHomeAutonomyActionFeedback("Ligar para a proprietária", "done", { storage, referenceDate: now });
    assert.equal(first.length, 1);
    assert.equal(first[0]?.status, "done");
    assert.equal(values.has(HOME_AUTONOMY_FEEDBACK_KEY), true);

    const second = rememberHomeAutonomyActionFeedback("  ligar para a proprietária  ", "dismissed", { storage, referenceDate: now });
    assert.equal(second.length, 1);
    assert.equal(second[0]?.status, "dismissed");
    assert.deepEqual(extractBlockedHomeAutonomyTitles(second), ["ligar para a proprietária"]);
  });

  it("drops expired home autonomy feedback", () => {
    const storage = {
      getItem: () => JSON.stringify([
        {
          key: "matteo",
          title: "Mandar mensagem para Matteo",
          status: "deleted",
          createdAt: "2026-04-20T12:00:00.000Z",
          expiresAt: "2026-04-21T12:00:00.000Z",
        },
      ]),
      setItem: () => undefined,
    };

    assert.deepEqual(readHomeAutonomyFeedback(storage, new Date("2026-04-29T12:00:00.000Z")), []);
  });

  it("blocks home autonomy titles that are similar to completed feedback", () => {
    assert.equal(
      isHomeAutonomyTitleBlocked("Mandar mensagem para Matteo", ["Enviar mensagem ao Matteo"]),
      true,
    );
    assert.equal(
      isHomeAutonomyTitleBlocked("Abrir anúncio do apartamento", ["Enviar mensagem ao Matteo"]),
      false,
    );
  });
});
