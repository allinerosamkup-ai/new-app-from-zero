import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import {
  GoalRecoveryNotice,
  recoverGoalActionsOnce,
} from './goals-page';
import {
  GoalActionRecoveryError,
  recoverGoalActionsWithCanonicalHydration,
} from '../features/aura/store';

describe('Goals legacy action recovery', () => {
  it('runs once per page load and waits for the canonical objective refresh', async () => {
    const guard = { status: 'idle' as const };
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
    expect(guard.status).toBe('completed');
  });

  it('releases the guard after failure so a visible retry can run again', async () => {
    const guard: { status: 'idle' | 'inFlight' | 'completed' } = { status: 'idle' };
    const recover = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(undefined);

    await expect(recoverGoalActionsOnce(guard, recover)).rejects.toThrow('network');
    expect(guard.status).toBe('idle');
    await recoverGoalActionsOnce(guard, recover);

    expect(recover).toHaveBeenCalledTimes(2);
    expect(guard.status).toBe('completed');
  });

  it('does not resolve until the strict canonical objective commit is confirmed', async () => {
    let confirmCommit!: () => void;
    const commitConfirmed = new Promise<void>((resolve) => { confirmCommit = resolve; });
    let settled = false;
    const operation = recoverGoalActionsWithCanonicalHydration({
      recover: async () => ({
        eligible: 1, attempted: 1, recovered: 1, failed: 0, deferred: 0, retryAfterMs: null,
      }),
      loadObjectives: async () => [{ id: 'goal-1', title: 'Meta', progress: 0, subgoals: [] }],
      commitObjectives: async () => commitConfirmed,
    }).then(() => { settled = true; });

    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);
    confirmCommit();
    await operation;
    expect(settled).toBe(true);
  });

  it('rejects when canonical objective hydration fails instead of keeping stale goals', async () => {
    const commitObjectives = vi.fn();

    await expect(recoverGoalActionsWithCanonicalHydration({
      recover: async () => ({
        eligible: 0, attempted: 0, recovered: 0, failed: 0, deferred: 0, retryAfterMs: null,
      }),
      loadObjectives: async () => { throw new Error('canonical unavailable'); },
      commitObjectives,
    })).rejects.toThrow('canonical unavailable');

    expect(commitObjectives).not.toHaveBeenCalled();
  });

  it('raises an actionable partial-result error after hydrating recovered objectives', async () => {
    const result = {
      eligible: 4, attempted: 3, recovered: 3, failed: 0, deferred: 1, retryAfterMs: 0,
    };
    const commitObjectives = vi.fn(async () => {});

    await expect(recoverGoalActionsWithCanonicalHydration({
      recover: async () => result,
      loadObjectives: async () => [],
      commitObjectives,
    })).rejects.toBeInstanceOf(GoalActionRecoveryError);

    expect(commitObjectives).toHaveBeenCalledTimes(1);
  });

  it('rejects an inconsistent recovery contract before canonical hydration', async () => {
    const loadObjectives = vi.fn(async () => []);

    await expect(recoverGoalActionsWithCanonicalHydration({
      recover: async () => ({
        eligible: 1, attempted: 1, recovered: 2, failed: 0, deferred: 0, retryAfterMs: null,
      }),
      loadObjectives,
      commitObjectives: async () => {},
    })).rejects.toThrow('Resposta inválida');

    expect(loadObjectives).not.toHaveBeenCalled();
  });

  it('renders a retry button that invokes the real recovery callback', async () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    const onRetry = vi.fn();

    await act(async () => {
      root.render(
        <GoalRecoveryNotice
          message="Ainda faltam ações"
          retryLabel="Tentar novamente"
          retrying={false}
          onRetry={onRetry}
        />,
      );
    });
    const button = host.querySelector('button');
    expect(button?.textContent).toContain('Tentar novamente');
    button?.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
  });
});
