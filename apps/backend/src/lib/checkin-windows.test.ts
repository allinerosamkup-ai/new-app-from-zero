import assert from 'node:assert/strict';

import { resolveAdaptiveCheckinWindows, shouldSendCheckinSlotNudge } from './checkin-windows';

const defaults = resolveAdaptiveCheckinWindows({ wakeTime: '08:00', sleepTime: '23:00' });
assert.deepEqual(defaults.map((window) => window.slot), ['morning', 'midday', 'evening']);
assert.deepEqual(defaults.map((window) => window.targetTime), ['10:30', '15:30', '20:30']);

const learned = resolveAdaptiveCheckinWindows({
  wakeTime: '08:00', sleepTime: '23:00',
  recentBySlot: { morning: ['09:20', '09:30', '09:40'], midday: ['14:40', '14:50', '15:00'], evening: ['20:30', '20:40', '20:50'] },
});
assert.deepEqual(learned.map((window) => window.targetTime), ['09:30', '14:50', '20:40']);

assert.equal(shouldSendCheckinSlotNudge({ currentTime: '15:30', window: defaults[1], completedSlots: ['morning'], nudgedSlots: ['morning'] }).send, true);
assert.equal(shouldSendCheckinSlotNudge({ currentTime: '15:30', window: defaults[1], completedSlots: ['midday'], nudgedSlots: [] }).send, false);
assert.equal(shouldSendCheckinSlotNudge({ currentTime: '15:30', window: defaults[1], completedSlots: [], nudgedSlots: ['midday'] }).send, false);

console.log('checkin-windows tests passed');
