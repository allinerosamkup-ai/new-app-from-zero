import assert from 'node:assert/strict';

import { DecisionEngine } from './decision-engine.service';
import type { DailyContext } from './context-grounding.service';

const context: DailyContext = {
  source: 'ContextGroundingService',
  date: '2026-04-30',
  pendingTaskTitles: [],
  completedTaskTitles: ['Treino'],
  pendingHabitTitles: [],
  completedHabitTitles: ['Ginástica'],
  activeGoalTitles: ['Preparar proposta da Airia'],
  completedGoalTitles: [],
  completedSubgoalTitles: [],
  recentSuggestionTitles: ['Separar roupa de treino'],
  blockedActionTitles: ['Kit do treino'],
  todayAnchorTitles: ['Preparar proposta da Airia'],
  tasks: [],
  habits: [],
  goals: [],
  actionFeedback: [],
  patternMemoryContext: 'Memória antiga sobre treino.',
  operationalRule: 'Contexto antigo explica padrão; ação do dia precisa de âncora operacional atual.',
};

{
  const targetId = '99999999-9999-4999-8999-999999999999';
  const result = DecisionEngine.evaluate({
    dailyContext: {
      ...context,
      pendingTaskTitles: ['Titulo completamente alterado'],
      blockedActionCanonicalKeys: [`timeline:${targetId}`],
      tasks: [{ id: targetId, title: 'Titulo completamente alterado', status: 'planned' }],
    },
    surface: 'planner',
    requestContext: { currentHour: 9 },
  });
  assert.equal(result.allowedActions.some((item) => item.targetId === targetId), false, 'exact target id blocks before title similarity');
}

{
  const result = DecisionEngine.evaluate({
    dailyContext: context,
    surface: 'planner',
    requestContext: { phase: 'Estável', currentHour: 10, currentMinute: 15 },
  });

  assert.equal(result.allowedActions[0]?.kind, 'suggested_commitment');
  // Sugestão operacional entra no dia sozinha; notificar continua sendo decisão
  // separada — criar bloco é barato, tocar o celular não é.
  assert.equal(result.allowedActions[0]?.requiresConfirmation, false);
  assert.equal(result.allowedActions[0]?.notificationAllowed, false);
  assert.match(result.allowedActions[0]?.reason ?? '', /Agenda sem pendências reais/);
}

{
  const result = DecisionEngine.evaluate({
    dailyContext: {
      ...context,
      activeGoalTitles: [],
      todayAnchorTitles: [],
    },
    surface: 'home',
    requestContext: { phase: 'Estável' },
  });

  assert.equal(result.allowedActions[0]?.kind, 'insight_only');
  assert.equal(result.emptyReason, 'Sem candidato operacional confiável; manter como insight.');
  assert.equal(result.allowedActions.length, 1);
  assert.equal(result.allowedActions[0]?.source, 'system');
  assert.equal(result.allowedActions[0]?.action, 'insight');
  assert.match(result.allowedActions[0]?.title ?? '', /âncora|ancora|falta/i);
}

{
  const empty = {
    ...context,
    activeGoalTitles: [],
    todayAnchorTitles: [],
  };
  for (const surface of ['home', 'aura-chat', 'checkin'] as const) {
    const result = DecisionEngine.evaluate({
      dailyContext: empty,
      surface,
      requestContext: { phase: 'stable', currentHour: 9 },
    });
    assert.equal(result.allowedActions.length, 1, `${surface} must expose one principal movement`);
    assert.equal(result.allowedActions[0]?.kind, 'insight_only');
  }
}

{
  const result = DecisionEngine.evaluate({
    dailyContext: { ...context, activeGoalTitles: [], todayAnchorTitles: [] },
    surface: 'aura-chat',
    requestContext: {
      phase: 'stable',
      explicitActionRequested: true,
      explicitActionTitle: 'Revisar o contrato da Airia',
    },
  });
  assert.equal(result.allowedActions.length, 1);
  assert.equal(result.allowedActions[0]?.kind, 'suggested_commitment');
  assert.equal(result.allowedActions[0]?.source, 'request');
  assert.equal(result.allowedActions[0]?.anchor, 'Revisar o contrato da Airia');
}

{
  const multiAnchorContext: DailyContext = {
    ...context,
    activeGoalTitles: [],
    todayAnchorTitles: ['Tarefa A', 'Tarefa B'],
    pendingTaskTitles: ['Tarefa A', 'Tarefa B'],
    tasks: [
      { id: 'task-a', title: 'Tarefa A', status: 'planned', startAt: new Date('2026-04-30T09:00:00.000Z'), endAt: new Date('2026-04-30T10:00:00.000Z') },
      { id: 'task-b', title: 'Tarefa B', status: 'planned', startAt: new Date('2026-04-30T11:00:00.000Z'), endAt: new Date('2026-04-30T12:00:00.000Z') },
    ],
  };
  const home = DecisionEngine.evaluate({ dailyContext: multiAnchorContext, surface: 'home', requestContext: { phase: 'stable', currentHour: 8 } });
  const planner = DecisionEngine.evaluate({ dailyContext: multiAnchorContext, surface: 'planner', requestContext: { phase: 'stable', currentHour: 8 } });
  assert.equal(home.allowedActions.length, 1, 'Home must select one principal movement');
  assert.ok(planner.allowedActions.length > 1, 'Planner may expose multiple grounded adjustments');
}

{
  const result = DecisionEngine.evaluate({
    dailyContext: {
      ...context,
      pendingTaskTitles: ['Responder cliente'],
      tasks: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          title: 'Responder cliente',
          status: 'planned',
          category: 'trabalho',
          intensity: 'P',
          startAt: new Date('2026-04-30T09:00:00.000Z'),
          endAt: new Date('2026-04-30T10:00:00.000Z'),
        },
      ],
    },
    surface: 'planner',
    requestContext: { phase: 'Turbulência', currentHour: 8, currentMinute: 30 },
  });

  // With phase-aware windows: Turbulência has no peak/flow; 09:00 is 'rest' tier.
  // Heavy task outside the window gets 'pause' (not 'shrink') + phaseNote bioReason.
  assert.equal(result.allowedActions[0]?.kind, 'real_commitment');
  assert.equal(result.allowedActions[0]?.action, 'pause');
  assert.equal(result.allowedActions[0]?.targetId, '11111111-1111-4111-8111-111111111111');
  assert.equal(result.allowedActions[0]?.targetType, 'timeline');
  assert.equal(result.allowedActions[0]?.suggestedStartTime, null);
  assert.equal(result.allowedActions[0]?.suggestedEndTime, null);
  assert.match(result.allowedActions[0]?.bioReason ?? '', /fora da janela|turbulencia|11:00/);
  assert.equal(result.allowedActions[0]?.impactLabel, 'protege energia');
  assert.equal(result.allowedActions[0]?.notificationAllowed, true);
}

{
  const result = DecisionEngine.evaluate({
    dailyContext: {
      ...context,
      pendingTaskTitles: ['Responder cliente'],
      tasks: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          title: 'Responder cliente',
          status: 'planned',
          category: 'trabalho',
          intensity: 'P',
          startAt: new Date('2026-04-30T11:00:00.000Z'),
          endAt: new Date('2026-04-30T12:00:00.000Z'),
        },
      ],
    },
    surface: 'planner',
    requestContext: { phase: 'Pausa', currentHour: 8, currentMinute: 30 },
  });

  // Task at 11:00 is WITHIN Pausa's maintenance window [11:00,13:00).
  // In-window heavy tasks get 'shrink' (reduce scope); 'pause' is reserved for out-of-window tasks.
  assert.equal(result.allowedActions[0]?.kind, 'real_commitment');
  assert.equal(result.allowedActions[0]?.action, 'shrink');
  assert.equal(result.allowedActions[0]?.targetId, '22222222-2222-4222-8222-222222222222');
  assert.equal(result.allowedActions[0]?.notificationAllowed, true);
}

{
  const result = DecisionEngine.evaluate({
    dailyContext: {
      ...context,
      healthSignals: {
        source: 'health_connect',
        localDate: '2026-04-30',
        sleepMinutes: 285,
        sleepScore: 3,
        steps: 1200,
        avgHeartRate: 82,
        exerciseMinutes: 0,
        lastSyncedAt: '2026-04-30T08:00:00.000Z',
      },
      pendingTaskTitles: ['Revisar proposta'],
      tasks: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          title: 'Revisar proposta',
          status: 'planned',
          category: 'trabalho',
          intensity: 'P',
          startAt: new Date('2026-04-30T13:00:00.000Z'),
          endAt: new Date('2026-04-30T14:00:00.000Z'),
        },
      ],
    },
    surface: 'planner',
    requestContext: { phase: 'Estável', currentHour: 8, currentMinute: 30 },
  });

  assert.equal(result.allowedActions[0]?.action, 'shrink');
  assert.match(result.allowedActions[0]?.bioReason ?? '', /Health Connect/);
  assert.match(result.reasoning, /sinais corporais/);
}

{
  const dailyContext: DailyContext = {
    ...context,
    activeGoalTitles: [],
    todayAnchorTitles: ['Revisar proposta'],
    pendingTaskTitles: ['Revisar proposta'],
    tasks: [{
      id: 'phase-low-task',
      title: 'Revisar proposta',
      status: 'planned',
      category: 'trabalho',
      intensity: 'P',
      startAt: new Date('2026-04-30T09:00:00.000Z'),
      endAt: new Date('2026-04-30T10:00:00.000Z'),
    }],
  };
  const byId = DecisionEngine.evaluate({ dailyContext, surface: 'planner', requestContext: { phase: 'low', currentHour: 8 } });
  const byLabel = DecisionEngine.evaluate({ dailyContext, surface: 'planner', requestContext: { phase: 'Recolhimento', currentHour: 8 } });
  assert.deepEqual(
    byId.allowedActions.map(({ action, suggestedStartTime, suggestedEndTime }) => ({ action, suggestedStartTime, suggestedEndTime })),
    byLabel.allowedActions.map(({ action, suggestedStartTime, suggestedEndTime }) => ({ action, suggestedStartTime, suggestedEndTime })),
    'internal low id and Portuguese Recolhimento must yield identical planning decisions',
  );
}

console.log('decision-engine.service tests passed');
