import assert from 'node:assert/strict';

import { PRODUCT_CAPABILITIES } from './product-capabilities';
import { defaultNotificationPreferences } from './preferences.contract';

assert.deepEqual(PRODUCT_CAPABILITIES, {
  planner: false,
  habits: false,
  connectedCalendar: false,
});
assert.equal(defaultNotificationPreferences.planner, false);
assert.equal(defaultNotificationPreferences.habits, false);

console.log('product capabilities tests passed');
