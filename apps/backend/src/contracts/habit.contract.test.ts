import assert from 'node:assert/strict';

import { HabitCreateSchema, HabitPatchSchema } from './habit.contract';

{
  const result = HabitCreateSchema.safeParse({
    title: 'Beber agua',
    category: 'health',
    frequency: 'daily',
    targetCount: 5,
    targetDays: [],
    icon: '💧',
    timeOfDay: 'anytime',
    reminderEnabled: true,
    reminderTime: '09:00',
    persistentReminderEnabled: true,
    persistentReminderIntervalMinutes: 60,
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.targetCount, 5);
    assert.equal(result.data.persistentReminderEnabled, true);
    assert.equal(result.data.persistentReminderIntervalMinutes, 60);
  }
}

{
  const result = HabitCreateSchema.safeParse({
    title: 'Regar plantas',
    frequency: 'weekly',
    targetCount: 2,
    targetDays: [1, 4],
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.frequency, 'weekly');
    assert.deepEqual(result.data.targetDays, [1, 4]);
  }
}

{
  const result = HabitCreateSchema.safeParse({
    title: 'Agua',
    frequency: 'daily',
    targetCount: 0,
    persistentReminderIntervalMinutes: 0,
  });

  assert.equal(result.success, false);
}

{
  const result = HabitPatchSchema.safeParse({
    targetCount: 3,
    persistentReminderEnabled: true,
    persistentReminderIntervalMinutes: 120,
  });

  assert.equal(result.success, true);
}

console.log('habit.contract tests passed');
