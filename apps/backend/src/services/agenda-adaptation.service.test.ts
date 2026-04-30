import assert from 'node:assert/strict';

import { AgendaAdaptationService } from './agenda-adaptation.service';
import type { DailyContext } from './context-grounding.service';

const baseContext: DailyContext = {
  source: 'ContextGroundingService',
  date: '2026-04-30',
  pendingTaskTitles: ['Responder cliente'],
  completedTaskTitles: ['Treino'],
  pendingHabitTitles: ['Diário'],
  completedHabitTitles: ['Ginástica'],
  activeGoalTitles: ['Preparar proposta da Airia'],
  completedGoalTitles: [],
  completedSubgoalTitles: ['Separar prints'],
  recentSuggestionTitles: ['Separar roupa de treino'],
  blockedActionTitles: ['Kit do treino'],
  todayAnchorTitles: ['Responder cliente', 'Diário', 'Preparar proposta da Airia'],
  tasks: [
    {
      title: 'Responder cliente',
      status: 'planned',
      category: 'trabalho',
      intensity: 'P',
      startAt: new Date('2026-04-30T11:00:00.000Z'),
      endAt: new Date('2026-04-30T12:00:00.000Z'),
    },
  ],
  habits: [],
  goals: [],
  actionFeedback: [],
  patternMemoryContext: 'Memória antiga sobre treino.',
  operationalRule: 'Contexto antigo explica padrão; ação do dia precisa de âncora operacional atual.',
};

{
  const result = AgendaAdaptationService.buildPreview({
    dailyContext: baseContext,
    requestContext: { phase: 'Turbulência' },
    trigger: 'checkin',
  });

  assert.equal(result.date, '2026-04-30');
  assert.equal(result.trigger, 'checkin');
  assert.equal(result.changes[0]?.type, 'pause');
  assert.match(result.changes[0]?.reason ?? '', /Turbulência/);
  assert.ok(result.blockedSuggestions.includes('Treino'));
  assert.ok(result.blockedSuggestions.includes('Separar roupa de treino'));
}

{
  const result = AgendaAdaptationService.buildPreview({
    dailyContext: {
      ...baseContext,
      tasks: [],
      pendingTaskTitles: [],
      pendingHabitTitles: [],
      todayAnchorTitles: [],
    },
    requestContext: { phase: 'Estável' },
  });

  assert.deepEqual(result.changes, []);
  assert.match(result.summary, /não inventar tarefa/);
}

console.log('agenda-adaptation.service tests passed');
