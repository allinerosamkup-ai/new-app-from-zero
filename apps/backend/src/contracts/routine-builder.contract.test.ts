import assert from 'node:assert/strict';

import {
  RoutineBuilderModeSchema,
  RoutineClassifiedItemSchema,
  RoutineCreateSessionSchema,
  RoutineGuidedAnswersSchema,
  RoutineGuidedHabitSchema,
  RoutineSessionStatusSchema,
  RoutineSourceSchema,
  canTransitionRoutineSession,
} from './routine-builder.contract';

const date = '2026-07-27';
const guidedHabit = {
  templateId: 'evening-wind-down',
  title: 'Preparar o sono',
  frequency: 'weekly',
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  timeOfDay: 'evening',
  durationMinutes: 15,
} as const;

const guidedAnswers = {
  lifeAreas: ['work', 'home'],
  availability: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }],
  energyDrains: ['meetings'],
  energyRestorers: ['walking'],
  intentions: ['sleep_better'],
  selectedHabits: [guidedHabit],
  currentState: { mood: 5, energy: 4, focus: 4, sleepQuality: 'irregular' },
};

{
  const kinds = ['goal', 'project', 'task', 'habit', 'calendar', 'reference', 'concern'];
  for (const kind of kinds) {
    const result = RoutineClassifiedItemSchema.safeParse({
      id: `item-${kind}`,
      kind,
      title: `Item ${kind}`,
      sourceExcerpt: `Trecho de origem para ${kind}`,
      confidence: 0.82,
      classificationReason: 'A forma verbal e a recorrência sustentam esta classificação.',
    });
    assert.equal(result.success, true, `kind ${kind} should be accepted`);
  }
}

{
  const result = RoutineClassifiedItemSchema.safeParse({
    id: 'habit-1',
    kind: 'habit',
    title: 'Caminhar três vezes por semana',
    sourceExcerpt: 'Quero caminhar segunda, quarta e sexta.',
    confidence: 1.2,
  });
  assert.equal(result.success, false, 'confidence above 1 must be rejected');
}

{
  const result = RoutineClassifiedItemSchema.parse({
    id: 'calendar-1',
    kind: 'calendar',
    title: 'Consulta médica',
    sourceExcerpt: 'Consulta terça às 14h.',
    confidence: 0.96,
    date,
    startTime: '14:00',
    durationMinutes: 60,
    isFixed: true,
  });
  assert.equal(result.reviewState, 'pending');
  assert.equal(result.isFixed, true);
}

{
  const result = RoutineCreateSessionSchema.parse({
    focus: 'Organizar a mudança sem abandonar o trabalho',
    weekStart: date,
    timezone: 'America/Sao_Paulo',
  });
  assert.equal(result.locale, 'pt-BR');
  assert.equal(result.limits.maxDailyLoadMinutes, 360);
}

{
  assert.equal(RoutineBuilderModeSchema.safeParse('guided').success, true);
  assert.equal(RoutineBuilderModeSchema.safeParse('import').success, true);
  assert.equal(RoutineBuilderModeSchema.safeParse('manual').success, false);
}

{
  const result = RoutineGuidedAnswersSchema.parse(guidedAnswers);
  assert.equal(result.selectedHabits[0].durationMinutes, 15);
  assert.equal(result.freeText, undefined, 'freeText must remain optional');
}

{
  const result = RoutineCreateSessionSchema.parse({
    mode: 'guided',
    weekStart: '2026-07-20',
    timezone: 'America/Sao_Paulo',
  });
  assert.equal(result.mode, 'guided');
  assert.equal(result.focus, undefined, 'guided sessions must not require focus');
}

{
  const importWithoutFocus = RoutineCreateSessionSchema.safeParse({
    mode: 'import',
    weekStart: '2026-07-20',
    timezone: 'America/Sao_Paulo',
  });
  const legacyWithoutFocus = RoutineCreateSessionSchema.safeParse({
    weekStart: '2026-07-20',
    timezone: 'America/Sao_Paulo',
  });
  assert.equal(importWithoutFocus.success, false, 'import sessions must require focus');
  assert.equal(legacyWithoutFocus.success, false, 'legacy sessions must still require focus');

  const legacyWithFocus = RoutineCreateSessionSchema.parse({
    focus: 'Organizar a semana',
    weekStart: '2026-07-20',
    timezone: 'America/Sao_Paulo',
  });
  assert.equal(legacyWithFocus.mode, 'import', 'omitted mode must default to import');
}

{
  const invalidAvailabilityDay = RoutineGuidedAnswersSchema.safeParse({
    ...guidedAnswers,
    availability: [{ dayOfWeek: 7, startTime: '09:00', endTime: '17:00' }],
  });
  const invalidHabitDay = RoutineGuidedHabitSchema.safeParse({
    ...guidedHabit,
    daysOfWeek: [1, -1],
  });
  assert.equal(invalidAvailabilityDay.success, false, 'availability days outside 0..6 must fail');
  assert.equal(invalidHabitDay.success, false, 'habit days outside 0..6 must fail');
}

{
  const result = RoutineGuidedAnswersSchema.safeParse({
    ...guidedAnswers,
    availability: [{ dayOfWeek: 1, startTime: '17:00', endTime: '09:00' }],
  });
  assert.equal(result.success, false, 'availability endTime must be later than startTime');
}

{
  const result = RoutineGuidedAnswersSchema.parse({
    ...guidedAnswers,
    lifeAreas: ['work', 'work', 'home'],
    energyDrains: ['meetings', 'meetings'],
    selectedHabits: [
      { ...guidedHabit, daysOfWeek: [1, 1, 3] },
      { ...guidedHabit, daysOfWeek: [1, 3] },
    ],
  });
  assert.deepEqual(result.lifeAreas, ['work', 'home']);
  assert.deepEqual(result.energyDrains, ['meetings']);
  assert.deepEqual(result.selectedHabits[0].daysOfWeek, [1, 3]);
  assert.equal(result.selectedHabits.length, 1, 'habit templates must be deduplicated');

  const tooManyLifeAreas = RoutineGuidedAnswersSchema.safeParse({
    ...guidedAnswers,
    lifeAreas: Array.from({ length: 21 }, (_, index) => `area-${index}`),
  });
  assert.equal(tooManyLifeAreas.success, false, 'selection limits must be enforced');
}

{
  const result = RoutineSourceSchema.safeParse({
    sourceType: 'file',
    fileName: 'rotina.exe',
    mimeType: 'application/x-msdownload',
    text: 'conteúdo',
  });
  assert.equal(result.success, false, 'unsupported MIME must be rejected');
}

{
  assert.equal(RoutineSessionStatusSchema.safeParse('ready').success, true);
  assert.equal(RoutineSessionStatusSchema.safeParse('applying').success, true);
  assert.equal(canTransitionRoutineSession('draft', 'classified'), true);
  assert.equal(canTransitionRoutineSession('ready', 'applying'), true);
  assert.equal(canTransitionRoutineSession('applying', 'applied'), true);
  assert.equal(canTransitionRoutineSession('classified', 'applied'), false);
  assert.equal(canTransitionRoutineSession('applied', 'draft'), false);
}

console.log('routine-builder.contract tests passed');
