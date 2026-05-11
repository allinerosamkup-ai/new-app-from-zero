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
  const result = DecisionEngine.evaluate({
    dailyContext: context,
    surface: 'planner',
    requestContext: { phase: 'Estável', currentHour: 10, currentMinute: 15 },
  });

  assert.equal(result.allowedActions[0]?.kind, 'suggested_commitment');
  assert.equal(result.allowedActions[0]?.requiresConfirmation, true);
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

console.log('decision-engine.service tests passed');
