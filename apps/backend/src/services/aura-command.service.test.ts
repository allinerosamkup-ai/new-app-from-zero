import assert from 'node:assert/strict';

import { getOpenAiModel } from '../lib/openai-config';
import { AuraCommandService, parseAuraCommandResponse } from './aura-command.service';

async function run() {
  const recoveredAgenda = parseAuraCommandResponse(
    JSON.stringify({
      assistantMessage: 'Separei a proposta em blocos para você revisar.',
      action: 'create_agenda',
      payload: {
        blocks: [
          {
            title: 'Check-in do dia',
            date: '2026-04-18',
            startTime: '09:00',
            category: 'rotina',
          },
        ],
      },
      needsConfirmation: true,
    }),
    'Organize esse texto grande no planner: ' + 'bloco '.repeat(900),
  );

  assert.equal(recoveredAgenda.intent, 'agenda_plan');
  assert.equal(recoveredAgenda.action, 'create_agenda');
  assert.equal(recoveredAgenda.needsConfirmation, true);

  const recoveredClarification = parseAuraCommandResponse(
    JSON.stringify({
      assistantMessage: 'Recebi bastante coisa de uma vez. Posso organizar, resumir ou transformar em passos.',
      payload: {},
    }),
    'texto longo '.repeat(900),
  );

  assert.equal(recoveredClarification.intent, 'clarify');
  assert.equal(recoveredClarification.action, 'ask_clarification');
  assert.equal(recoveredClarification.needsClarification, true);

  const capturedMessages: Array<{ role: string; content: string }> = [];
  const capturedModels: string[] = [];
  const queuedResponses = [
    {
      assistantMessage: 'Entendi o compromisso. Revise e confirme antes de eu salvar no planner.',
      intent: 'planner_task',
      action: 'create_task',
      payload: {
        title: 'Consulta com dentista',
        date: '2026-04-06',
        time: '14:00',
        category: 'saude',
      },
      needsConfirmation: true,
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
      needsConfirmation: false,
      needsClarification: false,
      clarifyingQuestion: null,
    },
    {
      assistantMessage: 'Isso tem mais cara de diário. Vou registrar um resumo do que conversamos.',
      intent: 'reflective_handoff',
      action: 'handoff_to_journal',
      payload: {},
      needsConfirmation: false,
      needsClarification: false,
      clarifyingQuestion: null,
    },
    {
      assistantMessage: 'Antes de agir, preciso só de um detalhe.',
      intent: 'clarify',
      action: 'ask_clarification',
      payload: {},
      needsConfirmation: false,
      needsClarification: true,
      clarifyingQuestion: 'Você quer transformar isso em tarefa, checklist ou meta?',
    },
  ];

  const fakeClient = {
    chat: {
      completions: {
        create: async ({ model, messages }: any) => {
          capturedModels.push(model);
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
  assert.equal(plannerResult.needsConfirmation, true);
  assert.equal(plannerResult.needsClarification, false);

  const checklistResult = await AuraCommandService.interpretCommand({
    message: 'Quebra preparar apresentação em passos',
    userName: 'Ana',
  }, fakeClient as any);

  assert.equal(checklistResult.intent, 'checklist');
  assert.equal(checklistResult.action, 'create_checklist');
  assert.equal(checklistResult.needsConfirmation, false);

  const reflectiveResult = await AuraCommandService.interpretCommand({
    message: 'Preciso desabafar porque hoje estou péssima',
    userName: 'Ana',
    interactionMode: 'conversation',
  }, fakeClient as any);

  assert.equal(reflectiveResult.intent, 'reflective_handoff');
  assert.equal(reflectiveResult.action, 'handoff_to_journal');
  assert.equal(reflectiveResult.needsConfirmation, false);

  const clarifyResult = await AuraCommandService.interpretCommand({
    message: 'Preciso resolver minha vida',
    userName: 'Ana',
  }, fakeClient as any);

  assert.equal(clarifyResult.intent, 'clarify');
  assert.equal(clarifyResult.action, 'ask_clarification');
  assert.equal(clarifyResult.needsConfirmation, false);
  assert.equal(clarifyResult.needsClarification, true);
  assert.match(clarifyResult.clarifyingQuestion || '', /tarefa, checklist ou meta/i);

  const systemPrompt = capturedMessages[0]?.content || '';
  const userPrompt = capturedMessages[1]?.content || '';

  assert.match(systemPrompt, /assistente pessoal de humor, energia e agenda adaptativa/i);
  assert.match(systemPrompt, /AURA CHAT EXECUTOR/i);
  assert.match(systemPrompt, /LEITURA TOTAL/i);
  assert.match(systemPrompt, /humor atual, historico de humor/i);
  assert.match(systemPrompt, /memorias RAG relevantes/i);
  assert.match(systemPrompt, /POLITICA DE SUGESTAO CONCRETA/i);
  assert.match(systemPrompt, /termos proprietarios/i);
  assert.doesNotMatch(systemPrompt, /Aliança Divergente/i);
  assert.doesNotMatch(systemPrompt, /Marca Passo/i);
  assert.doesNotMatch(systemPrompt, /Ponto Cego/i);
  assert.doesNotMatch(systemPrompt, /Efeito Paralelo/i);
  assert.match(userPrompt, /planner_task/i);
  assert.match(userPrompt, /checklist/i);
  assert.match(userPrompt, /reflective_handoff/i);
  assert.match(userPrompt, /ask_clarification/i);
  assert.match(userPrompt, /needsConfirmation/i);
  assert.match(userPrompt, /recorrent/i);
  assert.match(userPrompt, /MODO DA INTERAÇÃO/i);
  assert.match(userPrompt, /EXECUTOR PURO/i);
  assert.match(userPrompt, /CONVERSA ESTRATÉGICA/i);
  assert.match(userPrompt, /CONVERSAR SOBRE META\/PLANNER/i);
  assert.match(userPrompt, /EXPLICAR a tarefa\/meta\/ação/i);
  assert.match(userPrompt, /linguagem Airia/i);
  assert.match(userPrompt, /formulário de decisão/i);
  assert.match(userPrompt, /n[aã]o entendi/i);
  assert.match(userPrompt, /travamento de clareza/i);
  assert.match(userPrompt, /Proibido usar o modelo analítico/i);
  assert.match(userPrompt, /nunca diga que j[aá] salvou|n[aã]o diga que j[aá] salvou/i);
  assert.ok(capturedModels.every((model) => model === getOpenAiModel()));
}

run()
  .then(() => {
    console.log('aura-command.service tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
