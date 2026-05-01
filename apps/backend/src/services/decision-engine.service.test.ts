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

  assert.equal(result.allowedActions[0]?.kind, 'real_commitment');
  assert.equal(result.allowedActions[0]?.action, 'pause');
  assert.equal(result.allowedActions[0]?.notificationAllowed, true);
}

console.log('decision-engine.service tests passed');
