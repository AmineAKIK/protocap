import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LogisticsRequest } from '../../types/logistics';
import { useLogisticsWorkspace } from './useLogisticsWorkspace';

const key = 'lineops.logistics.requests.v8';
const initial: LogisticsRequest[] = [{
  id: 'LOG-201', line: 'Ligne A', zone: 'Sortie', palletCount: 1, priority: 'normal',
  nature: 'Palette', createdAt: '2026-09-18T08:00:00.000Z', status: 'waiting',
}];

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe('useLogisticsWorkspace', () => {
  it('T11: failed creation keeps confirmed state unchanged and exposes no fake persistence', () => {
    const { result } = renderHook(() => useLogisticsWorkspace(initial));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    const request = { ...initial[0], id: 'LOG-202' };

    let outcome;
    act(() => { outcome = result.current.createRequest(request); });

    expect(outcome).toMatchObject({ status: 'degraded', reason: 'quota' });
    expect(result.current.requests).toEqual(initial);
    expect(result.current.status).toBe('write-failed');
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('T12/T21: retrying the same identity is idempotent after the first verified success', () => {
    const { result } = renderHook(() => useLogisticsWorkspace(initial));
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const request = { ...initial[0], id: 'LOG-202', createdAt: '2026-09-18T08:05:00.000Z' };

    let first;
    act(() => { first = result.current.createRequest(request); });
    let second;
    act(() => { second = result.current.createRequest(request); });

    expect(first).toEqual({ status: 'persisted', idempotent: false });
    expect(second).toEqual({ status: 'persisted', idempotent: true });
    expect(result.current.requests.filter((entry) => entry.id === 'LOG-202')).toHaveLength(1);
    expect(writes.mock.calls.filter(([storedKey]) => storedKey === key)).toHaveLength(1);
  });

  it('T20: loading a terminal request without completedAt does not fabricate or rewrite it', () => {
    const historic = [{ ...initial[0], status: 'pickedUp' as const, completedAt: undefined }];
    localStorage.setItem(key, JSON.stringify(historic));
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    writes.mockClear();

    const { result } = renderHook(() => useLogisticsWorkspace(initial));

    expect(result.current.requests).toEqual(historic);
    expect(result.current.requests[0].completedAt).toBeUndefined();
    expect(writes).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(key) ?? 'null')).toEqual(historic);
  });

  it('T22: refuses a terminal transition without writing', () => {
    const historic = [{ ...initial[0], status: 'pickedUp' as const, completedAt: '2026-09-18T08:10:00.000Z' }];
    localStorage.setItem(key, JSON.stringify(historic));
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    writes.mockClear();
    const { result } = renderHook(() => useLogisticsWorkspace(initial));

    let outcome;
    act(() => { outcome = result.current.updateStatus('LOG-201', 'cancelled', '2026-09-18T08:20:00.000Z'); });

    expect(outcome).toEqual({ status: 'degraded', reason: 'invalid-transition' });
    expect(writes).not.toHaveBeenCalled();
    expect(result.current.requests).toEqual(historic);
  });
});
