import assert from 'node:assert/strict';

import { AdaptiveAgendaEngine } from './adaptive-agenda-engine.service';
import type { DailyContext } from './context-grounding.service';

const emptyAgendaWithGoal: DailyContext = {
  source: 'ContextGroundingService',
  date: '2026-04-30',
  pendingTaskTitles: [],
  completedTaskTitles: [],
  pendingHabitTitles: [],
  completedHabitTitles: [],
  activeGoalTitles: ['Enviar proposta para investidor'],
  completedGoalTitles: [],
  completedSubgoalTitles: [],
  recentSuggestionTitles: [],
  blockedActionTitles: [],
  todayAnchorTitles: ['Enviar proposta para investidor'],
  tasks: [],
  habits: [],
  goals: [],
  actionFeedback: [],
  patternMemoryContext: '',
  operationalRule: 'Contexto antigo explica padrão; ação do dia precisa de âncora operacional atual.',
};

{
  const plan = AdaptiveAgendaEngine.plan({
    dailyContext: emptyAgendaWithGoal,
    trigger: 'manual',
    surface: 'planner',
    requestContext: { phase: 'Fluindo', currentHour: 11, currentMinute: 0 },
  });

  assert.equal(plan.decisions[0]?.type, 'suggest');
  assert.equal(plan.decisions[0]?.targetType, 'goal');
  // Phase-aware: at 11:00 in Fluindo, a 60-min task would end at 12:15 (past the 12:00 peak boundary).
  // The algorithm correctly picks the next peak window starting at 15:00.
  assert.equal(plan.decisions[0]?.suggestedStartTime, '15:00');
  assert.equal(plan.decisions[0]?.suggestedEndTime, '16:00');
  assert.equal(plan.decisions[0]?.impactLabel, 'aproveita janela');
  assert.match(plan.decisions[0]?.bioReason ?? '', /janela boa|meta ativa/);
  assert.equal(plan.decisions[0]?.kind, 'suggested_commitment');
  assert.equal(plan.decisions[0]?.requiresConfirmation, true);
  assert.equal(plan.decisions[0]?.notificationAllowed, false);
}

{
  const plan = AdaptiveAgendaEngine.plan({
    dailyContext: {
      ...emptyAgendaWithGoal,
      activeGoalTitles: [],
      todayAnchorTitles: [],
      recentSuggestionTitles: ['Enviar proposta para investidor'],
    },
    trigger: 'home',
    surface: 'home',
  });

  assert.deepEqual(plan.decisions, []);
  assert.match(plan.summary, /não encontrou ajuste confiável/);
}

console.log('adaptive-agenda-engine.service tests passed');
