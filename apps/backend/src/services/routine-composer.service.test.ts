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

{
  const plan = RoutineComposerService.compose({
    weekStart: '2026-07-27',
    items: [
      item({
        id: 'fixed-recurring',
        kind: 'calendar',
        title: 'Aula semanal',
        startTime: '10:00',
        durationMinutes: 90,
        recurrence: { frequency: 'weekly', daysOfWeek: [2], interval: 1 },
        isFixed: true,
      }),
      item({
        id: 'task-near-fixed',
        title: 'Preparar material da aula',
        durationMinutes: 45,
        date: '2026-07-28',
      }),
    ],
    limits: { wakeTime: '08:00', sleepTime: '18:00', maxDailyLoadMinutes: 360, unavailable: [] },
    existingBlocks: [],
    existingHabits: [],
    capacity: { level: 'balanced', reason: 'Energia estável.' },
  });

  const fixed = plan.entries.find((entry) => entry.sourceItemId === 'fixed-recurring');
  const task = plan.entries.find((entry) => entry.sourceItemId === 'task-near-fixed');
  assert.equal(fixed?.date, '2026-07-28');
  assert.equal(fixed?.startTime, '10:00');
  assert.equal(fixed?.endTime, '11:30');
  assert.equal(fixed?.isFixed, true);
  assert.ok(task);
  assert.equal(
    task!.endTime <= '09:45' || task!.startTime >= '11:45',
    true,
    'a flexible task must not move or overlap a protected commitment',
  );
}

{
  const plan = RoutineComposerService.compose({
    weekStart: '2026-07-27',
    items: [
      item({ id: 'a-low', title: 'Tarefa de baixa prioridade', priority: 'low', durationMinutes: 30, deadline: '2026-07-27' }),
      item({ id: 'z-high', title: 'Tarefa de alta prioridade', priority: 'high', durationMinutes: 30, deadline: '2026-07-27' }),
    ],
    limits: { wakeTime: '08:00', sleepTime: '10:00', maxDailyLoadMinutes: 120, unavailable: [] },
    existingBlocks: [],
    existingHabits: [],
    capacity: { level: 'balanced', reason: 'Energia estável.' },
  });
  const low = plan.entries.find((entry) => entry.sourceItemId === 'a-low');
  const high = plan.entries.find((entry) => entry.sourceItemId === 'z-high');
  assert.ok(low);
  assert.ok(high);
  assert.ok(high!.startTime < low!.startTime, 'priority must win when deadlines are equal');
  assert.equal(high?.priority, 'high');
  assert.equal(high?.deadline, '2026-07-27');
}

{
  const plan = RoutineComposerService.compose({
    weekStart: '2026-07-27',
    items: [item({
      id: 'habit-evening',
      kind: 'habit',
      title: 'Caminhar no começo da noite',
      durationMinutes: 25,
      recurrence: { frequency: 'weekly', daysOfWeek: [1], interval: 1 },
      timeWindow: {
        startTime: '18:00',
        endTime: '21:00',
        minDurationMinutes: 10,
        maxDurationMinutes: 30,
      },
    })],
    limits: { wakeTime: '07:00', sleepTime: '22:00', maxDailyLoadMinutes: 360, unavailable: [] },
    existingBlocks: [],
    existingHabits: [],
    capacity: { level: 'low', reason: 'Energia baixa informada hoje.' },
  });
  const habit = plan.entries.find((entry) => entry.sourceItemId === 'habit-evening');
  assert.equal(habit?.startTime, '18:00');
  assert.equal(habit?.durationMinutes, 10);
  assert.match(habit?.reason ?? '', /reduzido|10 minutos/i);
}

{
  const plan = RoutineComposerService.compose({
    weekStart: '2026-07-27',
    items: [item({ id: 'task-load', durationMinutes: 90, date: '2026-07-27' })],
    limits: { wakeTime: '08:00', sleepTime: '18:00', maxDailyLoadMinutes: 240, unavailable: [] },
    existingBlocks: [{
      id: 'fixed-load',
      date: '2026-07-27',
      startTime: '08:00',
      endTime: '11:00',
      title: 'Compromisso fixo longo',
      isFixed: true,
    }],
    existingHabits: [],
    capacity: { level: 'balanced', reason: 'Energia estável.' },
  });
  const day = plan.days.find((candidate) => candidate.date === '2026-07-27');
  assert.equal(day?.fixedMinutes, 180);
  assert.equal(day?.predictedMinutes, 180, 'fixed load must reduce the flexible capacity of the day');
  assert.equal(day?.capacityMinutes, 240);
  assert.equal(day?.utilizationPercent, 75);
  assert.equal(day?.status, 'balanced');
  assert.notEqual(
    plan.entries.find((entry) => entry.sourceItemId === 'task-load')?.date,
    '2026-07-27',
    'a flexible task must move instead of overloading a day with protected time',
  );
}

{
  const plan = RoutineComposerService.compose({
    weekStart: '2026-07-27',
    items: [item({
      id: 'task-conflict',
      title: 'Fechar orçamento',
      priority: 'urgent',
      durationMinutes: 60,
      date: '2026-07-27',
      deadline: '2026-07-27',
    })],
    limits: {
      wakeTime: '08:00',
      sleepTime: '09:00',
      maxDailyLoadMinutes: 60,
      unavailable: [{ date: '2026-07-27', startTime: '08:00', endTime: '09:00', reason: 'Consulta' }],
    },
    existingBlocks: [],
    existingHabits: [],
    capacity: { level: 'balanced', reason: 'Energia estável.' },
  });
  const conflict = plan.unscheduled.find((entry) => entry.sourceItemId === 'task-conflict');
  assert.ok(conflict);
  assert.deepEqual(
    conflict?.alternatives.map((alternative) => alternative.action),
    ['move', 'shorten', 'defer'],
  );
  assert.equal(conflict?.alternatives[0].suggestedDate, '2026-08-03');
  assert.equal(conflict?.alternatives[1].durationMinutes, 15);
}

{
  const plan = RoutineComposerService.compose({
    weekStart: '2026-07-27',
    items: [item({
      id: 'monthly-new',
      kind: 'habit',
      title: 'Revisar orçamento mensal',
      durationMinutes: 20,
      recurrence: { frequency: 'monthly', daysOfWeek: [], interval: 1 },
    })],
    limits: { wakeTime: '07:00', sleepTime: '23:00', maxDailyLoadMinutes: 360, unavailable: [] },
    existingBlocks: [],
    existingHabits: [{
      id: 'monthly-existing',
      title: 'Fechar o mês',
      frequency: 'monthly',
      targetDays: [],
      durationMinutes: 10,
    }],
    capacity: { level: 'balanced', reason: 'Energia estável.' },
  });

  assert.deepEqual(
    plan.entries.filter((entry) => entry.sourceItemId === 'monthly-new').map((entry) => entry.date),
    ['2026-08-01'],
  );
  assert.deepEqual(
    plan.entries.filter((entry) => entry.id.startsWith('existing-habit:monthly-existing')).map((entry) => entry.date),
    ['2026-08-01'],
  );

  const weekWithoutFirstDay = RoutineComposerService.compose({
    weekStart: '2026-08-03',
    items: [item({
      id: 'monthly-new',
      kind: 'habit',
      title: 'Revisar orçamento mensal',
      durationMinutes: 20,
      recurrence: { frequency: 'monthly', daysOfWeek: [], interval: 1 },
    })],
    limits: { wakeTime: '07:00', sleepTime: '23:00', maxDailyLoadMinutes: 360, unavailable: [] },
    existingBlocks: [],
    existingHabits: [{
      id: 'monthly-existing',
      title: 'Fechar o mês',
      frequency: 'monthly',
      targetDays: [],
      durationMinutes: 10,
    }],
    capacity: { level: 'balanced', reason: 'Energia estável.' },
  });

  assert.equal(weekWithoutFirstDay.entries.some((entry) => entry.sourceItemId === 'monthly-new'), false);
  assert.equal(weekWithoutFirstDay.entries.some((entry) => entry.id.startsWith('existing-habit:monthly-existing')), false);
}

{
  const plan = RoutineComposerService.compose({
    weekStart: '2026-07-27',
    items: [item({ id: 'available-task', durationMinutes: 30 })],
    limits: {
      wakeTime: '07:00',
      sleepTime: '23:00',
      maxDailyLoadMinutes: 360,
      unavailable: [],
      available: [{
        date: '2026-07-28',
        startTime: '14:00',
        endTime: '15:00',
      }],
    },
    existingBlocks: [],
    existingHabits: [],
    capacity: { level: 'balanced', reason: 'Energia estável.' },
  });

  const task = plan.entries.find((entry) => entry.sourceItemId === 'available-task');
  assert.equal(task?.date, '2026-07-28');
  assert.equal(task?.startTime, '14:00');
  assert.equal(task?.endTime, '14:30');
}

{
  const plan = RoutineComposerService.compose({
    weekStart: '2026-07-27',
    items: [],
    limits: {
      wakeTime: '07:00',
      sleepTime: '23:00',
      maxDailyLoadMinutes: 360,
      unavailable: [],
    },
    existingBlocks: [],
    existingHabits: [{
      id: 'weekly-open',
      title: 'Alongar',
      frequency: 'weekly',
      targetDays: [],
      durationMinutes: 10,
      timeOfDay: 'morning',
    }],
    capacity: { level: 'balanced', reason: 'Energia estável.' },
  });

  assert.equal(
    plan.entries.filter((entry) => entry.id.startsWith('existing-habit:weekly-open')).length,
    7,
    'weekly habit without fixed weekdays follows the same every-day due rule used by the product',
  );
}

{
  const plan = RoutineComposerService.compose({
    weekStart: '2026-07-27',
    items: [item({
      id: 'weekly-flexible',
      kind: 'habit',
      durationMinutes: 10,
      recurrence: { frequency: 'weekly', daysOfWeek: [], timesPerWeek: 2, interval: 1 },
    })],
    limits: {
      wakeTime: '07:00',
      sleepTime: '23:00',
      maxDailyLoadMinutes: 360,
      unavailable: [],
    },
    existingBlocks: [],
    existingHabits: [],
    capacity: { level: 'balanced', reason: 'Energia estável.' },
  });

  assert.equal(
    plan.entries.filter((entry) => entry.sourceItemId === 'weekly-flexible').length,
    2,
    'new weekly habit without fixed weekdays respects its requested weekly count',
  );
}

console.log('routine-composer.service tests passed');
