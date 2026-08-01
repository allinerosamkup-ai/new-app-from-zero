import { describe, expect, it } from 'vitest';

import { resolveMoodFromCheckin } from './checkin-mood';

describe('canonical check-in mood recovery', () => {
  it('uses the persisted state type from an Airia natural-language check-in', () => {
    expect(resolveMoodFromCheckin({
      humor: 3,
      energia: 3,
      stateLabelType: 'sensível',
      emotions: ['sad', 'tired'],
    }, 'equilibrada')).toBe('sensivel');
  });

  it('falls back to persisted scores without inventing optional signals', () => {
    expect(resolveMoodFromCheckin({ humor: 7, energia: 2 }, 'equilibrada')).toBe('cansada');
    expect(resolveMoodFromCheckin({ humor: 2, energia: 7 }, 'equilibrada')).toBe('sensivel');
  });

  it('keeps the current selection when no persisted state exists', () => {
    expect(resolveMoodFromCheckin(null, 'tensa')).toBe('tensa');
  });
});
