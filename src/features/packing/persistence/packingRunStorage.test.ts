import { describe, expect, it } from 'vitest';
import { addPackingDeclaration, type PackingRun } from '../domain/packingRun';
import {
  PACKING_ACTIVE_RUN_STORAGE_KEY,
  clearActivePackingRun,
  createNewPackingRun,
  loadActivePackingRun,
  persistActivePackingRun,
  type PackingRunIdentityFactory,
  type PackingStorageLike,
} from './packingRunStorage';

class MemoryStorage implements PackingStorageLike {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function identityFactory(id: string, createdAt: string): PackingRunIdentityFactory {
  return {
    createId: () => id,
    nowIso: () => createdAt,
  };
}

function createRun(id = 'run-1'): PackingRun {
  return createNewPackingRun(
    {
      requestedUnits: 400_000,
      unitsPerCarton: 480,
      cartonsPerLoad: 50,
      selectedPolicy: 'round-carton',
      plannedUnits: 400_320,
      referenceCadenceUnitsPerMinute: 60,
    },
    identityFactory(id, '2026-09-14T20:00:00.000Z'),
  );
}

describe('packing active-run persistence', () => {
  it('round-trips one active run with its declaration history', () => {
    const storage = new MemoryStorage();
    const run = addPackingDeclaration(createRun(), {
      id: 'declaration-1',
      createdAt: '2026-09-14T20:10:00.000Z',
      completeCartons: 10,
      partialCartonUnits: 120,
    });

    expect(persistActivePackingRun(storage, run)).toEqual({ status: 'persisted' });
    expect(loadActivePackingRun(storage)).toEqual({ status: 'loaded', activeRun: run });
  });

  it('does not persist derived variance or declaration totals', () => {
    const storage = new MemoryStorage();
    const run = addPackingDeclaration(createRun(), {
      id: 'declaration-1',
      createdAt: '2026-09-14T20:10:00.000Z',
      completeCartons: 10,
      partialCartonUnits: 120,
    });

    persistActivePackingRun(storage, run);
    const serialized = JSON.parse(storage.getItem(PACKING_ACTIVE_RUN_STORAGE_KEY) ?? '{}');

    expect(serialized.activeRun.varianceUnits).toBeUndefined();
    expect(serialized.activeRun.declarations[0].totalUnits).toBeUndefined();
    expect(serialized.activeRun.declarations[0]).toEqual({
      id: 'declaration-1',
      createdAt: '2026-09-14T20:10:00.000Z',
      completeCartons: 10,
      partialCartonUnits: 120,
    });
  });

  it('creates independent identities for identical plan parameters', () => {
    const first = createNewPackingRun(
      {
        requestedUnits: 400_000,
        unitsPerCarton: 480,
        cartonsPerLoad: 50,
        selectedPolicy: 'round-carton',
        plannedUnits: 400_320,
        referenceCadenceUnitsPerMinute: 60,
      },
      identityFactory('run-a', '2026-09-14T20:00:00.000Z'),
    );
    const second = createNewPackingRun(
      {
        requestedUnits: 400_000,
        unitsPerCarton: 480,
        cartonsPerLoad: 50,
        selectedPolicy: 'round-carton',
        plannedUnits: 400_320,
        referenceCadenceUnitsPerMinute: 60,
      },
      identityFactory('run-b', '2026-09-14T20:30:00.000Z'),
    );

    expect(first.id).not.toBe(second.id);
    expect(first.declarations).toEqual([]);
    expect(second.declarations).toEqual([]);
  });

  it('replaces the persisted active run instead of inheriting old declarations', () => {
    const storage = new MemoryStorage();
    const first = addPackingDeclaration(createRun('run-a'), {
      id: 'declaration-1',
      createdAt: '2026-09-14T20:10:00.000Z',
      completeCartons: 10,
      partialCartonUnits: 0,
    });
    const second = createRun('run-b');

    persistActivePackingRun(storage, first);
    persistActivePackingRun(storage, second);

    expect(loadActivePackingRun(storage)).toEqual({ status: 'loaded', activeRun: second });
  });

  it('ignores legacy parameter-derived shipment progress', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      'lineops.packing.shipment.progress.v8',
      JSON.stringify({ progressByCalculation: { '400000:480:50:round-carton': 7 } }),
    );

    expect(loadActivePackingRun(storage)).toEqual({ status: 'empty', activeRun: null });
  });

  it('fails closed on malformed, wrong-version, or domain-invalid state', () => {
    const storage = new MemoryStorage();

    storage.setItem(PACKING_ACTIVE_RUN_STORAGE_KEY, '{');
    expect(loadActivePackingRun(storage)).toEqual({ status: 'corrupt', activeRun: null });

    storage.setItem(
      PACKING_ACTIVE_RUN_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 2, activeRun: null }),
    );
    expect(loadActivePackingRun(storage)).toEqual({ status: 'corrupt', activeRun: null });

    storage.setItem(
      PACKING_ACTIVE_RUN_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        activeRun: {
          id: 'bad-run',
          createdAt: '2026-09-14T20:00:00.000Z',
          requestedUnits: 400_000,
          unitsPerCarton: 480,
          cartonsPerLoad: 50,
          selectedPolicy: 'no-overrun',
          plannedUnits: 400_320,
          referenceCadenceUnitsPerMinute: 60,
          declarations: [],
        },
      }),
    );
    expect(loadActivePackingRun(storage)).toEqual({ status: 'corrupt', activeRun: null });
  });

  it('fails closed when stored declarations over-declare the plan', () => {
    const storage = new MemoryStorage();
    const run = createRun();
    const persisted = {
      schemaVersion: 1,
      activeRun: {
        id: run.id,
        createdAt: run.createdAt,
        requestedUnits: run.requestedUnits,
        unitsPerCarton: run.unitsPerCarton,
        cartonsPerLoad: run.cartonsPerLoad,
        selectedPolicy: run.selectedPolicy,
        plannedUnits: run.plannedUnits,
        referenceCadenceUnitsPerMinute: run.referenceCadenceUnitsPerMinute,
        declarations: [
          {
            id: 'd-1',
            createdAt: '2026-09-14T20:10:00.000Z',
            completeCartons: 834,
            partialCartonUnits: 0,
          },
          {
            id: 'd-2',
            createdAt: '2026-09-14T20:11:00.000Z',
            completeCartons: 0,
            partialCartonUnits: 1,
          },
        ],
      },
    };
    storage.setItem(PACKING_ACTIVE_RUN_STORAGE_KEY, JSON.stringify(persisted));

    expect(loadActivePackingRun(storage)).toEqual({ status: 'corrupt', activeRun: null });
  });

  it('reports degraded writes without throwing or claiming persistence success', () => {
    const storage: PackingStorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      },
      removeItem: () => {
        throw new DOMException('Blocked', 'SecurityError');
      },
    };

    expect(persistActivePackingRun(storage, createRun())).toEqual({ status: 'degraded' });
    expect(clearActivePackingRun(storage)).toEqual({ status: 'degraded' });
  });

  it('distinguishes unavailable reads from empty storage', () => {
    const storage: PackingStorageLike = {
      getItem: () => {
        throw new DOMException('Blocked', 'SecurityError');
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    };

    expect(loadActivePackingRun(storage)).toEqual({ status: 'unavailable', activeRun: null });
  });

  it('can explicitly clear the active-run record', () => {
    const storage = new MemoryStorage();
    persistActivePackingRun(storage, createRun());

    expect(clearActivePackingRun(storage)).toEqual({ status: 'persisted' });
    expect(loadActivePackingRun(storage)).toEqual({ status: 'empty', activeRun: null });
  });
});
