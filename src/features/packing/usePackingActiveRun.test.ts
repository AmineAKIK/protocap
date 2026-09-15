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
  localStorage.clear();
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(window, 'localStorage', originalLocalStorageDescriptor);
  }
});

describe('usePackingActiveRun storage acquisition', () => {
  it('stays usable in degraded mode when reading window.localStorage itself throws', () => {
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
    expect(() => {
      act(() => {
        startedRun = result.current.startRun(runInput());
      });
    }).not.toThrow();

    expect(startedRun).not.toBeNull();
    expect(result.current.activeRun?.id).toBe('00000000-0000-4000-8000-000000000001');
    expect(result.current.persistenceStatus).toBe('degraded');

    expect(() => {
      act(() => {
        result.current.updateRun(startedRun!);
      });
    }).not.toThrow();
    expect(result.current.persistenceStatus).toBe('degraded');

    expect(() => {
      act(() => {
        result.current.clearRun();
      });
    }).not.toThrow();
    expect(result.current.activeRun).toBeNull();
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

  it('does not activate a run when the real persistence write fails', () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000002');
    const { result } = renderHook(() => usePackingActiveRun());
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    let status: string | undefined;
    act(() => {
      status = result.current.tryStartRun(runInput()).status;
    });

    expect(status).toBe('degraded');
    expect(result.current.activeRun).toBeNull();
    expect(result.current.persistenceStatus).toBe('degraded');
  });

  it('keeps the active run when durable removal fails', () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000003');
    const { result } = renderHook(() => usePackingActiveRun());
    act(() => {
      result.current.startRun(runInput());
    });
    expect(result.current.activeRun).not.toBeNull();

    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });

    let status: string | undefined;
    act(() => {
      status = result.current.tryClearRun().status;
    });

    expect(status).toBe('degraded');
    expect(result.current.activeRun).not.toBeNull();
    expect(result.current.persistenceStatus).toBe('degraded');
  });
});
