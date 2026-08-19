import assert from 'node:assert/strict';

import type { DailyContext } from './context-grounding.service';
import { AgendaAdaptationService } from './agenda-adaptation.service';

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
  const preview = AgendaAdaptationService.buildPreview({
    dailyContext: context(),
    requestContext: { phase: 'Estável' },
    trigger: 'checkin',
  });
  assert.equal(preview.changes.length, 0);
}

{
  const preview = AgendaAdaptationService.buildPreview({
    dailyContext: context({
      activeGoalTitles: ['Enviar proposta para investidor'],
      todayAnchorTitles: ['Abrir a proposta do investidor e escrever o primeiro tópico'],
      goals: [{
        id: 'goal-1',
        title: 'Enviar proposta para investidor',
        progress: 20,
        subgoals: [{
          id: 'action-1',
          title: 'Abrir a proposta do investidor e escrever o primeiro tópico',
          doneWhen: 'o primeiro tópico estiver visível na proposta',
          done: false,
        }],
      }],
    }),
    requestContext: { phase: 'Estável' },
    trigger: 'checkin',
  });
  assert.equal(preview.changes.length, 1);
  assert.equal(preview.changes[0]?.type, 'suggest');
  assert.equal(preview.changes[0]?.targetType, 'goal');
  assert.equal(preview.changes[0]?.title, 'Abrir a proposta do investidor e escrever o primeiro tópico');
  assert.equal(preview.changes[0]?.suggestedStartTime, null);
  assert.equal(preview.changes[0]?.suggestedEndTime, null);
}

console.log('agenda-adaptation.service tests passed');
