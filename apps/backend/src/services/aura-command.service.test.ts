import assert from 'node:assert/strict';

import { AuraCommandService } from './aura-command.service';

async function run() {
  const capturedMessages: Array<{ role: string; content: string }> = [];
  const queuedResponses = [
    {
      assistantMessage: 'Vou colocar isso no planner amanhã às 14:00.',
      intent: 'planner_task',
      action: 'create_task',
      payload: {
        title: 'Consulta com dentista',
        date: '2026-04-06',
        time: '14:00',
        category: 'saude',
      },
      needsClarification: false,
      clarifyingQuestion: null,
    },
    {
      assistantMessage: 'Isso parece um pequeno plano com etapas. Vou quebrar em checklist.',
      intent: 'checklist',
      action: 'create_checklist',
      payload: {
        title: 'Preparar apresentação',
        items: ['Abrir o slide atual', 'Listar os 3 tópicos principais'],
      },
      needsClarification: false,
      clarifyingQuestion: null,
    },
    {
      assistantMessage: 'Entendi. Isso parece mais um momento para processar o que você está sentindo.',
      intent: 'reflective_handoff',
      action: 'handoff_to_journal',
      payload: {},
      needsClarification: false,
      clarifyingQuestion: null,
    },
    {
      assistantMessage: 'Antes de agir, preciso só de um detalhe.',
      intent: 'clarify',
      action: 'ask_clarification',
      payload: {},
      needsClarification: true,
      clarifyingQuestion: 'Você quer transformar isso em tarefa, checklist ou meta?',
    },
  ];

  const fakeClient = {
    chat: {
      completions: {
        create: async ({ messages }: any) => {
          capturedMessages.push(...messages);
          const next = queuedResponses.shift();
          return {
            choices: [
              {
                message: {
                  content: JSON.stringify(next),
                },
              },
            ],
          };
        },
      },
    },
  };

  const plannerResult = await AuraCommandService.interpretCommand({
    message: 'Marcar dentista amanhã às 14h',
    userName: 'Ana',
  }, fakeClient as any);

  assert.equal(plannerResult.intent, 'planner_task');
  assert.equal(plannerResult.action, 'create_task');
  assert.equal(plannerResult.needsClarification, false);

  const checklistResult = await AuraCommandService.interpretCommand({
    message: 'Quebra preparar apresentação em passos',
    userName: 'Ana',
  }, fakeClient as any);

  assert.equal(checklistResult.intent, 'checklist');
  assert.equal(checklistResult.action, 'create_checklist');

  const reflectiveResult = await AuraCommandService.interpretCommand({
    message: 'Preciso desabafar porque hoje estou péssima',
    userName: 'Ana',
  }, fakeClient as any);

  assert.equal(reflectiveResult.intent, 'reflective_handoff');
  assert.equal(reflectiveResult.action, 'handoff_to_journal');

  const clarifyResult = await AuraCommandService.interpretCommand({
    message: 'Preciso resolver minha vida',
    userName: 'Ana',
  }, fakeClient as any);

  assert.equal(clarifyResult.intent, 'clarify');
  assert.equal(clarifyResult.action, 'ask_clarification');
  assert.equal(clarifyResult.needsClarification, true);
  assert.match(clarifyResult.clarifyingQuestion || '', /tarefa, checklist ou meta/i);

  const systemPrompt = capturedMessages[0]?.content || '';
  const userPrompt = capturedMessages[1]?.content || '';

  assert.match(systemPrompt, /COPILOTO OPERACIONAL/i);
  assert.match(userPrompt, /planner_task/i);
  assert.match(userPrompt, /checklist/i);
  assert.match(userPrompt, /reflective_handoff/i);
  assert.match(userPrompt, /ask_clarification/i);
}

run()
  .then(() => {
    console.log('aura-command.service tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
