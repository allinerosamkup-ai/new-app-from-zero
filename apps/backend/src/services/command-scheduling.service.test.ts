import assert from 'node:assert/strict';

import { CommandSchedulingService } from './command-scheduling.service';

function run() {
  const avoidsConflicts = CommandSchedulingService.rankSlots({
    date: '2026-07-29',
    currentLocalDate: '2026-07-28',
    currentTime: '08:00',
    durationMinutes: 60,
    phase: 'fluindo',
    moodScore: 7,
    energyScore: 7,
    busyWindows: [
      { startTime: '09:00', endTime: '10:00', fixed: true },
      { startTime: '12:00', endTime: '13:00', fixed: true },
    ],
  });
  assert.equal(avoidsConflicts[0]?.startTime, '10:00');
  assert.equal(avoidsConflicts.some((slot) => slot.startTime === '09:00'), false);

  const neverUsesPastTime = CommandSchedulingService.rankSlots({
    date: '2026-07-28',
    currentLocalDate: '2026-07-28',
    currentTime: '14:20',
    durationMinutes: 30,
    phase: 'voo_alto',
    moodScore: 8,
    energyScore: 8,
    busyWindows: [],
  });
  assert.ok(neverUsesPastTime.length > 0);
  assert.ok(neverUsesPastTime.every((slot) => slot.startTime >= '14:45'));

  const protectsLowEnergy = CommandSchedulingService.rankSlots({
    date: '2026-07-29',
    currentLocalDate: '2026-07-28',
    currentTime: '08:00',
    durationMinutes: 30,
    phase: 'recolhimento',
    moodScore: 3,
    energyScore: 2,
    busyWindows: [],
  });
  assert.ok(protectsLowEnergy[0]?.startTime >= '11:00');
  assert.match(protectsLowEnergy[0]?.reason ?? '', /energia|ritmo/i);

  const noSpace = CommandSchedulingService.rankSlots({
    date: '2026-07-29',
    currentLocalDate: '2026-07-28',
    currentTime: '08:00',
    durationMinutes: 60,
    phase: 'estavel',
    moodScore: 5,
    energyScore: 5,
    busyWindows: [{ startTime: '08:00', endTime: '22:00', fixed: true }],
  });
  assert.deepEqual(noSpace, []);
}

run();
console.log('command-scheduling.service tests passed');
