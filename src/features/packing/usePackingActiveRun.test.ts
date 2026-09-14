import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PackingRun } from './domain/packingRun';
import { usePackingActiveRun } from './usePackingActiveRun';

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');

afterEach(() => {
  vi.restoreAllMocks();
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

    let startedRun: PackingRun | null = null;
    expect(() => {
      act(() => {
        startedRun = result.current.startRun({
          requestedUnits: 100,
          unitsPerCarton: 10,
          cartonsPerLoad: 10,
          selectedPolicy: 'no-overrun',
          plannedUnits: 100,
          referenceCadenceUnitsPerMinute: 60,
        });
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
});
