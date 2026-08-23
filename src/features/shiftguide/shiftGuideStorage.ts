export const SHIFTGUIDE_STORAGE_DEGRADED_EVENT = 'shiftguide:storage-degraded';

export interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  clear() {
    this.values.clear();
  }
}

export class ResilientBrowserStorage implements StorageLike {
  private readonly memory = new MemoryStorage();
  private degraded = false;

  constructor(private readonly resolvePrimary: () => Storage) {}

  isDegraded() {
    return this.degraded;
  }

  private markDegraded() {
    if (this.degraded) return;
    this.degraded = true;
    try {
      window.dispatchEvent(new Event(SHIFTGUIDE_STORAGE_DEGRADED_EVENT));
    } catch {
      // Storage resilience must not depend on DOM event availability.
    }
  }

  get length() {
    if (this.degraded) return this.memory.length;
    try {
      return this.resolvePrimary().length;
    } catch {
      this.markDegraded();
      return this.memory.length;
    }
  }

  key(index: number) {
    if (this.degraded) return this.memory.key(index);
    try {
      const key = this.resolvePrimary().key(index);
      if (key !== null) {
        const value = this.resolvePrimary().getItem(key);
        if (value !== null) this.memory.setItem(key, value);
      }
      return key;
    } catch {
      this.markDegraded();
      return this.memory.key(index);
    }
  }

  getItem(key: string) {
    if (this.degraded) return this.memory.getItem(key);
    try {
      const value = this.resolvePrimary().getItem(key);
      if (value === null) this.memory.removeItem(key);
      else this.memory.setItem(key, value);
      return value;
    } catch {
      this.markDegraded();
      return this.memory.getItem(key);
    }
  }

  setItem(key: string, value: string) {
    const normalized = String(value);
    this.memory.setItem(key, normalized);
    if (this.degraded) return;
    try {
      this.resolvePrimary().setItem(key, normalized);
    } catch {
      this.markDegraded();
    }
  }

  removeItem(key: string) {
    this.memory.removeItem(key);
    if (this.degraded) return;
    try {
      this.resolvePrimary().removeItem(key);
    } catch {
      this.markDegraded();
    }
  }
}

const persistentShiftGuideStorage = new ResilientBrowserStorage(() => window.localStorage);

export function getShiftGuidePersistentStorage(): StorageLike {
  return persistentShiftGuideStorage;
}

export function isShiftGuidePersistentStorageDegraded() {
  return persistentShiftGuideStorage.isDegraded();
}

function resolveSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readShiftGuideSessionItem(key: string): string | null {
  const storage = resolveSessionStorage();
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function removeShiftGuideSessionItems(keys: string[]) {
  const storage = resolveSessionStorage();
  if (!storage) return;
  for (const key of keys) {
    try {
      storage.removeItem(key);
    } catch {
      // Session cleanup is best-effort. Reads fail closed when storage is unavailable.
    }
  }
}

export function writeShiftGuideSession(entries: Array<[string, string]>): boolean {
  const storage = resolveSessionStorage();
  if (!storage) return false;

  const written: string[] = [];
  try {
    for (const [key, value] of entries) {
      storage.setItem(key, value);
      written.push(key);
    }
    for (const [key, value] of entries) {
      if (storage.getItem(key) !== value) throw new Error('Session storage verification failed.');
    }
    return true;
  } catch {
    for (const key of written) {
      try {
        storage.removeItem(key);
      } catch {
        // The next read still fails closed if cleanup is unavailable.
      }
    }
    return false;
  }
}

export function bestEffortSessionStorage(): StorageLike {
  return {
    get length() {
      const storage = resolveSessionStorage();
      if (!storage) return 0;
      try { return storage.length; } catch { return 0; }
    },
    key(index: number) {
      const storage = resolveSessionStorage();
      if (!storage) return null;
      try { return storage.key(index); } catch { return null; }
    },
    getItem(key: string) {
      return readShiftGuideSessionItem(key);
    },
    setItem(key: string, value: string) {
      const storage = resolveSessionStorage();
      if (!storage) return;
      try { storage.setItem(key, value); } catch { /* best effort */ }
    },
    removeItem(key: string) {
      removeShiftGuideSessionItems([key]);
    },
  };
}
