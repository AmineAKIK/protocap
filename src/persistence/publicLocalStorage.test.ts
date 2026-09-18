import { describe, expect, it, vi } from 'vitest';
import {
  inspectPublicStorageCompatibility,
  readPublicStorageValue,
  writePublicStorageValue,
} from './publicLocalStorage';

const logicalKey = 'lineops.packing.form.inputs';
const key = `${logicalKey}.v8`;
const form = { quantity: '1', unitsPerCarton: '2', cartonsPerPalette: '3' };

describe('public local-storage contract', () => {
  it('T10: returns typed parse and schema failures without modifying the source', () => {
    localStorage.setItem(key, '{broken');
    expect(readPublicStorageValue(logicalKey)).toMatchObject({ status: 'invalid', reason: 'parse', raw: '{broken' });
    expect(localStorage.getItem(key)).toBe('{broken');

    const raw = JSON.stringify({ quantity: 1 });
    localStorage.setItem(key, raw);
    expect(readPublicStorageValue(logicalKey)).toMatchObject({ status: 'invalid', reason: 'schema', raw });
    expect(localStorage.getItem(key)).toBe(raw);
  });

  it('T10: distinguishes an ordinary write failure from quota and access failures', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Synthetic write failure');
    });
    expect(writePublicStorageValue(logicalKey, form)).toMatchObject({
      status: 'degraded', reason: 'write', errorName: 'Error',
    });
  });

  it('T10: rejects an invalid write schema before touching storage', () => {
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    expect(writePublicStorageValue(logicalKey, { quantity: 1 })).toMatchObject({
      status: 'degraded', reason: 'schema',
    });
    expect(writes).not.toHaveBeenCalled();
  });

  it('T10: marks verification failure when setItem cannot be confirmed', () => {
    const originalGetItem = Storage.prototype.getItem;
    const get = vi.spyOn(Storage.prototype, 'getItem');
    get.mockImplementation(function (this: Storage, requested: string) {
      if (requested === key) return 'stale-value';
      return originalGetItem.call(this, requested);
    });

    expect(writePublicStorageValue(logicalKey, form)).toMatchObject({ status: 'degraded', reason: 'verify' });
  });

  it('T10: reports verification access failure after a successful write', () => {
    const originalGetItem = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, requested: string) {
      if (requested === key) throw new DOMException('Blocked', 'SecurityError');
      return originalGetItem.call(this, requested);
    });
    expect(writePublicStorageValue(logicalKey, form)).toMatchObject({
      status: 'degraded', reason: 'verify', errorName: 'SecurityError',
    });
  });

  it('T15: identifies the newest future version without rewriting either version', () => {
    localStorage.setItem(key, JSON.stringify(form));
    localStorage.setItem(`${logicalKey}.v10`, JSON.stringify({ future: true }));
    const before = [localStorage.getItem(key), localStorage.getItem(`${logicalKey}.v10`)];

    expect(inspectPublicStorageCompatibility(logicalKey)).toEqual({
      status: 'future-version',
      key: `${logicalKey}.v10`,
      version: 10,
    });
    expect(writePublicStorageValue(logicalKey, { ...form, quantity: '9' })).toMatchObject({
      status: 'degraded',
      reason: 'future-version',
      futureVersion: 10,
    });
    expect([localStorage.getItem(key), localStorage.getItem(`${logicalKey}.v10`)]).toEqual(before);
  });
});
