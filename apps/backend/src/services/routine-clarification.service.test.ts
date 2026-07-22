import assert from 'node:assert/strict';

import type { RoutineClassifiedItem } from '../contracts/routine-builder.contract';
import { RoutineClarificationService } from './routine-clarification.service';

function item(overrides: Partial<RoutineClassifiedItem>): RoutineClassifiedItem {
  return {
    id: 'item-1',
    kind: 'task',
    title: 'Comprar tinta branca',
    sourceExcerpt: 'Preciso comprar tinta branca',
    confidence: 0.9,
    reviewState: 'pending',
    isFixed: false,
    ...overrides,
  };
}

{
  const result = RoutineClarificationService.build([
    item({ id: 'calendar-1', kind: 'calendar', title: 'Consulta com a dentista', isFixed: true }),
    item({ id: 'habit-1', kind: 'habit', title: 'Fazer caminhada' }),
    item({ id: 'task-1', kind: 'task', title: 'Resolver isso', sourceExcerpt: 'Preciso resolver isso' }),
  ]);

  assert.equal(result.needsClarification, true);
  assert.equal(result.questions.length, 3);
  assert.match(result.questions[0].prompt, /Consulta com a dentista/);
  assert.equal(result.questions[0].field, 'date_and_time');
  assert.match(result.questions[1].prompt, /Fazer caminhada/);
  assert.equal(result.questions[1].field, 'recurrence');
  assert.match(result.questions[2].prompt, /Resolver isso/);
  assert.doesNotMatch(result.questions[2].prompt, /conte mais|como posso ajudar|o que você acha/i);
}

{
  const many = Array.from({ length: 8 }, (_, index) => item({
    id: `calendar-${index}`,
    kind: 'calendar',
    title: `Compromisso ${index + 1}`,
    isFixed: true,
  }));
  const result = RoutineClarificationService.build(many);
  assert.equal(result.questions.length, 5, 'must ask at most five blocking questions');
}

{
  const result = RoutineClarificationService.build([
    item({ id: 'task-ok', title: 'Comprar tinta branca', durationMinutes: 30 }),
    item({ id: 'reference-1', kind: 'reference', title: 'Orçamento da loja' }),
    item({ id: 'excluded-1', kind: 'calendar', title: 'Consulta antiga', reviewState: 'excluded' }),
  ]);
  assert.equal(result.needsClarification, false);
  assert.deepEqual(result.questions, []);
}

console.log('routine-clarification.service tests passed');
