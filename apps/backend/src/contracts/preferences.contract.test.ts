import assert from 'node:assert/strict';

import {
  DEFAULT_EVENING_REVIEW_TIME,
  DEFAULT_MORNING_CHECKIN_TIME,
  PreferencesPatchSchema,
  defaultUserPreferences,
} from './preferences.contract';

assert.equal(DEFAULT_MORNING_CHECKIN_TIME, '08:00');
assert.equal(DEFAULT_EVENING_REVIEW_TIME, '20:00');
assert.equal(defaultUserPreferences.morningCheckinTime, '08:00');
assert.equal(defaultUserPreferences.eveningReviewTime, '20:00');

const parsed = PreferencesPatchSchema.parse({
  morningCheckinTime: '08:00',
  eveningReviewTime: '20:00',
  notificationsOn: false,
});

assert.equal(parsed.morningCheckinTime, '08:00');
assert.equal(parsed.eveningReviewTime, '20:00');
assert.equal(parsed.notificationsOn, false);

assert.throws(() => PreferencesPatchSchema.parse({ morningCheckinTime: '25:00' }));

console.log('preferences.contract tests passed');
