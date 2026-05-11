/**
 * Tests for phase-time-windows.ts
 * Verifies that each phase's energy tiers are correctly defined and that
 * slotTier() returns the expected values for representative time slots.
 */

import assert from 'assert';
import {
  PHASE_WINDOWS,
  getPhaseWindow,
  slotTier,
  phaseHasPeakOrFlow,
  bestAvailableStart,
} from './phase-time-windows';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ ${name}: ${err.message}`);
    failed++;
  }
}

// ─── getPhaseWindow ───────────────────────────────────────────────────────────
console.log('\ngetPhaseWindow');

test('returns correct window for "voo alto"', () => {
  const w = getPhaseWindow('voo alto');
  assert.ok(w.peak.length > 0, 'Voo Alto should have at least one peak window');
});

test('falls back to estavel for unknown phase', () => {
  const w = getPhaseWindow('fase-inexistente');
  const estavel = PHASE_WINDOWS['estavel'];
  assert.deepStrictEqual(w, estavel);
});

test('handles accented phase keys', () => {
  // 'turbulência' with accent should match 'turbulencia'
  const w1 = getPhaseWindow('turbulência');
  const w2 = getPhaseWindow('turbulencia');
  assert.deepStrictEqual(w1, w2);
});

// ─── slotTier: phases with NO peak/flow ──────────────────────────────────────
console.log('\nslotTier — low-capacity phases (Recolhimento, Pausa, Turbulência)');

const lowPhases = ['recolhimento', 'pausa', 'turbulencia'];

for (const phase of lowPhases) {
  test(`${phase}: 09:00 (540) is rest`, () => {
    const w = getPhaseWindow(phase);
    assert.strictEqual(slotTier(9 * 60, w), 'rest', `${phase} at 09:00 should be rest`);
  });

  test(`${phase}: 11:30 (690) is maintenance`, () => {
    const w = getPhaseWindow(phase);
    const tier = slotTier(11 * 60 + 30, w);
    assert.strictEqual(tier, 'maintenance', `${phase} at 11:30 should be maintenance`);
  });

  test(`${phase}: never has peak or flow`, () => {
    const w = getPhaseWindow(phase);
    assert.ok(!phaseHasPeakOrFlow(w), `${phase} should not have peak or flow windows`);
  });
}

// ─── slotTier: Voo Alto ───────────────────────────────────────────────────────
console.log('\nslotTier — Voo Alto');

test('Voo Alto: 09:00 (540) is peak', () => {
  const w = getPhaseWindow('voo alto');
  assert.strictEqual(slotTier(9 * 60, w), 'peak');
});

test('Voo Alto: 11:30 (690) is maintenance (post-peak gap)', () => {
  const w = getPhaseWindow('voo alto');
  assert.strictEqual(slotTier(11 * 60 + 30, w), 'maintenance');
});

test('Voo Alto: 15:00 (900) is flow (afternoon window)', () => {
  const w = getPhaseWindow('voo alto');
  assert.strictEqual(slotTier(15 * 60, w), 'flow');
});

test('Voo Alto: 21:00 (1260) is rest', () => {
  const w = getPhaseWindow('voo alto');
  assert.strictEqual(slotTier(21 * 60, w), 'rest');
});

// ─── slotTier: Fluindo ────────────────────────────────────────────────────────
console.log('\nslotTier — Fluindo (two peak windows)');

test('Fluindo: 10:00 (600) is peak', () => {
  const w = getPhaseWindow('fluindo');
  assert.strictEqual(slotTier(10 * 60, w), 'peak');
});

test('Fluindo: 16:00 (960) is peak (second window)', () => {
  const w = getPhaseWindow('fluindo');
  assert.strictEqual(slotTier(16 * 60, w), 'peak');
});

test('Fluindo has two distinct peak windows', () => {
  const w = getPhaseWindow('fluindo');
  assert.strictEqual(w.peak.length, 2, 'Fluindo should have exactly 2 peak windows');
});

test('Fluindo: 13:00 (780) is maintenance (midday gap)', () => {
  const w = getPhaseWindow('fluindo');
  assert.strictEqual(slotTier(13 * 60, w), 'maintenance');
});

// ─── slotTier: Desacelerando ──────────────────────────────────────────────────
console.log('\nslotTier — Desacelerando');

test('Desacelerando: no peak windows', () => {
  const w = getPhaseWindow('desacelerando');
  assert.strictEqual(w.peak.length, 0);
});

test('Desacelerando: 11:00 (660) is flow', () => {
  const w = getPhaseWindow('desacelerando');
  assert.strictEqual(slotTier(11 * 60, w), 'flow');
});

test('Desacelerando: 14:00 (840) is maintenance', () => {
  const w = getPhaseWindow('desacelerando');
  assert.strictEqual(slotTier(14 * 60, w), 'maintenance');
});

// ─── bestAvailableStart ───────────────────────────────────────────────────────
console.log('\nbestAvailableStart');

test('Fluindo at 08:00, heavy task 60min → picks first peak window (09:15)', () => {
  const w = getPhaseWindow('fluindo');
  const result = bestAvailableStart(w, 8 * 60, 60, true);
  assert.ok(result !== null, 'Should find a slot');
  assert.ok(result! >= 9 * 60, 'Should start at or after 09:00');
  assert.ok(result! + 60 <= 12 * 60, 'Should fit within first peak window');
});

test('Recolhimento at 08:00, heavy task 60min → maintenance window 11:00+', () => {
  const w = getPhaseWindow('recolhimento');
  const result = bestAvailableStart(w, 8 * 60, 60, true);
  assert.ok(result !== null, 'Should find maintenance slot');
  assert.ok(result! >= 11 * 60, 'Should be in maintenance window');
});

test('Pausa at 13:00, task 60min → null (no remaining window)', () => {
  const w = getPhaseWindow('pausa');
  // maintenance is 11:00–13:00, but now is 13:00 so nothing fits
  const result = bestAvailableStart(w, 13 * 60, 60, false);
  assert.strictEqual(result, null, 'Should return null when no window fits');
});

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
