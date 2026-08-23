import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readShiftGuideSessionItem,
  ResilientBrowserStorage,
  SHIFTGUIDE_STORAGE_DEGRADED_EVENT,
  writeShiftGuideSession,
} from './shiftGuideStorage';

class ThrowingStorage implements Storage {
  private readonly values = new Map<string, string>();
  failReads = false;
  failWrites = false;

  get length() {
    if (this.failReads) throw new DOMException('blocked', 'SecurityError');
    return this.values.size;
  }

  clear() {
    if (this.failWrites) throw new DOMException('blocked', 'SecurityError');
    this.values.clear();
  }

  getItem(key: string) {
    if (this.failReads) throw new DOMException('blocked', 'SecurityError');
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    if (this.failReads) throw new DOMException('blocked', 'SecurityError');
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    if (this.failWrites) throw new DOMException('blocked', 'SecurityError');
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    if (this.failWrites) throw new DOMException('full', 'QuotaExceededError');
    this.values.set(key, String(value));
  }
}

beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('ResilientBrowserStorage', () => {
  it('continues from its in-memory mirror after a persistent write failure', () => {
    const primary = new ThrowingStorage();
    primary.setItem('revision', 'r1');
    const storage = new ResilientBrowserStorage(() => primary);

    expect(storage.getItem('revision')).toBe('r1');
    primary.failWrites = true;
    storage.setItem('progress', 'p1');

    expect(storage.isDegraded()).toBe(true);
    expect(storage.getItem('revision')).toBe('r1');
    expect(storage.getItem('progress')).toBe('p1');
  });

  it('degrades once and exposes a storage-health event', () => {
    const primary = new ThrowingStorage();
    const listener = vi.fn();
    window.addEventListener(SHIFTGUIDE_STORAGE_DEGRADED_EVENT, listener);
    primary.failReads = true;
    const storage = new ResilientBrowserStorage(() => primary);

    expect(storage.getItem('x')).toBeNull();
    expect(storage.getItem('y')).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(SHIFTGUIDE_STORAGE_DEGRADED_EVENT, listener);
  });
});

describe('strict ShiftGuide session storage', () => {
  it('writes and verifies the complete session payload', () => {
    expect(writeShiftGuideSession([
      ['a', '1'],
      ['b', '2'],
    ])).toBe(true);
    expect(readShiftGuideSessionItem('a')).toBe('1');
    expect(readShiftGuideSessionItem('b')).toBe('2');
  });

  it('fails closed and rolls back keys when session storage rejects a write', () => {
    const original = Storage.prototype.setItem;
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === 'b') throw new DOMException('full', 'QuotaExceededError');
      return original.call(this, key, value);
    });

    expect(writeShiftGuideSession([
      ['a', '1'],
      ['b', '2'],
    ])).toBe(false);
    expect(sessionStorage.getItem('a')).toBeNull();
    expect(sessionStorage.getItem('b')).toBeNull();
    setItemSpy.mockRestore();
  });
});
