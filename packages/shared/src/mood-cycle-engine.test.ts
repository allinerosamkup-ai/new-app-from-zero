import * as assert from 'node:assert/strict';

import { CANONICAL_MOOD_PHASES, PHASE_CONFIG } from './mood-cycle-engine';

const expected = {
  elevated: 'Voo Alto',
  flowing: 'Fluindo',
  stable: 'Estável',
  falling: 'Desacelerando',
  low: 'Recolhimento',
  depleted: 'Pausa',
  recovering: 'Retomada',
  mixed: 'Turbulência',
} as const;

assert.deepEqual(CANONICAL_MOOD_PHASES, Object.keys(expected));
for (const [id, label] of Object.entries(expected)) {
  assert.equal(PHASE_CONFIG[id as keyof typeof expected].label, label);
}

console.log('shared mood-cycle-engine parity tests passed');
