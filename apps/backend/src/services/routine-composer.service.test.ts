import assert from 'node:assert/strict';

import type { RoutineClassifiedItem } from '../contracts/routine-builder.contract';
import { RoutineComposerService } from './routine-composer.service';

function item(overrides: Partial<RoutineClassifiedItem>): RoutineClassifiedItem {
  return {
    id: 'task-1',
    kind: 'task',
    title: 'Revisar proposta comercial',
    sourceExcerpt: 'Preciso revisar a proposta comercial',
    confidence: 0.95,
    reviewState: 'confirmed',
    isFixed: false,
    ...overrides,
  };
}

{
  const plan = RoutineComposerService.compose({
    weekStart: '2026-07-27',
    items: [
      item({ id: 'task-1', durationMinutes: 60, deadline: '2026-07-28' }),
      item({
        id: 'habit-1',
        kind: 'habit',
        title: 'Caminhar no bairro',
        durationMinutes: 30,
        recurrence: { frequency: 'weekly', daysOfWeek: [2], interval: 1 },
      }),
      item({ id: 'reference-1', kind: 'reference', title: 'Orçamento da tinta' }),
    ],
    limits: { wakeTime: '07:00', sleepTime: '23:00', maxDailyLoadMinutes: 360, unavailable: [] },
    existingBlocks: [{
      id: 'fixed-1',
      date: '2026-07-28',
      startTime: '10:00',
      endTime: '11:00',
      title: 'Consulta médica',
      isFixed: true,
    }],
    existingHabits: [{
      id: 'existing-habit-1',
      title: 'Tomar suplemento',
      frequency: 'weekly',
      targetDays: [1, 3, 5],
      durationMinutes: 5,
    }],
    capacity: { level: 'balanced', reason: 'Energia estável informada no check-in.' },
  });

  const fixed = plan.entries.find((entry) => entry.id === 'existing:fixed-1');
  assert.ok(fixed);
  assert.equal(fixed?.startTime, '10:00');
  assert.equal(fixed?.isFixed, true);

  const habitEntries = plan.entries.filter((entry) => entry.sourceItemId === 'habit-1');
  assert.equal(habitEntries.length, 1);
  assert.equal(habitEntries[0].date, '2026-07-28');

  const existingHabitEntries = plan.entries.filter((entry) => entry.id.startsWith('existing-habit:existing-habit-1'));
  assert.deepEqual(existingHabitEntries.map((entry) => entry.date), ['2026-07-27', '2026-07-29', '2026-07-31']);
  assert.equal(existingHabitEntries.every((entry) => entry.persist === false), true);

  const scheduledTask = plan.entries.find((entry) => entry.sourceItemId === 'task-1');
  assert.ok(scheduledTask);
  assert.notEqual(scheduledTask?.startTime, '10:00');
  assert.equal(plan.contextItems.some((context) => context.sourceItemId === 'reference-1'), true);
}

{
  const plan = RoutineComposerService.compose({
    weekStart: '2026-07-27',
    items: [item({ id: 'heavy-1', title: 'Pintar a sala', durationMinutes: 120 })],
    limits: { wakeTime: '08:00', sleepTime: '22:00', maxDailyLoadMinutes: 360, unavailable: [] },
    existingBlocks: [],
    existingHabits: [],
    capacity: { level: 'low', reason: 'Check-in mostra energia 2 de 10.' },
  });
  const entry = plan.entries.find((candidate) => candidate.sourceItemId === 'heavy-1');
  assert.ok(entry);
  assert.equal(entry?.durationMinutes, 30);
  assert.match(entry?.reason ?? '', /energia 2 de 10|bloco de entrada/i);
  assert.ok(plan.days[0].flexibleMinutes <= 120);
}

{
  const plan = RoutineComposerService.compose({
    weekStart: '2026-07-27',
    items: [item({ id: 'excluded-1', reviewState: 'excluded' })],
    limits: { wakeTime: '07:00', sleepTime: '23:00', maxDailyLoadMinutes: 360, unavailable: [] },
    existingBlocks: [],
    existingHabits: [],
    capacity: { level: 'balanced', reason: 'Sem redução de carga.' },
  });
  assert.equal(plan.entries.some((entry) => entry.sourceItemId === 'excluded-1'), false);
}

console.log('routine-composer.service tests passed');
