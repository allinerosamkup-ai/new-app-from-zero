import assert from 'node:assert/strict';

import { recoverAuraCommandResponse } from './aura-command-recovery.service';

const baseResponse = {
  assistantMessage: 'Preciso de mais detalhes.',
  intent: 'clarify' as const,
  action: 'ask_clarification' as const,
  payload: {},
  needsConfirmation: false,
  needsClarification: true,
  clarifyingQuestion: 'Que horário você prefere?',
};

function run() {
  const task = recoverAuraCommandResponse({
    response: baseResponse,
    message: 'Crie no Planner uma tarefa [TESTE DE PUBLICAÇÃO] revisar o portfólio amanhã. Não defini horário; escolha o melhor horário considerando minha agenda e energia.',
    localDate: '2026-07-28',
    captureJudgment: {
      captureAs: 'task',
      captureMode: 'propose',
      explicitness: 'explicit',
      allowedMutationActions: ['create_task', 'create_checklist'],
    },
  });
  assert.equal(task.action, 'create_task');
  assert.equal(task.intent, 'planner_task');
  assert.equal(task.payload.title, '[TESTE DE PUBLICAÇÃO] revisar o portfólio');
  assert.equal(task.payload.date, '2026-07-29');
  assert.equal(task.payload.startTime, undefined, 'o agendador adaptativo deve escolher a hora');
  assert.equal(task.payload.autoScheduleRequested, true);

  const taskMisclassifiedAsImplicit = recoverAuraCommandResponse({
    response: baseResponse,
    message: 'Crie no Planner uma tarefa revisar o portfólio amanhã.',
    localDate: '2026-07-28',
    captureJudgment: {
      captureAs: 'task',
      captureMode: 'propose',
      explicitness: 'implicit',
      allowedMutationActions: ['create_task', 'create_checklist'],
    },
  });
  assert.equal(taskMisclassifiedAsImplicit.action, 'create_task');
  assert.equal(taskMisclassifiedAsImplicit.payload.autoScheduleRequested, true);

  const mutatingTaskStillNeedsRecovery = recoverAuraCommandResponse({
    response: {
      ...baseResponse,
      intent: 'agenda_plan',
      action: 'create_task',
      payload: {
        title: '[TESTE DE PUBLICAÇÃO] revisar o portfólio',
        date: '2026-07-29',
      },
      needsConfirmation: true,
    },
    message: 'Crie no Planner uma tarefa [TESTE DE PUBLICAÇÃO] revisar o portfólio amanhã. Não defini horário; escolha o melhor horário considerando minha agenda e energia.',
    localDate: '2026-07-28',
    captureJudgment: {
      captureAs: 'task',
      captureMode: 'propose',
      explicitness: 'implicit',
      allowedMutationActions: ['create_task', 'create_checklist'],
    },
  });
  assert.equal(mutatingTaskStillNeedsRecovery.action, 'create_task');
  assert.equal(mutatingTaskStillNeedsRecovery.payload.autoScheduleRequested, true);
  assert.equal(mutatingTaskStillNeedsRecovery.needsConfirmation, false);

  const taskWithInventedTime = recoverAuraCommandResponse({
    response: { ...baseResponse, payload: { startTime: '09:30', category: 'inventada' } },
    message: 'Crie no Planner uma tarefa revisar o portfólio amanhã.',
    localDate: '2026-07-28',
    captureJudgment: {
      captureAs: 'task',
      captureMode: 'propose',
      explicitness: 'explicit',
      allowedMutationActions: ['create_task'],
    },
  });
  assert.equal(taskWithInventedTime.payload.startTime, undefined);
  assert.equal(taskWithInventedTime.payload.category, undefined);

  const goal = recoverAuraCommandResponse({
    response: { ...baseResponse, intent: 'conversation', action: 'respond' },
    message: 'Quero como meta [TESTE DE PUBLICAÇÃO] organizar meu portfólio profissional. Divida em pequenas ações e adicione à minha página de metas.',
    localDate: '2026-07-28',
    captureJudgment: {
      captureAs: 'task',
      captureMode: 'auto',
      explicitness: 'explicit',
      allowedMutationActions: ['create_goal'],
    },
  });
  assert.equal(goal.action, 'create_goal');
  assert.equal(goal.intent, 'goal_project');
  assert.equal(goal.payload.title, '[TESTE DE PUBLICAÇÃO] organizar meu portfólio profissional');

  const checkin = recoverAuraCommandResponse({
    response: { ...baseResponse, intent: 'checkin', action: 'respond' },
    message: 'Faça meu check-in de hoje: estou com humor 7 de 10, energia 6 de 10 e clareza 8 de 10.',
    localDate: '2026-07-28',
    captureJudgment: {
      captureAs: 'checkin',
      captureMode: 'auto',
      explicitness: 'explicit',
      allowedMutationActions: ['record_checkin'],
    },
  });
  assert.equal(checkin.action, 'record_checkin');
  assert.equal(checkin.payload.moodScore, 7);
  assert.equal(checkin.payload.energyScore, 6);
  assert.equal(checkin.payload.clarityScore, 8);
  assert.equal(checkin.payload.irritabilityScore, null);
  assert.doesNotMatch(checkin.assistantMessage, /registrei|salvei|criei/i);

  const checkinAfterWrongMutation = recoverAuraCommandResponse({
    response: {
      ...baseResponse,
      intent: 'planner_task',
      action: 'create_task',
      payload: { title: 'Tarefa inventada' },
    },
    message: 'Faça meu check-in de hoje: estou com humor 7 de 10, energia 6 de 10 e clareza 8 de 10.',
    localDate: '2026-07-28',
    captureJudgment: {
      captureAs: 'checkin',
      captureMode: 'auto',
      explicitness: 'explicit',
      allowedMutationActions: ['record_checkin'],
    },
  });
  assert.equal(checkinAfterWrongMutation.action, 'record_checkin');

  const naturalCheckin = recoverAuraCommandResponse({
    response: { ...baseResponse, intent: 'conversation', action: 'respond' },
    message: 'Estou chateada e cansada.',
    localDate: '2026-07-31',
    captureJudgment: {
      captureAs: 'checkin',
      captureMode: 'auto',
      explicitness: 'implicit',
      allowedMutationActions: ['record_checkin'],
    },
  });
  assert.equal(naturalCheckin.action, 'record_checkin');
  assert.equal(naturalCheckin.payload.moodScore, 3);
  assert.equal(naturalCheckin.payload.energyScore, 3);
  assert.equal(naturalCheckin.payload.clarityScore, null);
  assert.equal(naturalCheckin.payload.source, 'aura_text');

  const listenOnly = recoverAuraCommandResponse({
    response: { ...baseResponse, intent: 'conversation', action: 'respond' },
    message: 'Só estou desabafando. Não crie nada.',
    localDate: '2026-07-28',
    captureJudgment: {
      captureAs: 'conversation',
      captureMode: 'listen',
      explicitness: 'explicit',
      allowedMutationActions: [],
    },
  });
  assert.equal(listenOnly.action, 'respond');
}

run();
console.log('aura-command-recovery.service tests passed');
