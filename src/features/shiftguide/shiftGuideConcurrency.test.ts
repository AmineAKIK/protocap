import { describe, expect, it, vi } from 'vitest';
import {
  SHIFTGUIDE_CONCURRENCY_DEGRADED_EVENT,
  ShiftGuideMutationCoordinator,
} from './shiftGuideConcurrency';

class SharedLockManager {
  private readonly tails = new Map<string, Promise<void>>();

  request<T>(name: string, callback: () => Promise<T> | T): Promise<T> {
    const previous = this.tails.get(name) ?? Promise.resolve();
    const run = previous.then(callback, callback);
    this.tails.set(name, run.then(() => undefined, () => undefined));
    return run;
  }
}

describe('ShiftGuideMutationCoordinator', () => {
  it('serializes read-modify-write mutations across independent coordinators', async () => {
    const locks = new SharedLockManager();
    const firstTab = new ShiftGuideMutationCoordinator(() => locks);
    const secondTab = new ShiftGuideMutationCoordinator(() => locks);
    let sharedActions: string[] = [];

    let releaseFirst!: () => void;
    const firstMayFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const firstEntered = vi.fn();
    const secondEntered = vi.fn();

    const firstMutation = firstTab.runExclusive('progress', async () => {
      firstEntered();
      const snapshot = [...sharedActions];
      await firstMayFinish;
      snapshot.push('action-a');
      sharedActions = snapshot;
    });

    await vi.waitFor(() => expect(firstEntered).toHaveBeenCalledTimes(1));

    const secondMutation = secondTab.runExclusive('progress', async () => {
      secondEntered();
      const snapshot = [...sharedActions];
      snapshot.push('action-b');
      sharedActions = snapshot;
    });

    await Promise.resolve();
    expect(secondEntered).not.toHaveBeenCalled();

    releaseFirst();
    await Promise.all([firstMutation, secondMutation]);

    expect(sharedActions).toEqual(['action-a', 'action-b']);
    expect(secondEntered).toHaveBeenCalledTimes(1);
  });

  it('never replays a mutation that throws after entering the critical section', async () => {
    const locks = new SharedLockManager();
    const coordinator = new ShiftGuideMutationCoordinator(() => locks);
    let executions = 0;

    await expect(coordinator.runExclusive('progress', () => {
      executions += 1;
      throw new Error('mutation failed');
    })).rejects.toThrow('mutation failed');

    expect(executions).toBe(1);
    expect(coordinator.isDegraded()).toBe(false);
  });

  it('falls back to a local queue and signals degradation when browser locks are unavailable', async () => {
    const coordinator = new ShiftGuideMutationCoordinator(() => null);
    const listener = vi.fn();
    window.addEventListener(SHIFTGUIDE_CONCURRENCY_DEGRADED_EVENT, listener);
    const order: string[] = [];

    const first = coordinator.runExclusive('progress', async () => {
      order.push('first:start');
      await Promise.resolve();
      order.push('first:end');
    });
    const second = coordinator.runExclusive('progress', () => {
      order.push('second');
    });

    await Promise.all([first, second]);
    window.removeEventListener(SHIFTGUIDE_CONCURRENCY_DEGRADED_EVENT, listener);

    expect(order).toEqual(['first:start', 'first:end', 'second']);
    expect(coordinator.isDegraded()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('falls back only when lock acquisition fails before the mutation starts', async () => {
    const coordinator = new ShiftGuideMutationCoordinator(() => ({
      request: async () => {
        throw new Error('locks unavailable');
      },
    }));
    const mutation = vi.fn(() => 'done');

    await expect(coordinator.runExclusive('progress', mutation)).resolves.toBe('done');
    expect(mutation).toHaveBeenCalledTimes(1);
    expect(coordinator.isDegraded()).toBe(true);
  });
});
