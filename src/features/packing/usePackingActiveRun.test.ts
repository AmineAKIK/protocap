import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PackingRun } from './domain/packingRun';
import { usePackingActiveRun } from './usePackingActiveRun';

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');

function runInput() {
  return {
    requestedUnits: 100,
    unitsPerCarton: 10,
    cartonsPerLoad: 10,
    selectedPolicy: 'no-overrun' as const,
    plannedUnits: 100,
    referenceCadenceUnitsPerMinute: 60,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(window, 'localStorage', originalLocalStorageDescriptor);
  }
  localStorage.clear();
});

describe('usePackingActiveRun storage acquisition', () => {
  it('T18/T23: without Web Locks durable Packing mutations stay degraded and do not write', async () => {
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000099');
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => usePackingActiveRun());

    expect(result.current.persistenceStatus).toBe('degraded');
    let attempt;
    await act(async () => { attempt = await result.current.tryStartRun(runInput()); });
    expect(attempt).toMatchObject({ status: 'degraded' });
    expect(result.current.activeRun).toBeNull();
    expect(writes.mock.calls.some(([key]) => key === 'lineops.packing.active-run.v1')).toBe(false);
  });

  it('stays usable in degraded mode when reading window.localStorage itself throws', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Blocked', 'SecurityError');
      },
    });

    const { result } = renderHook(() => usePackingActiveRun());

    expect(result.current.activeRun).toBeNull();
    expect(result.current.persistenceStatus).toBe('degraded');
    expect(result.current.probePersistence()).toBe('degraded');

    let startedRun: PackingRun | null = null;
    await act(async () => {
      startedRun = await result.current.startRun(runInput());
    });

    expect(startedRun).not.toBeNull();
    expect(result.current.activeRun?.id).toBe('00000000-0000-4000-8000-000000000001');
    expect(result.current.persistenceStatus).toBe('degraded');

    await act(async () => {
      await result.current.updateRun(startedRun!);
    });
    expect(result.current.persistenceStatus).toBe('degraded');

    await act(async () => {
      await result.current.clearRun();
    });
    expect(result.current.activeRun).toBe(startedRun);
    expect(result.current.persistenceStatus).toBe('degraded');
  });

  it('probes persistence without touching the active run key', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem');
    const { result } = renderHook(() => usePackingActiveRun());

    expect(result.current.probePersistence()).toBe('persisted');
    expect(setItem).toHaveBeenCalledWith('lineops.packing.persistence-probe.v1', '1');
    expect(removeItem).toHaveBeenCalledWith('lineops.packing.persistence-probe.v1');
  });

  it('does not activate a run when the real persistence write fails', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000002');
    const { result } = renderHook(() => usePackingActiveRun());
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    let status: string | undefined;
    await act(async () => {
      status = (await result.current.tryStartRun(runInput())).status;
    });

    expect(status).toBe('degraded');
    expect(result.current.activeRun).toBeNull();
    expect(result.current.persistenceStatus).toBe('degraded');
  });

  it('keeps the active run when durable removal fails', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000003');
    const { result } = renderHook(() => usePackingActiveRun());
    await act(async () => {
      await result.current.startRun(runInput());
    });
    expect(result.current.activeRun).not.toBeNull();

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });

    let status: string | undefined;
    await act(async () => {
      status = (await result.current.tryClearRun()).status;
    });

    expect(status).toBe('degraded');
    expect(result.current.activeRun).not.toBeNull();
    expect(result.current.persistenceStatus).toBe('degraded');
  });
});
