import assert from 'node:assert/strict';

import { getOpenAiModel } from '../lib/openai-config';
import { AuraCommandService, parseAuraCommandResponse } from './aura-command.service';

async function run() {
  const inactiveRequest = parseAuraCommandResponse(
    JSON.stringify({
      assistantMessage: 'Vou organizar sua semana.',
      intent: 'routine_builder',
      action: 'create_agenda',
      payload: {},
    }),
    'Monte minha rotina completa a partir disso.',
  );
  assert.equal(inactiveRequest.intent, 'clarify');
  assert.equal(inactiveRequest.action, 'ask_clarification');
  assert.match(inactiveRequest.clarifyingQuestion ?? '', /resultado concreto/i);

  const checkin = parseAuraCommandResponse(JSON.stringify({
    assistantMessage: 'Registrei os dados para revisão.',
    intent: 'checkin',
    action: 'create_checkin',
    payload: { moodScore: 3, energyScore: 2, irritabilityScore: 7 },
    needsConfirmation: true,
  }), 'Fazer check-in: estou cansada, irritada e sem foco');
  assert.equal(checkin.intent, 'checkin');
  assert.equal(checkin.action, 'create_checkin');
  assert.equal(checkin.needsConfirmation, true);

  const goal = parseAuraCommandResponse(JSON.stringify({
    assistantMessage: 'Preparei este Objetivo para sua confirmação.',
    intent: 'goal_project',
    action: 'create_goal',
    payload: {
      title: 'Enviar a proposta comercial',
      subgoals: [{
        title: 'Abrir a proposta comercial e escrever o primeiro tópico',
        doneWhen: 'o primeiro tópico estiver visível na proposta',
      }],
    },
    needsConfirmation: true,
  }), 'Quero transformar a proposta comercial em um objetivo');
  assert.equal(goal.intent, 'goal_project');
  assert.equal(goal.action, 'create_goal');
  assert.equal(goal.payload.title, 'Enviar a proposta comercial');

  const journal = parseAuraCommandResponse(JSON.stringify({
    assistantMessage: 'Vou levar esse relato para o Diário.',
    intent: 'reflective_handoff',
    action: 'handoff_to_journal',
    payload: {},
  }), 'Salva no diário que hoje fiquei angustiada depois da reunião.');
  assert.equal(journal.intent, 'reflective_handoff');
  assert.equal(journal.action, 'handoff_to_journal');

  const conversation = parseAuraCommandResponse(JSON.stringify({
    assistantMessage: 'Você está tentando resolver tudo de uma vez.',
    intent: 'conversation',
    action: 'respond',
    payload: {},
  }), 'Estou ansiosa com a mudança e não consigo começar.');
  assert.equal(conversation.intent, 'conversation');
  assert.equal(conversation.action, 'respond');
  assert.equal(conversation.needsClarification, false);

  const captured: Array<{ role: string; content: string }> = [];
  const fakeClient = {
    chat: {
      completions: {
        create: async ({ model, messages }: any) => {
          assert.equal(model, getOpenAiModel());
          captured.push(...messages);
          return {
            choices: [{
              message: {
                content: JSON.stringify({
                  assistantMessage: 'Preparei o Objetivo para sua confirmação.',
                  intent: 'goal_project',
                  action: 'create_goal',
                  payload: {
                    title: 'Enviar a proposta comercial',
                    subgoals: [{
                      title: 'Abrir a proposta comercial e escrever o primeiro tópico',
                      doneWhen: 'o primeiro tópico estiver visível na proposta',
                    }],
                  },
                  needsConfirmation: true,
                }),
              },
            }],
          };
        },
      },
    },
  };

  const executed = await AuraCommandService.interpretCommand({
    message: 'Transforme enviar a proposta comercial em um objetivo.',
    userName: 'Ana',
    activeGoalsContext: 'Objetivo em aberto: enviar a proposta comercial.',
    currentHour: 10,
    currentMinute: 0,
  }, fakeClient as any);
  assert.equal(executed.action, 'create_goal');
  assert.equal(executed.needsConfirmation, true);

  const emptyProviderResponse = await AuraCommandService.interpretCommand({
    message: 'Quero fazer um check-in agora.',
    locale: 'pt-BR',
  }, {
    chat: { completions: { create: async () => ({ choices: [{ message: { content: null } }] }) } },
  } as any);
  assert.equal(emptyProviderResponse.action, 'respond');
  assert.match(emptyProviderResponse.assistantMessage, /não consegui concluir essa etapa/i);

  const systemPrompt = captured[0]?.content ?? '';
  const userPrompt = captured[1]?.content ?? '';
  assert.match(systemPrompt, /Check-in, Diário, Objetivos e Padrões/i);
  assert.match(systemPrompt, /ação concreta/i);
  assert.doesNotMatch(systemPrompt, /planner|agenda|hábitos/i);
  assert.match(userPrompt, /NÚCLEO ATIVO/i);
  assert.match(userPrompt, /create_goal/i);
  assert.doesNotMatch(userPrompt, /create_agenda|create_task|create_habit/i);
}

run()
  .then(() => console.log('aura-command.service tests passed'))
  .catch((error) => { console.error(error); process.exit(1); });
