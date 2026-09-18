import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConditioningLine } from '../../types/expiry';
import {
  EXPIRY_AGGREGATE_KEY,
  EXPIRY_LEGACY_HISTORY_KEY,
  EXPIRY_LEGACY_LINES_KEY,
  type ExpiryAggregateV1,
} from './persistence';
import { useExpiryWorkspace } from './useExpiryWorkspace';

const line: ConditioningLine = {
  id: 'a',
  name: 'Ligne A',
  vat: 'Cuve 1',
  product: 'Fixture',
  conditioningStartedAt: '2026-09-15T12:00:00.000Z',
  elements: [{
    type: 'fillingBlock',
    label: 'Bloc',
    lastChangedAt: '2026-09-15T12:00:00.000Z',
    expiresAt: '2026-09-20T12:00:00.000Z',
    validityDays: 5,
    operator: 'Fixture',
  }],
};

function seedLegacy() {
  localStorage.setItem(EXPIRY_LEGACY_LINES_KEY, JSON.stringify([line]));
  localStorage.setItem(EXPIRY_LEGACY_HISTORY_KEY, '[]');
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('useExpiryWorkspace', () => {
  it('T14: migrates valid v8 sources once and leaves them unchanged', async () => {
    seedLegacy();
    const sources = [localStorage.getItem(EXPIRY_LEGACY_LINES_KEY), localStorage.getItem(EXPIRY_LEGACY_HISTORY_KEY)];
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    writes.mockClear();

    const { result } = renderHook(() => useExpiryWorkspace());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(writes.mock.calls.filter(([key]) => key === EXPIRY_AGGREGATE_KEY)).toHaveLength(1);
    expect([localStorage.getItem(EXPIRY_LEGACY_LINES_KEY), localStorage.getItem(EXPIRY_LEGACY_HISTORY_KEY)]).toEqual(sources);
  });

  it('T13/T21: retry after an uncertain verified write reuses durable state without a duplicate', async () => {
    seedLegacy();
    const { result } = renderHook(() => useExpiryWorkspace());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    const base = JSON.parse(localStorage.getItem(EXPIRY_AGGREGATE_KEY)!) as ExpiryAggregateV1;
    const entry = {
      id: 'stable-id',
      lineId: 'a',
      lineName: 'Ligne A',
      elementLabel: 'Recharge de cuve - même matière',
      changedAt: '2026-09-17T12:00:00.000Z',
      newExpiresAt: line.elements[0].expiresAt,
      operator: 'Fixture',
    };
    const originalGet = Storage.prototype.getItem;
    let reads = 0;
    const get = vi.spyOn(Storage.prototype, 'getItem');
    get.mockImplementation(function (this: Storage, key: string) {
      if (key === EXPIRY_AGGREGATE_KEY && ++reads === 2) throw new DOMException('Blocked', 'SecurityError');
      return originalGet.call(this, key);
    });

    let first;
    act(() => {
      first = result.current.commitDeclaration([{ ...line, vat: 'Cuve 2' }], entry);
    });
    expect(first).toMatchObject({ status: 'degraded', reason: 'verify' });
    get.mockRestore();

    let second;
    act(() => {
      second = result.current.commitDeclaration([{ ...line, vat: 'Cuve 2' }], entry);
    });
    expect(second).toMatchObject({ status: 'persisted', idempotent: true });
    const stored = JSON.parse(localStorage.getItem(EXPIRY_AGGREGATE_KEY)!) as ExpiryAggregateV1;
    expect(stored.history.filter((item) => item.id === 'stable-id')).toHaveLength(1);
    expect(stored.lines[0].vat).toBe('Cuve 2');
    expect(base.history).toEqual([]);
  });

  it('T15: refuses mutations when a future aggregate version is present', () => {
    seedLegacy();
    localStorage.setItem('lineops.expiry.aggregate.v2', JSON.stringify({ schemaVersion: 2 }));
    const { result } = renderHook(() => useExpiryWorkspace());
    expect(result.current.status).toBe('readonly');

    let write;
    act(() => {
      write = result.current.commitDeclaration([line], {
        id: 'blocked',
        lineId: 'a',
        lineName: 'Ligne A',
        elementLabel: 'Bloc de remplissage',
        changedAt: '2026-09-17T12:00:00.000Z',
        newExpiresAt: '2026-09-22T12:00:00.000Z',
        operator: 'Fixture',
      });
    });
    expect(write).toMatchObject({ status: 'degraded', reason: 'future-version' });
    expect(localStorage.getItem(EXPIRY_AGGREGATE_KEY)).toBeNull();
  });
});
