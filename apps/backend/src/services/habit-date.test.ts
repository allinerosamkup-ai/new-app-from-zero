import assert from 'node:assert/strict';

import { parseHabitReferenceDate } from './habit.service';

const parsed = parseHabitReferenceDate('2026-07-27');
assert.equal(parsed.getFullYear(), 2026);
assert.equal(parsed.getMonth(), 6);
assert.equal(parsed.getDate(), 27);
assert.equal(parsed.getHours(), 12);
assert.equal(parsed.getDay(), 1);

assert.throws(() => parseHabitReferenceDate('27/07/2026'), /habit_date_invalid/);

console.log('habit-date tests passed');
