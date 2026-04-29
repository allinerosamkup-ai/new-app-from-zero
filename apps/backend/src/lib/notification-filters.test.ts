import assert from 'node:assert/strict';

import {
  allowsHabitNotifications,
  getSaoPauloDateContext,
  shouldSendHabitReminderToday,
} from './notification-filters';

function run() {
  assert.equal(
    shouldSendHabitReminderToday(
      { frequency: 'daily', targetCount: 1, completions: [{ completionCount: 1 }] },
      3,
    ),
    false,
  );

  assert.equal(
    shouldSendHabitReminderToday(
      { frequency: 'weekly', targetDays: [1, 3], targetCount: 1, completions: [] },
      3,
    ),
    true,
  );

  assert.equal(
    shouldSendHabitReminderToday(
      { frequency: 'weekly', targetDays: [1], targetCount: 1, completions: [] },
      3,
    ),
    false,
  );

  assert.equal(
    shouldSendHabitReminderToday(
      { frequency: 'monthly', targetCount: 1, completions: [] },
      3,
      1,
    ),
    true,
  );

  assert.equal(
    shouldSendHabitReminderToday(
      { frequency: 'monthly', targetCount: 1, completions: [] },
      3,
      29,
    ),
    false,
  );

  assert.equal(
    allowsHabitNotifications({ notificationsOn: true, notificationPreferences: { habits: false } }),
    false,
  );

  assert.equal(
    allowsHabitNotifications({ notificationsOn: true, notificationPreferences: { habits: true } }),
    true,
  );

  assert.deepEqual(
    getSaoPauloDateContext(new Date('2026-04-29T15:00:00.000Z')),
    {
      dateKey: '2026-04-29',
      weekday: 3,
      dayOfMonth: 29,
      dbDate: new Date('2026-04-29T00:00:00.000Z'),
    },
  );
}

run();
console.log('notification-filters tests passed');
