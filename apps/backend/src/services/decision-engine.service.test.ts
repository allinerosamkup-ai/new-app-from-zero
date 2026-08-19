import assert from 'node:assert/strict';

import type { DailyContext } from './context-grounding.service';
import { DecisionEngine } from './decision-engine.service';

function context(overrides: Partial<DailyContext> = {}): DailyContext {
  return {
    source: 'ContextGroundingService',
    date: '2026-04-30',
    pendingTaskTitles: [],
    completedTaskTitles: [],
    pendingHabitTitles: [],
    completedHabitTitles: [],
    activeGoalTitles: [],
    completedGoalTitles: [],
    completedSubgoalTitles: [],
    recentSuggestionTitles: [],
    blockedActionTitles: [],
    todayAnchorTitles: [],
    tasks: [],
    habits: [],
    goals: [],
    actionFeedback: [],
    patternMemoryContext: '',
    operationalRule: 'Contexto antigo explica padrão; ação do dia precisa de âncora operacional atual.',
    ...overrides,
  };
}

{
  const result = DecisionEngine.evaluate({
    dailyContext: context({
      activeGoalTitles: ['Enviar proposta comercial'],
      todayAnchorTitles: ['Abrir a proposta comercial e escrever o primeiro tópico'],
      goals: [{
        id: 'goal-1',
        title: 'Enviar proposta comercial',
        progress: 40,
        subgoals: [{
          id: 'action-1',
          title: 'Abrir a proposta comercial e escrever o primeiro tópico',
          doneWhen: 'o primeiro tópico estiver visível na proposta',
          done: false,
        }],
      }],
    }),
    surface: 'checkin',
    requestContext: { phase: 'Estável', currentHour: 10, currentMinute: 15 },
  });

  const action = result.allowedActions.find((item) => item.targetType === 'goal');
  assert.ok(action);
  assert.equal(action?.kind, 'suggested_commitment');
  assert.equal(action?.title, 'Abrir a proposta comercial e escrever o primeiro tópico');
  assert.equal(action?.doneWhen, 'o primeiro tópico estiver visível na proposta');
  assert.equal(action?.targetId, 'goal-1');
}

{
  const result = DecisionEngine.evaluate({
    dailyContext: context({
      activeGoalTitles: ['Organizar a vida'],
      goals: [{ id: 'goal-2', title: 'Organizar a vida', progress: 10, subgoals: [] }],
    }),
    surface: 'home',
    requestContext: { phase: 'Estável' },
  });
  assert.equal(result.allowedActions[0]?.kind, 'insight_only');
  assert.equal(result.emptyReason, 'Sem candidato operacional confiável; manter como insight.');
}

{
  const result = DecisionEngine.evaluate({
    dailyContext: context({
      activeGoalTitles: ['Enviar proposta comercial'],
      blockedActionTitles: ['Abrir a proposta comercial e escrever o primeiro tópico'],
      goals: [{
        id: 'goal-3',
        title: 'Enviar proposta comercial',
        progress: 40,
        subgoals: [{
          id: 'action-3',
          title: 'Abrir a proposta comercial e escrever o primeiro tópico',
          doneWhen: 'o primeiro tópico estiver visível na proposta',
          done: false,
        }],
      }],
    }),
    surface: 'home',
    requestContext: { phase: 'Estável' },
  });
  assert.equal(result.allowedActions.some((item) => item.targetId === 'goal-3'), false);
}

{
  const result = DecisionEngine.evaluate({
    dailyContext: context(),
    surface: 'aura-chat',
    requestContext: { phase: 'stable', explicitActionRequested: true, explicitActionTitle: 'Abrir o contrato atual e marcar a cláusula pendente' },
  });
  assert.equal(result.allowedActions[0]?.source, 'request');
  assert.equal(result.allowedActions[0]?.kind, 'suggested_commitment');
}

console.log('decision-engine.service tests passed');
