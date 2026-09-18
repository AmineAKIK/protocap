import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConditioningLine } from '../../types/expiry';
import {
  EXPIRY_AGGREGATE_KEY,
  EXPIRY_PREVIOUS_AGGREGATE_KEY,
  type ExpiryAggregateV2,
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
const draft = {
  changedAt: '2026-09-17T14:00',
  timeZone: 'Europe/Paris',
  occurrence: '',
  operator: 'Fixture',
  vat: 'Cuve 2',
  comment: '',
};

function seedV1() {
  localStorage.setItem(EXPIRY_PREVIOUS_AGGREGATE_KEY, JSON.stringify({
    schemaVersion: 1,
    lines: [line],
    history: [],
  }));
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('useExpiryWorkspace concurrency', () => {
  it('T14/T40: migrates v1 to v2 once and reloads the revisioned workspace', async () => {
    seedV1();
    const source = localStorage.getItem(EXPIRY_PREVIOUS_AGGREGATE_KEY);
    const { result } = renderHook(() => useExpiryWorkspace());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    const stored = JSON.parse(localStorage.getItem(EXPIRY_AGGREGATE_KEY)!) as ExpiryAggregateV2;
    expect(stored).toMatchObject({ schemaVersion: 2, revision: 1 });
    expect(localStorage.getItem(EXPIRY_PREVIOUS_AGGREGATE_KEY)).toBe(source);
  });

  it('T23: two stale hook instances preserve both compatible operations by rereading inside the lock', async () => {
    seedV1();
    const first = renderHook(() => useExpiryWorkspace());
    const second = renderHook(() => useExpiryWorkspace());
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    await waitFor(() => expect(second.result.current.status).toBe('ready'));

    await act(async () => {
      const result = await first.result.current.commitDeclaration('a', 'refill', { ...draft, operator: 'Onglet A', vat: 'Cuve A' }, 'op-a');
      expect(result.status).toBe('persisted');
    });
    await act(async () => {
      const result = await second.result.current.commitDeclaration('a', 'refill', { ...draft, operator: 'Onglet B', vat: 'Cuve B' }, 'op-b');
      expect(result.status).toBe('persisted');
    });

    const stored = JSON.parse(localStorage.getItem(EXPIRY_AGGREGATE_KEY)!) as ExpiryAggregateV2;
    expect(stored.history.map((entry) => entry.id)).toEqual(expect.arrayContaining(['op-a', 'op-b']));
    expect(new Set(stored.history.map((entry) => entry.id)).size).toBe(stored.history.length);
    expect(stored.revision).toBeGreaterThanOrEqual(3);
  });

  it('T21/T23: retry with the same operation id is idempotent', async () => {
    seedV1();
    const { result } = renderHook(() => useExpiryWorkspace());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    let first;
    await act(async () => {
      first = await result.current.commitDeclaration('a', 'refill', draft, 'stable-op');
    });
    expect(first).toMatchObject({ status: 'persisted', idempotent: false });

    let second;
    await act(async () => {
      second = await result.current.commitDeclaration('a', 'refill', draft, 'stable-op');
    });
    expect(second).toMatchObject({ status: 'persisted', idempotent: true });
    const stored = JSON.parse(localStorage.getItem(EXPIRY_AGGREGATE_KEY)!) as ExpiryAggregateV2;
    expect(stored.history.filter((entry) => entry.id === 'stable-op')).toHaveLength(1);
  });

  it('T23: missing Web Locks is explicit read-only and executes no mutation', async () => {
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    seedV1();
    const { result } = renderHook(() => useExpiryWorkspace());
    expect(result.current.status).toBe('readonly');

    let write;
    await act(async () => {
      write = await result.current.commitDeclaration('a', 'refill', draft, 'blocked');
    });
    expect(write).toMatchObject({ status: 'degraded', reason: 'concurrency-unavailable' });
    expect(localStorage.getItem(EXPIRY_AGGREGATE_KEY)).toBeNull();
  });
});
