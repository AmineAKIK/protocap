export const SHIFTGUIDE_CONCURRENCY_DEGRADED_EVENT = 'shiftguide:concurrency-degraded';
export const SHIFTGUIDE_PROGRESS_LOCK_NAME = 'protocap:shiftguide:progress';

interface LockManagerLike {
  request<T>(name: string, callback: () => Promise<T> | T): Promise<T>;
}

type LockManagerResolver = () => LockManagerLike | null;

export class ShiftGuideMutationCoordinator {
  private localTail: Promise<void> = Promise.resolve();
  private degraded = false;

  constructor(private readonly resolveLockManager: LockManagerResolver) {}

  isDegraded() {
    return this.degraded;
  }

  private markDegraded() {
    if (this.degraded) return;
    this.degraded = true;
    try {
      window.dispatchEvent(new Event(SHIFTGUIDE_CONCURRENCY_DEGRADED_EVENT));
    } catch {
      // Concurrency fallback must not depend on DOM event availability.
    }
  }

  private enqueueLocally<T>(task: () => Promise<T> | T): Promise<T> {
    const run = this.localTail.then(task, task);
    this.localTail = run.then(() => undefined, () => undefined);
    return run;
  }

  async runExclusive<T>(name: string, task: () => Promise<T> | T): Promise<T> {
    let lockManager: LockManagerLike | null = null;
    try {
      lockManager = this.resolveLockManager();
    } catch {
      this.markDegraded();
      return this.enqueueLocally(task);
    }

    if (!lockManager || typeof lockManager.request !== 'function') {
      this.markDegraded();
      return this.enqueueLocally(task);
    }

    let enteredCriticalSection = false;
    try {
      return await lockManager.request(name, async () => {
        enteredCriticalSection = true;
        return task();
      });
    } catch (error) {
      if (enteredCriticalSection) throw error;
      this.markDegraded();
      return this.enqueueLocally(task);
    }
  }
}

function resolveBrowserLockManager(): LockManagerLike | null {
  try {
    const candidate = navigator as Navigator & { locks?: LockManagerLike };
    return candidate.locks ?? null;
  } catch {
    return null;
  }
}

const shiftGuideMutationCoordinator = new ShiftGuideMutationCoordinator(resolveBrowserLockManager);

export function runShiftGuideProgressTransaction<T>(task: () => Promise<T> | T): Promise<T> {
  return shiftGuideMutationCoordinator.runExclusive(SHIFTGUIDE_PROGRESS_LOCK_NAME, task);
}

export function isShiftGuideConcurrencyDegraded() {
  return shiftGuideMutationCoordinator.isDegraded();
}
