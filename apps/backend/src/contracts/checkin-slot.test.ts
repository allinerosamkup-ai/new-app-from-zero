import assert from 'node:assert/strict';

import { deriveCheckinSlot } from './checkin-slot';

assert.equal(deriveCheckinSlot(new Date('2026-03-13T08:00:00.000Z')), 'morning');
assert.equal(deriveCheckinSlot(new Date('2026-03-13T15:00:00.000Z')), 'midday');
assert.equal(deriveCheckinSlot(new Date('2026-03-13T22:00:00.000Z')), 'evening');

console.log('checkin-slot tests passed');
