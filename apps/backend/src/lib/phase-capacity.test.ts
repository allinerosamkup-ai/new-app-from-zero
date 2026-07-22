import assert from 'node:assert/strict';

import { deriveRoutineCapacity } from './phase-capacity';

const now = new Date('2026-07-22T18:00:00.000Z');

assert.deepEqual(
  deriveRoutineCapacity({ phaseLabel: 'Recolhimento', energyScore: 7, recordedAt: new Date('2026-07-22T12:00:00.000Z'), now }).level,
  'low',
);

assert.deepEqual(
  deriveRoutineCapacity({ phaseLabel: 'Voo Alto', energyScore: 9, recordedAt: new Date('2026-07-22T12:00:00.000Z'), now }).level,
  'high',
);

assert.deepEqual(
  deriveRoutineCapacity({ phaseLabel: 'Retomada', energyScore: 6, recordedAt: new Date('2026-07-22T12:00:00.000Z'), now }).level,
  'balanced',
);

assert.deepEqual(
  deriveRoutineCapacity({ phaseLabel: 'Voo Alto', energyScore: 2, recordedAt: new Date('2026-07-22T12:00:00.000Z'), now }).level,
  'low',
  'energia muito baixa de hoje deve proteger a agenda mesmo em uma fase expansiva',
);

const stale = deriveRoutineCapacity({
  phaseLabel: 'Voo Alto',
  energyScore: 9,
  recordedAt: new Date('2026-07-10T12:00:00.000Z'),
  now,
});
assert.equal(stale.level, 'balanced');
assert.match(stale.reason, /sem check-in recente/i);

console.log('phase-capacity tests passed');
