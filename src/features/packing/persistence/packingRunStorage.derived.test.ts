import { describe, expect, it } from 'vitest';
import {
  PACKING_ACTIVE_RUN_STORAGE_KEY,
  loadActivePackingRun,
  type PackingStorageLike,
} from './packingRunStorage';

class SingleValueStorage implements PackingStorageLike {
  constructor(private value: string | null) {}

  getItem(key: string): string | null {
    return key === PACKING_ACTIVE_RUN_STORAGE_KEY ? this.value : null;
  }

  setItem(key: string, value: string): void {
    if (key === PACKING_ACTIVE_RUN_STORAGE_KEY) this.value = value;
  }

  removeItem(key: string): void {
    if (key === PACKING_ACTIVE_RUN_STORAGE_KEY) this.value = null;
  }
}

describe('packing persisted-source sanitization', () => {
  it('recomputes variance and ignores stale persisted derived declaration totals', () => {
    const storage = new SingleValueStorage(JSON.stringify({
      schemaVersion: 1,
      activeRun: {
        id: 'run-1',
        createdAt: '2026-09-14T20:00:00.000Z',
        requestedUnits: 400_000,
        unitsPerCarton: 480,
        cartonsPerLoad: 50,
        selectedPolicy: 'round-carton',
        plannedUnits: 400_320,
        varianceUnits: 999_999,
        referenceCadenceUnitsPerMinute: 60,
        declarations: [
          {
            id: 'd-1',
            createdAt: '2026-09-14T20:10:00.000Z',
            completeCartons: 10,
            partialCartonUnits: 120,
            totalUnits: 1,
          },
        ],
      },
    }));

    const result = loadActivePackingRun(storage);

    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded') throw new Error('Expected a valid sanitized run.');
    expect(result.activeRun.varianceUnits).toBe(320);
    expect(result.activeRun.declarations[0]).toEqual({
      id: 'd-1',
      createdAt: '2026-09-14T20:10:00.000Z',
      completeCartons: 10,
      partialCartonUnits: 120,
    });
    expect('totalUnits' in result.activeRun.declarations[0]).toBe(false);
  });
});
