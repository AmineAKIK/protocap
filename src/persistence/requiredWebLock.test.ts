import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasRequiredWebLocks, runWithRequiredWebLock } from './requiredWebLock';

const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'locks');

afterEach(() => {
  vi.restoreAllMocks();
  if (originalDescriptor) Object.defineProperty(navigator, 'locks', originalDescriptor);
});

describe('required Web Lock contract', () => {
  it('T23: absence is explicit and never executes the mutation', async () => {
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    const mutation = vi.fn();
    expect(hasRequiredWebLocks()).toBe(false);
    await expect(runWithRequiredWebLock('workspace', mutation)).resolves.toEqual({ status: 'unavailable' });
    expect(mutation).not.toHaveBeenCalled();
  });

  it('T23: an AbortSignal cancels a queued lock without entering its mutation', async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const queue: Array<() => void> = [];
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: {
        request: vi.fn(async (_name: string, options: { signal?: AbortSignal }, callback: () => unknown) => {
          await held;
          if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
          queue.push(callback as () => void);
          return callback();
        }),
      },
    });
    const controller = new AbortController();
    const mutation = vi.fn();
    const pending = runWithRequiredWebLock('workspace', mutation, controller.signal);
    controller.abort();
    release();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(mutation).not.toHaveBeenCalled();
    expect(queue).toHaveLength(0);
  });
});
