import assert from 'node:assert/strict';

import {
  RoutineClassifiedItemSchema,
  RoutineCreateSessionSchema,
  RoutineSessionStatusSchema,
  RoutineSourceSchema,
  canTransitionRoutineSession,
} from './routine-builder.contract';

const date = '2026-07-27';

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
  assert.equal(canTransitionRoutineSession('draft', 'classified'), true);
  assert.equal(canTransitionRoutineSession('classified', 'applied'), false);
  assert.equal(canTransitionRoutineSession('applied', 'draft'), false);
}

console.log('routine-builder.contract tests passed');
