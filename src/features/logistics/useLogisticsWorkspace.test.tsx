import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LogisticsRequest } from '../../types/logistics';
import { LOGISTICS_LEGACY_KEY, LOGISTICS_WORKSPACE_KEY } from './logisticsPersistence';
import { useLogisticsWorkspace } from './useLogisticsWorkspace';

const initial: LogisticsRequest[] = [{
  id: 'LOG-201', line: 'Ligne A', zone: 'Sortie', palletCount: 1, priority: 'normal',
  nature: 'Palette', createdAt: '2026-09-18T08:00:00.000Z', status: 'waiting',
}];

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe('useLogisticsWorkspace concurrency', () => {
  it('T11: failed durable creation keeps confirmed state unchanged', async () => {
    localStorage.setItem(LOGISTICS_LEGACY_KEY, JSON.stringify(initial));
    const { result } = renderHook(() => useLogisticsWorkspace(initial));
    await waitFor(() => expect(result.current.status).toBe('persisted'));

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    const request = { ...initial[0], id: 'LOG-202' };

    let outcome;
    await act(async () => { outcome = await result.current.createRequest(request); });
    expect(outcome).toMatchObject({ status: 'degraded', reason: 'quota' });
    expect(result.current.requests).toEqual(initial);
    expect(result.current.status).toBe('write-failed');
  });

  it('T23: two stale hook instances preserve both creates', async () => {
    localStorage.setItem(LOGISTICS_LEGACY_KEY, JSON.stringify(initial));
    const first = renderHook(() => useLogisticsWorkspace(initial));
    const second = renderHook(() => useLogisticsWorkspace(initial));
    await waitFor(() => expect(first.result.current.status).toBe('persisted'));
    await waitFor(() => expect(second.result.current.status).toBe('persisted'));

    const a = { ...initial[0], id: 'LOG-202', zone: 'Onglet A' };
    const b = { ...initial[0], id: 'LOG-203', zone: 'Onglet B' };
    await act(async () => { expect((await first.result.current.createRequest(a)).status).toBe('persisted'); });
    await act(async () => { expect((await second.result.current.createRequest(b)).status).toBe('persisted'); });

    const stored = JSON.parse(localStorage.getItem(LOGISTICS_WORKSPACE_KEY)!);
    expect(stored.requests.map((entry: LogisticsRequest) => entry.id)).toEqual(expect.arrayContaining(['LOG-202', 'LOG-203', 'LOG-201']));
  });

  it('T12/T21: retrying one stable identity remains idempotent', async () => {
    localStorage.setItem(LOGISTICS_LEGACY_KEY, JSON.stringify(initial));
    const { result } = renderHook(() => useLogisticsWorkspace(initial));
    await waitFor(() => expect(result.current.status).toBe('persisted'));
    const request = { ...initial[0], id: 'LOG-202', createdAt: '2026-09-18T08:05:00.000Z' };

    let first;
    await act(async () => { first = await result.current.createRequest(request); });
    let second;
    await act(async () => { second = await result.current.createRequest(request); });
    expect(first).toMatchObject({ status: 'persisted', idempotent: false });
    expect(second).toMatchObject({ status: 'persisted', idempotent: true });
    const stored = JSON.parse(localStorage.getItem(LOGISTICS_WORKSPACE_KEY)!);
    expect(stored.requests.filter((entry: LogisticsRequest) => entry.id === 'LOG-202')).toHaveLength(1);
  });

  it('T20: terminal legacy data without completedAt is migrated without inventing a timestamp', async () => {
    const historic = [{ ...initial[0], status: 'pickedUp' as const, completedAt: undefined }];
    localStorage.setItem(LOGISTICS_LEGACY_KEY, JSON.stringify(historic));
    const { result } = renderHook(() => useLogisticsWorkspace(initial));
    await waitFor(() => expect(result.current.status).toBe('persisted'));
    expect(result.current.requests[0].completedAt).toBeUndefined();
    const stored = JSON.parse(localStorage.getItem(LOGISTICS_WORKSPACE_KEY)!);
    expect(stored.requests[0].completedAt).toBeUndefined();
  });

  it('T23: missing Web Locks makes durable Logistics read-only', async () => {
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    localStorage.setItem(LOGISTICS_LEGACY_KEY, JSON.stringify(initial));
    const { result } = renderHook(() => useLogisticsWorkspace(initial));
    expect(result.current.status).toBe('readonly');

    let outcome;
    await act(async () => { outcome = await result.current.createRequest({ ...initial[0], id: 'LOG-202' }); });
    expect(outcome).toMatchObject({ status: 'degraded', reason: 'concurrency-unavailable' });
    expect(localStorage.getItem(LOGISTICS_WORKSPACE_KEY)).toBeNull();
  });
});
