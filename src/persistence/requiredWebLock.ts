export type RequiredWebLockResult<T> =
  | { status: 'acquired'; value: T }
  | { status: 'unavailable' };

interface LockManagerLike {
  request<T>(
    name: string,
    options: { mode: 'exclusive'; signal?: AbortSignal },
    callback: () => Promise<T> | T,
  ): Promise<T>;
}

function resolveLockManager(): LockManagerLike | null {
  try {
    const locks = (navigator as Navigator & { locks?: LockManagerLike }).locks;
    return locks && typeof locks.request === 'function' ? locks : null;
  } catch {
    return null;
  }
}

export function hasRequiredWebLocks(): boolean {
  return resolveLockManager() !== null;
}

export async function runWithRequiredWebLock<T>(
  name: string,
  task: () => Promise<T> | T,
  signal?: AbortSignal,
): Promise<RequiredWebLockResult<T>> {
  const locks = resolveLockManager();
  if (!locks) return { status: 'unavailable' };

  let entered = false;
  try {
    const value = await locks.request(name, { mode: 'exclusive', signal }, async () => {
      entered = true;
      return task();
    });
    return { status: 'acquired', value };
  } catch (error) {
    if (entered || (error instanceof DOMException && error.name === 'AbortError')) throw error;
    return { status: 'unavailable' };
  }
}
