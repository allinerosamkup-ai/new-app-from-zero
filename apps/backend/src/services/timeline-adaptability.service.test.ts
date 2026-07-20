import assert from 'node:assert/strict';

import { DecisionEngine } from './decision-engine.service';
import type { DailyContext, GroundedTask } from './context-grounding.service';
import { inferTimelineAdaptability } from './timeline-adaptability-inference.service';
import { buildPostponeAdaptabilityUpdate } from './planner.service';

function contextWithTask(task: GroundedTask): DailyContext {
  return {
    source: 'ContextGroundingService',
    date: '2026-04-30',
    pendingTaskTitles: [task.title],
    completedTaskTitles: [],
    pendingHabitTitles: [],
    completedHabitTitles: [],
    activeGoalTitles: [],
    completedGoalTitles: [],
    completedSubgoalTitles: [],
    recentSuggestionTitles: [],
    blockedActionTitles: [],
    todayAnchorTitles: [task.title],
    tasks: [task],
    habits: [],
    goals: [],
    actionFeedback: [],
    patternMemoryContext: '',
    operationalRule: 'Contexto antigo explica padrão; ação do dia precisa de âncora operacional atual.',
  };
}

{
  const result = DecisionEngine.evaluate({
    dailyContext: contextWithTask({
      id: '44444444-4444-4444-8444-444444444444',
      title: 'Reunião com cliente',
      status: 'planned',
      category: 'trabalho',
      intensity: 'P',
      startAt: new Date('2026-04-30T07:00:00.000Z'),
      endAt: new Date('2026-04-30T08:00:00.000Z'),
      temporalPolicy: 'fixed',
      adaptationPermission: 'protected',
    }),
    surface: 'planner',
    requestContext: { phase: 'Turbulência', currentHour: 9, currentMinute: 30 },
  });

  assert.equal(result.allowedActions[0]?.action, 'keep');
  assert.equal(result.allowedActions[0]?.requiresConfirmation, false);
  assert.equal(result.allowedActions[0]?.suggestedDate, '2026-04-30');
  assert.equal(result.allowedActions[0]?.suggestedStartTime, null);
  assert.match(result.allowedActions[0]?.reason ?? '', /protegido|fixo/i);
}

{
  const result = DecisionEngine.evaluate({
    dailyContext: contextWithTask({
      id: '55555555-5555-4555-8555-555555555555',
      title: 'Rascunhar proposta',
      status: 'planned',
      category: 'trabalho',
      intensity: 'M',
      startAt: new Date('2026-04-30T07:00:00.000Z'),
      endAt: new Date('2026-04-30T08:00:00.000Z'),
      temporalPolicy: 'flexible',
      adaptationPermission: 'eligible',
    }),
    surface: 'planner',
    requestContext: { phase: 'Estável', currentHour: 9, currentMinute: 30 },
  });

  assert.equal(result.allowedActions[0]?.action, 'move');
  assert.equal(result.allowedActions[0]?.requiresConfirmation, true);
}

{
  const google = inferTimelineAdaptability({ title: 'Evento importado', gcalEventId: 'google-1' });
  assert.equal(google.temporalPolicy, 'fixed');
  assert.equal(google.adaptationPermission, 'protected');
  assert.equal(google.inferenceSource, 'google_calendar');
  assert.equal(google.inferenceConfidence, 1);

  const recurring = inferTimelineAdaptability({
    title: 'Rotina de atendimento',
    recurring: { enabled: true, frequency: 'weekly' },
  });
  assert.equal(recurring.temporalPolicy, 'windowed');
  assert.equal(recurring.adaptationPermission, 'preview');
  assert.equal(recurring.inferenceSource, 'recurring_schedule');

  const meeting = inferTimelineAdaptability({ title: 'Reunião com cliente' });
  assert.equal(meeting.temporalPolicy, 'windowed');
  assert.equal(meeting.adaptationPermission, 'preview');
  assert.equal(meeting.inferenceSource, 'commitment_pattern');

  const aiTask = inferTimelineAdaptability({ title: 'Rascunhar proposta', isAiSuggested: true });
  assert.equal(aiTask.temporalPolicy, 'flexible');
  assert.equal(aiTask.inferenceSource, 'ai_suggestion');

  const ambiguous = inferTimelineAdaptability({ title: 'Organizar documentos' });
  assert.equal(ambiguous.temporalPolicy, 'windowed');
  assert.equal(ambiguous.adaptationPermission, 'preview');

  const manualClass = inferTimelineAdaptability({
    title: 'Aula de desenho',
    temporalPolicy: 'flexible',
    adaptationPermission: 'eligible',
    adaptabilitySource: 'manual',
    adaptabilityConfidence: 1,
  });
  assert.equal(manualClass.temporalPolicy, 'flexible');
  assert.equal(manualClass.adaptationPermission, 'eligible');
  assert.equal(manualClass.inferenceSource, 'manual_override');

  const immutableGoogle = inferTimelineAdaptability({
    title: 'Evento Google que parece flexível',
    gcalEventId: 'gcal-immutable',
    temporalPolicy: 'flexible',
    adaptationPermission: 'eligible',
    adaptabilitySource: 'manual',
  });
  assert.equal(immutableGoogle.temporalPolicy, 'fixed');
  assert.equal(immutableGoogle.adaptationPermission, 'protected');
  assert.equal(immutableGoogle.inferenceSource, 'google_calendar');

  const postponed = inferTimelineAdaptability({ title: 'Reunião remarcada', wasPostponed: true });
  assert.equal(postponed.temporalPolicy, 'flexible');
  assert.equal(postponed.inferenceSource, 'postponed_task');
  assert.deepEqual(buildPostponeAdaptabilityUpdate({ adaptabilitySource: 'language' }), {
    temporalPolicy: 'flexible',
    adaptationPermission: 'eligible',
    adaptabilitySource: 'behavior',
    adaptabilityConfidence: 0.84,
  });
  assert.deepEqual(buildPostponeAdaptabilityUpdate({ adaptabilitySource: 'manual' }), {});
}

console.log('timeline adaptability tests passed');
