import assert from 'node:assert/strict';

import {
  DEFAULT_EVENING_REVIEW_TIME,
  DEFAULT_JOURNAL_EVENING_TIME,
  DEFAULT_JOURNAL_MORNING_TIME,
  DEFAULT_MORNING_CHECKIN_TIME,
  PreferencesPatchSchema,
  defaultNotificationPreferences,
  defaultUserPreferences,
  normalizeNotificationPreferences,
} from './preferences.contract';

assert.equal(DEFAULT_MORNING_CHECKIN_TIME, '08:00');
assert.equal(DEFAULT_EVENING_REVIEW_TIME, '20:00');
assert.equal(DEFAULT_JOURNAL_MORNING_TIME, '11:00');
assert.equal(DEFAULT_JOURNAL_EVENING_TIME, '19:00');
assert.equal(defaultUserPreferences.morningCheckinTime, '08:00');
assert.equal(defaultUserPreferences.eveningReviewTime, '20:00');
assert.equal(defaultUserPreferences.notificationPreferences, defaultNotificationPreferences);

const parsed = PreferencesPatchSchema.parse({
  morningCheckinTime: '08:00',
  eveningReviewTime: '20:00',
  notificationsOn: false,
  notificationPreferences: {
    ...defaultNotificationPreferences,
    journal: false,
  },
});

assert.equal(parsed.morningCheckinTime, '08:00');
assert.equal(parsed.eveningReviewTime, '20:00');
assert.equal(parsed.notificationsOn, false);
assert.equal(parsed.notificationPreferences?.journal, false);
assert.equal(normalizeNotificationPreferences({ planner: false }).planner, false);
assert.equal(normalizeNotificationPreferences({}).journalMorningTime, '11:00');

assert.throws(() => PreferencesPatchSchema.parse({ morningCheckinTime: '25:00' }));
assert.throws(() => normalizeNotificationPreferences({ journalMorningTime: '25:00' }));

console.log('preferences.contract tests passed');
