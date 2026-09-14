import { describe, expect, it } from 'vitest';
import {
  PackingRunDomainError,
  addPackingDeclaration,
  formatPackingDuration,
  getPackingDeclarationUnits,
  getPackingRunProgress,
  normalizePackingDeclaration,
  removePackingDeclaration,
  replacePackingDeclaration,
  validatePackingRun,
  type PackingRun,
} from './packingRun';

function createRun(overrides: Partial<PackingRun> = {}): PackingRun {
  return {
    id: 'run-1',
    createdAt: '2026-09-14T18:00:00.000Z',
    requestedUnits: 400_000,
    unitsPerCarton: 480,
    cartonsPerLoad: 50,
    selectedPolicy: 'round-carton',
    plannedUnits: 400_320,
    varianceUnits: 320,
    referenceCadenceUnitsPerMinute: 60,
    declarations: [],
    ...overrides,
  };
}

function expectDomainError(action: () => unknown, code: PackingRunDomainError['code']) {
  try {
    action();
    throw new Error('Expected packing run domain error');
  } catch (error) {
    expect(error).toBeInstanceOf(PackingRunDomainError);
    expect((error as PackingRunDomainError).code).toBe(code);
  }
}

describe('packing declaration normalization', () => {
  it('represents complete cartons plus units in one final partial carton', () => {
    const normalized = normalizePackingDeclaration(
      { completeCartons: 10, partialCartonUnits: 120 },
      480,
    );

    expect(normalized).toEqual({ completeCartons: 10, partialCartonUnits: 120 });
    expect(getPackingDeclarationUnits(normalized, 480)).toBe(4_920);
  });

  it('normalizes partial units that cross a carton boundary', () => {
    const normalized = normalizePackingDeclaration(
      { completeCartons: 0, partialCartonUnits: 600 },
      480,
    );

    expect(normalized).toEqual({ completeCartons: 1, partialCartonUnits: 120 });
    expect(getPackingDeclarationUnits(normalized, 480)).toBe(600);
  });

  it('supports cartons-only and partial-carton-only declarations', () => {
    expect(getPackingDeclarationUnits(normalizePackingDeclaration({ completeCartons: 2, partialCartonUnits: 0 }, 480), 480)).toBe(960);
    expect(getPackingDeclarationUnits(normalizePackingDeclaration({ completeCartons: 0, partialCartonUnits: 120 }, 480), 480)).toBe(120);
  });

  it('rejects a zero declaration', () => {
    expectDomainError(
      () => normalizePackingDeclaration({ completeCartons: 0, partialCartonUnits: 0 }, 480),
      'ZERO_DECLARATION',
    );
  });

  it('rejects negative and non-integer declaration values', () => {
    expectDomainError(
      () => normalizePackingDeclaration({ completeCartons: -1, partialCartonUnits: 0 }, 480),
      'INVALID_DECLARATION',
    );
    expectDomainError(
      () => normalizePackingDeclaration({ completeCartons: 1.5, partialCartonUnits: 0 }, 480),
      'INVALID_DECLARATION',
    );
  });

  it('rejects unsafe declaration arithmetic', () => {
    expectDomainError(
      () => normalizePackingDeclaration({ completeCartons: Number.MAX_SAFE_INTEGER, partialCartonUnits: 0 }, 480),
      'UNSAFE_ARITHMETIC',
    );
  });

  it('requires stored declarations to already be normalized', () => {
    expectDomainError(
      () => getPackingDeclarationUnits({ completeCartons: 1, partialCartonUnits: 480 }, 480),
      'INVALID_DECLARATION',
    );
  });
});

describe('packing run validation and progress', () => {
  it('derives total and remaining time from planned units and reference cadence', () => {
    const run = createRun();
    const progress = getPackingRunProgress(run);

    expect(progress).toEqual({
      declaredUnits: 0,
      remainingUnits: 400_320,
      progressRatio: 0,
      declarationCount: 0,
      estimatedTotalMinutes: 6_672,
      estimatedRemainingMinutes: 6_672,
    });
    expect(formatPackingDuration(progress.estimatedTotalMinutes)).toBe('111 h 12 min');
  });

  it('derives 232,320 remaining units and 64 h 32 min after 168,000 declared units', () => {
    const run = addPackingDeclaration(createRun(), {
      id: 'd-1',
      createdAt: '2026-09-14T18:10:00.000Z',
      completeCartons: 350,
      partialCartonUnits: 0,
    });

    const progress = getPackingRunProgress(run);
    expect(progress.declaredUnits).toBe(168_000);
    expect(progress.remainingUnits).toBe(232_320);
    expect(progress.estimatedRemainingMinutes).toBe(3_872);
    expect(formatPackingDuration(progress.estimatedRemainingMinutes)).toBe('64 h 32 min');
    expect(progress.progressRatio).toBeCloseTo(168_000 / 400_320, 12);
  });

  it('rejects declarations that exceed the remaining plan instead of capping them', () => {
    const nearlyComplete = createRun({
      declarations: [
        {
          id: 'existing',
          createdAt: '2026-09-14T18:10:00.000Z',
          completeCartons: 833,
          partialCartonUnits: 0,
        },
      ],
    });

    expect(getPackingRunProgress(nearlyComplete).remainingUnits).toBe(480);
    expectDomainError(
      () => addPackingDeclaration(nearlyComplete, {
        id: 'too-much',
        createdAt: '2026-09-14T18:20:00.000Z',
        completeCartons: 2,
        partialCartonUnits: 0,
      }),
      'OVER_DECLARATION',
    );
  });

  it('rejects a pre-existing over-declared run during validation', () => {
    const overDeclared = createRun({
      declarations: [
        {
          id: 'd-1',
          createdAt: '2026-09-14T18:10:00.000Z',
          completeCartons: 834,
          partialCartonUnits: 0,
        },
        {
          id: 'd-2',
          createdAt: '2026-09-14T18:11:00.000Z',
          completeCartons: 0,
          partialCartonUnits: 1,
        },
      ],
    });

    expectDomainError(() => validatePackingRun(overDeclared), 'OVER_DECLARATION');
    expectDomainError(() => removePackingDeclaration(overDeclared, 'd-2'), 'OVER_DECLARATION');
  });

  it('reaches exact completion without exceeding one', () => {
    const completed = addPackingDeclaration(createRun(), {
      id: 'complete',
      createdAt: '2026-09-14T18:10:00.000Z',
      completeCartons: 834,
      partialCartonUnits: 0,
    });

    expect(getPackingRunProgress(completed)).toMatchObject({
      declaredUnits: 400_320,
      remainingUnits: 0,
      progressRatio: 1,
      estimatedRemainingMinutes: 0,
    });
  });

  it('rejects inconsistent run plan totals', () => {
    expectDomainError(
      () => getPackingRunProgress(createRun({ varianceUnits: 319 })),
      'INVALID_RUN',
    );
  });

  it('rejects a plan that does not match its selected strategy', () => {
    expectDomainError(
      () => getPackingRunProgress(createRun({ selectedPolicy: 'no-overrun' })),
      'INVALID_RUN',
    );

    expectDomainError(
      () => getPackingRunProgress(createRun({ selectedPolicy: 'round-pallet' })),
      'INVALID_RUN',
    );
  });

  it('accepts the exact plan for no-overrun strategy', () => {
    const exactRun = createRun({
      selectedPolicy: 'no-overrun',
      plannedUnits: 400_000,
      varianceUnits: 0,
    });

    expect(getPackingRunProgress(exactRun)).toMatchObject({
      declaredUnits: 0,
      remainingUnits: 400_000,
      progressRatio: 0,
    });
  });

  it('rejects packing inputs whose derived plan is not exactly representable', () => {
    expectDomainError(
      () => validatePackingRun(createRun({ cartonsPerLoad: Number.MAX_SAFE_INTEGER })),
      'INVALID_RUN',
    );
  });

  it('rejects duplicate declaration identities', () => {
    const run = createRun({
      declarations: [
        { id: 'same', createdAt: '2026-09-14T18:10:00.000Z', completeCartons: 1, partialCartonUnits: 0 },
        { id: 'same', createdAt: '2026-09-14T18:11:00.000Z', completeCartons: 1, partialCartonUnits: 0 },
      ],
    });

    expectDomainError(() => getPackingRunProgress(run), 'INVALID_DECLARATION');
  });
});

describe('packing declaration correction', () => {
  it('removes a declaration and restores the exact previous derived state', () => {
    const base = createRun();
    const withFirst = addPackingDeclaration(base, {
      id: 'd-1',
      createdAt: '2026-09-14T18:10:00.000Z',
      completeCartons: 50,
      partialCartonUnits: 0,
    });
    const withSecond = addPackingDeclaration(withFirst, {
      id: 'd-2',
      createdAt: '2026-09-14T18:20:00.000Z',
      completeCartons: 10,
      partialCartonUnits: 120,
    });

    const restored = removePackingDeclaration(withSecond, 'd-2');
    expect(getPackingRunProgress(restored)).toEqual(getPackingRunProgress(withFirst));
  });

  it('replaces one declaration by identity and recomputes progress', () => {
    const run = addPackingDeclaration(createRun(), {
      id: 'd-1',
      createdAt: '2026-09-14T18:10:00.000Z',
      completeCartons: 10,
      partialCartonUnits: 120,
    });

    const corrected = replacePackingDeclaration(run, 'd-1', {
      completeCartons: 8,
      partialCartonUnits: 240,
    });

    expect(corrected.declarations[0]).toEqual({
      id: 'd-1',
      createdAt: '2026-09-14T18:10:00.000Z',
      completeCartons: 8,
      partialCartonUnits: 240,
    });
    expect(getPackingRunProgress(corrected).declaredUnits).toBe(4_080);
  });

  it('rejects a correction that would over-declare the run', () => {
    const run = addPackingDeclaration(createRun(), {
      id: 'd-1',
      createdAt: '2026-09-14T18:10:00.000Z',
      completeCartons: 1,
      partialCartonUnits: 0,
    });

    expectDomainError(
      () => replacePackingDeclaration(run, 'd-1', {
        completeCartons: 834,
        partialCartonUnits: 1,
      }),
      'OVER_DECLARATION',
    );
  });

  it('rejects correction or removal of an unknown declaration', () => {
    const run = createRun();
    expectDomainError(
      () => replacePackingDeclaration(run, 'missing', { completeCartons: 1, partialCartonUnits: 0 }),
      'DECLARATION_NOT_FOUND',
    );
    expectDomainError(() => removePackingDeclaration(run, 'missing'), 'DECLARATION_NOT_FOUND');
  });
});

describe('packing duration presentation', () => {
  it('keeps fractional-minute precision in domain arithmetic', () => {
    const progress = getPackingRunProgress(createRun({
      requestedUnits: 100,
      selectedPolicy: 'no-overrun',
      plannedUnits: 100,
      varianceUnits: 0,
      unitsPerCarton: 10,
      cartonsPerLoad: 10,
      referenceCadenceUnitsPerMinute: 3,
    }));
    expect(progress.estimatedTotalMinutes).toBeCloseTo(100 / 3, 12);
  });

  it('rounds any positive fractional display duration upward', () => {
    expect(formatPackingDuration(10.01)).toBe('11 min');
    expect(formatPackingDuration(10.49)).toBe('11 min');
    expect(formatPackingDuration(10.5)).toBe('11 min');
    expect(formatPackingDuration(59.01)).toBe('1 h');
    expect(formatPackingDuration(60.01)).toBe('1 h 1 min');
  });

  it('does not round an exact whole-minute duration upward', () => {
    expect(formatPackingDuration(10)).toBe('10 min');
    expect(formatPackingDuration(60)).toBe('1 h');
  });

  it('formats zero and long durations without a wall-clock dependency', () => {
    expect(formatPackingDuration(0)).toBe('0 min');
    expect(formatPackingDuration(6_672)).toBe('111 h 12 min');
  });

  it('rejects invalid durations', () => {
    expectDomainError(() => formatPackingDuration(-1), 'INVALID_RUN');
    expectDomainError(() => formatPackingDuration(Number.POSITIVE_INFINITY), 'INVALID_RUN');
  });
});
