import assert from 'node:assert/strict';

import type { DailyContext } from './context-grounding.service';
import { AdaptiveAgendaEngine, buildDayStructureProfile } from './adaptive-agenda-engine.service';

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
  const profile = buildDayStructureProfile(context());
  assert.equal(profile.mode, 'open');
  assert.equal(profile.freeMinutes, 720);
}

{
  const plan = AdaptiveAgendaEngine.plan({
    dailyContext: context({
      activeGoalTitles: ['Enviar proposta para investidor'],
      todayAnchorTitles: ['Abrir a proposta do investidor e escrever o primeiro tópico'],
      goals: [{
        id: 'goal-investor',
        title: 'Enviar proposta para investidor',
        progress: 20,
        subgoals: [{
          id: 'goal-investor-action',
          title: 'Abrir a proposta do investidor e escrever o primeiro tópico',
          doneWhen: 'o primeiro tópico estiver visível na proposta',
          done: false,
        }],
      }],
    }),
    trigger: 'manual',
    surface: 'home',
    requestContext: { phase: 'Fluindo', currentHour: 11, currentMinute: 0 },
  });
  assert.equal(plan.decisions.length, 1);
  assert.equal(plan.decisions[0]?.type, 'suggest');
  assert.equal(plan.decisions[0]?.targetType, 'goal');
  assert.equal(plan.decisions[0]?.title, 'Abrir a proposta do investidor e escrever o primeiro tópico');
  assert.equal(plan.decisions[0]?.suggestedStartTime, null);
  assert.equal(plan.decisions[0]?.suggestedEndTime, null);
}

{
  const plan = AdaptiveAgendaEngine.plan({
    dailyContext: context({ activeGoalTitles: ['Organizar a vida'] }),
    trigger: 'manual',
    surface: 'home',
    requestContext: { phase: 'Estável', currentHour: 9, currentMinute: 0 },
  });
  assert.equal(plan.decisions.length, 0);
}

console.log('adaptive-agenda-engine.service tests passed');
