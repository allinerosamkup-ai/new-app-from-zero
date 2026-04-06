import assert from "node:assert/strict";

import {
  buildQuarterHourRefreshBucket,
  buildHomeAiRequestKey,
  dedupeAgendaBlocks,
  extractAgendaRepeatContext,
  extractHomeRepeatContext,
} from "./home-page.helpers.ts";

function run() {
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
}

run();
console.log("home-page helpers tests passed");
