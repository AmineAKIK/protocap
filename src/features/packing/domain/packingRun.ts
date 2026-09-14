import {
  calculatePackingOptions,
  type PackingPolicy,
} from '../../../utils/packing';

export type PackingRunDomainErrorCode =
  | 'INVALID_RUN'
  | 'INVALID_DECLARATION'
  | 'ZERO_DECLARATION'
  | 'UNSAFE_ARITHMETIC'
  | 'OVER_DECLARATION'
  | 'DECLARATION_NOT_FOUND';

export class PackingRunDomainError extends RangeError {
  readonly code: PackingRunDomainErrorCode;

  constructor(code: PackingRunDomainErrorCode, message: string) {
    super(message);
    this.name = 'PackingRunDomainError';
    this.code = code;
  }
}

export interface PackingDeclarationInput {
  completeCartons: number;
  partialCartonUnits: number;
}

export interface PackingDeclaration {
  id: string;
  createdAt: string;
  completeCartons: number;
  partialCartonUnits: number;
}

export interface PackingRun {
  id: string;
  createdAt: string;
  requestedUnits: number;
  unitsPerCarton: number;
  cartonsPerLoad: number;
  selectedPolicy: PackingPolicy;
  plannedUnits: number;
  varianceUnits: number;
  referenceCadenceUnitsPerMinute: number;
  declarations: readonly PackingDeclaration[];
}

export interface PackingRunProgress {
  declaredUnits: number;
  remainingUnits: number;
  progressRatio: number;
  declarationCount: number;
  estimatedTotalMinutes: number;
  estimatedRemainingMinutes: number;
}

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function assertPositiveSafeInteger(value: number, label: string): void {
  if (!isPositiveSafeInteger(value)) {
    throw new PackingRunDomainError('INVALID_RUN', `${label} must be a positive safe integer.`);
  }
}

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!isNonNegativeSafeInteger(value)) {
    throw new PackingRunDomainError('INVALID_DECLARATION', `${label} must be a non-negative safe integer.`);
  }
}

function assertIdentity(value: string, label: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new PackingRunDomainError('INVALID_RUN', `${label} must be a non-empty string.`);
  }
}

function assertTimestamp(value: string, label: string): void {
  if (typeof value !== 'string' || value.trim() === '' || !Number.isFinite(Date.parse(value))) {
    throw new PackingRunDomainError('INVALID_RUN', `${label} must be a valid date string.`);
  }
}

function assertPackingPolicy(value: PackingPolicy): void {
  if (value !== 'no-overrun' && value !== 'round-carton' && value !== 'round-pallet') {
    throw new PackingRunDomainError('INVALID_RUN', 'selectedPolicy must be a supported packing policy.');
  }
}

function safeMultiply(left: number, right: number, label: string): number {
  const product = left * right;
  if (!Number.isSafeInteger(product)) {
    throw new PackingRunDomainError('UNSAFE_ARITHMETIC', `${label} exceeds the exact integer range.`);
  }
  return product;
}

function safeAdd(left: number, right: number, label: string): number {
  const sum = left + right;
  if (!Number.isSafeInteger(sum)) {
    throw new PackingRunDomainError('UNSAFE_ARITHMETIC', `${label} exceeds the exact integer range.`);
  }
  return sum;
}

export function normalizePackingDeclaration(
  input: PackingDeclarationInput,
  unitsPerCarton: number,
): PackingDeclarationInput {
  assertPositiveSafeInteger(unitsPerCarton, 'unitsPerCarton');
  assertNonNegativeSafeInteger(input.completeCartons, 'completeCartons');
  assertNonNegativeSafeInteger(input.partialCartonUnits, 'partialCartonUnits');

  const promotedCartons = Math.floor(input.partialCartonUnits / unitsPerCarton);
  const partialCartonUnits = input.partialCartonUnits % unitsPerCarton;
  const completeCartons = safeAdd(
    input.completeCartons,
    promotedCartons,
    'Normalized complete-carton count',
  );
  const completeCartonUnits = safeMultiply(
    completeCartons,
    unitsPerCarton,
    'Normalized declaration carton volume',
  );
  const totalUnits = safeAdd(
    completeCartonUnits,
    partialCartonUnits,
    'Normalized declaration total',
  );

  if (totalUnits === 0) {
    throw new PackingRunDomainError(
      'ZERO_DECLARATION',
      'A packing declaration must represent at least one produced unit.',
    );
  }

  return { completeCartons, partialCartonUnits };
}

export function getPackingDeclarationUnits(
  declaration: Pick<PackingDeclaration, 'completeCartons' | 'partialCartonUnits'>,
  unitsPerCarton: number,
): number {
  assertPositiveSafeInteger(unitsPerCarton, 'unitsPerCarton');
  assertNonNegativeSafeInteger(declaration.completeCartons, 'completeCartons');
  assertNonNegativeSafeInteger(declaration.partialCartonUnits, 'partialCartonUnits');

  if (declaration.partialCartonUnits >= unitsPerCarton) {
    throw new PackingRunDomainError(
      'INVALID_DECLARATION',
      'Stored partialCartonUnits must already be normalized below unitsPerCarton.',
    );
  }

  const completeCartonUnits = safeMultiply(
    declaration.completeCartons,
    unitsPerCarton,
    'Declaration carton volume',
  );
  const totalUnits = safeAdd(
    completeCartonUnits,
    declaration.partialCartonUnits,
    'Declaration total',
  );

  if (totalUnits === 0) {
    throw new PackingRunDomainError(
      'ZERO_DECLARATION',
      'A packing declaration must represent at least one produced unit.',
    );
  }

  return totalUnits;
}

function getExpectedSelectedPlan(run: PackingRun): { totalPrepared: number; variance: number } {
  try {
    const selectedOption = calculatePackingOptions({
      quantity: run.requestedUnits,
      unitsPerCarton: run.unitsPerCarton,
      cartonsPerPalette: run.cartonsPerLoad,
    }).find((option) => option.policy === run.selectedPolicy);

    if (!selectedOption) {
      throw new PackingRunDomainError(
        'INVALID_RUN',
        'selectedPolicy must resolve to a packing plan.',
      );
    }

    return {
      totalPrepared: selectedOption.totalPrepared,
      variance: selectedOption.variance,
    };
  } catch (error) {
    if (error instanceof PackingRunDomainError) throw error;
    throw new PackingRunDomainError(
      'INVALID_RUN',
      'Run planning inputs must resolve to an exactly representable packing plan.',
    );
  }
}

export function validatePackingRun(run: PackingRun): void {
  assertIdentity(run.id, 'run.id');
  assertTimestamp(run.createdAt, 'run.createdAt');
  assertPositiveSafeInteger(run.requestedUnits, 'requestedUnits');
  assertPositiveSafeInteger(run.unitsPerCarton, 'unitsPerCarton');
  assertPositiveSafeInteger(run.cartonsPerLoad, 'cartonsPerLoad');
  assertPositiveSafeInteger(run.plannedUnits, 'plannedUnits');
  assertPositiveSafeInteger(run.referenceCadenceUnitsPerMinute, 'referenceCadenceUnitsPerMinute');
  assertPackingPolicy(run.selectedPolicy);

  if (!isNonNegativeSafeInteger(run.varianceUnits)) {
    throw new PackingRunDomainError('INVALID_RUN', 'varianceUnits must be a non-negative safe integer.');
  }

  const expectedPlan = getExpectedSelectedPlan(run);
  if (
    run.plannedUnits !== expectedPlan.totalPrepared ||
    run.varianceUnits !== expectedPlan.variance
  ) {
    throw new PackingRunDomainError(
      'INVALID_RUN',
      'plannedUnits and varianceUnits must match the selected packing strategy.',
    );
  }

  if (!Array.isArray(run.declarations)) {
    throw new PackingRunDomainError('INVALID_RUN', 'declarations must be an array.');
  }

  const seenIds = new Set<string>();
  let declaredUnits = 0;
  for (const declaration of run.declarations) {
    assertIdentity(declaration.id, 'declaration.id');
    assertTimestamp(declaration.createdAt, 'declaration.createdAt');
    if (seenIds.has(declaration.id)) {
      throw new PackingRunDomainError('INVALID_DECLARATION', `Duplicate declaration id: ${declaration.id}`);
    }
    seenIds.add(declaration.id);

    declaredUnits = safeAdd(
      declaredUnits,
      getPackingDeclarationUnits(declaration, run.unitsPerCarton),
      'Cumulative declared production',
    );
    if (declaredUnits > run.plannedUnits) {
      throw new PackingRunDomainError(
        'OVER_DECLARATION',
        'Declared production cannot exceed the active run plan.',
      );
    }
  }
}

export function getPackingRunProgress(run: PackingRun): PackingRunProgress {
  validatePackingRun(run);

  let declaredUnits = 0;
  for (const declaration of run.declarations) {
    declaredUnits = safeAdd(
      declaredUnits,
      getPackingDeclarationUnits(declaration, run.unitsPerCarton),
      'Cumulative declared production',
    );
  }

  const remainingUnits = run.plannedUnits - declaredUnits;
  const estimatedTotalMinutes = run.plannedUnits / run.referenceCadenceUnitsPerMinute;
  const estimatedRemainingMinutes = remainingUnits / run.referenceCadenceUnitsPerMinute;

  return {
    declaredUnits,
    remainingUnits,
    progressRatio: declaredUnits / run.plannedUnits,
    declarationCount: run.declarations.length,
    estimatedTotalMinutes,
    estimatedRemainingMinutes,
  };
}

export function addPackingDeclaration(
  run: PackingRun,
  declaration: Pick<PackingDeclaration, 'id' | 'createdAt'> & PackingDeclarationInput,
): PackingRun {
  validatePackingRun(run);
  assertIdentity(declaration.id, 'declaration.id');
  assertTimestamp(declaration.createdAt, 'declaration.createdAt');

  if (run.declarations.some((current) => current.id === declaration.id)) {
    throw new PackingRunDomainError('INVALID_DECLARATION', `Duplicate declaration id: ${declaration.id}`);
  }

  const normalized = normalizePackingDeclaration(declaration, run.unitsPerCarton);
  const declarationUnits = getPackingDeclarationUnits(normalized, run.unitsPerCarton);
  const progress = getPackingRunProgress(run);

  if (declarationUnits > progress.remainingUnits) {
    throw new PackingRunDomainError(
      'OVER_DECLARATION',
      `Declaration of ${declarationUnits} units exceeds the ${progress.remainingUnits} units remaining in the run.`,
    );
  }

  return {
    ...run,
    declarations: [
      ...run.declarations,
      {
        id: declaration.id,
        createdAt: declaration.createdAt,
        ...normalized,
      },
    ],
  };
}

export function replacePackingDeclaration(
  run: PackingRun,
  declarationId: string,
  replacement: PackingDeclarationInput,
): PackingRun {
  validatePackingRun(run);
  const index = run.declarations.findIndex((declaration) => declaration.id === declarationId);
  if (index === -1) {
    throw new PackingRunDomainError('DECLARATION_NOT_FOUND', `Unknown declaration: ${declarationId}`);
  }

  const normalized = normalizePackingDeclaration(replacement, run.unitsPerCarton);
  const declarations = run.declarations.map((declaration, declarationIndex) =>
    declarationIndex === index ? { ...declaration, ...normalized } : declaration,
  );
  const corrected = { ...run, declarations };
  getPackingRunProgress(corrected);
  return corrected;
}

export function removePackingDeclaration(run: PackingRun, declarationId: string): PackingRun {
  validatePackingRun(run);
  if (!run.declarations.some((declaration) => declaration.id === declarationId)) {
    throw new PackingRunDomainError('DECLARATION_NOT_FOUND', `Unknown declaration: ${declarationId}`);
  }

  return {
    ...run,
    declarations: run.declarations.filter((declaration) => declaration.id !== declarationId),
  };
}

/**
 * Estimated durations keep fractional-minute precision in domain arithmetic.
 * Presentation rounds any positive fractional minute upward so the displayed
 * estimate never understates the remaining production duration.
 */
export function formatPackingDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) {
    throw new PackingRunDomainError('INVALID_RUN', 'Duration must be a finite non-negative number of minutes.');
  }

  const roundedMinutes = Math.ceil(minutes);
  const hours = Math.floor(roundedMinutes / 60);
  const remainingMinutes = roundedMinutes % 60;

  if (hours === 0) return `${remainingMinutes} min`;
  if (remainingMinutes === 0) return `${hours} h`;
  return `${hours} h ${remainingMinutes} min`;
}
