import { describe, expect, it } from 'vitest';
import { PackingRunDomainError, type PackingRun } from '../domain/packingRun';
import { persistActivePackingRun, type PackingStorageLike } from './packingRunStorage';

const storage: PackingStorageLike = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

describe('packing persistence validation boundary', () => {
  it('rejects an invalid run as a domain error instead of misreporting storage degradation', () => {
    const invalidRun: PackingRun = {
      id: 'run-invalid',
      createdAt: '2026-09-14T20:00:00.000Z',
      requestedUnits: 400_000,
      unitsPerCarton: 480,
      cartonsPerLoad: 50,
      selectedPolicy: 'no-overrun',
      plannedUnits: 400_320,
      varianceUnits: 320,
      referenceCadenceUnitsPerMinute: 60,
      declarations: [],
    };

    expect(() => persistActivePackingRun(storage, invalidRun)).toThrow(PackingRunDomainError);
  });
});
