import { describe, expect, it, vi } from 'vitest';

import { recoverGoalActionsOnce } from './goals-page';

describe('Goals legacy action recovery', () => {
  it('runs once per page load and waits for the canonical objective refresh', async () => {
    const guard = { started: false };
    const events: string[] = [];
    const recover = vi.fn(async () => {
      events.push('recover');
      await Promise.resolve();
      events.push('canonical-refreshed');
    });

    await Promise.all([
      recoverGoalActionsOnce(guard, recover),
      recoverGoalActionsOnce(guard, recover),
    ]);

    expect(recover).toHaveBeenCalledTimes(1);
    expect(events).toEqual(['recover', 'canonical-refreshed']);
    expect(guard.started).toBe(true);
  });
});
