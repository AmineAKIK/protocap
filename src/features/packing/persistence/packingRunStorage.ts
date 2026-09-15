import {
  validatePackingRun,
  type PackingDeclaration,
  type PackingRun,
} from '../domain/packingRun';
import type { PackingPolicy } from '../../../utils/packing';

export const PACKING_ACTIVE_RUN_STORAGE_KEY = 'lineops.packing.active-run.v1';
export const PACKING_RUN_STORAGE_SCHEMA_VERSION = 2 as const;

export interface PackingStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface PersistedPackingDeclarationV2 {
  id: string;
  createdAt: string;
  completeCartons: number;
  partialCartonUnits: number;
}

interface PersistedPackingRunV2 {
  id: string;
  createdAt: string;
  productionStartedAt: string;
  requestedUnits: number;
  unitsPerCarton: number;
  cartonsPerLoad: number;
  selectedPolicy: PackingPolicy;
  plannedUnits: number;
  referenceCadenceUnitsPerMinute: number;
  declarations: PersistedPackingDeclarationV2[];
}

interface PersistedPackingStateV2 {
  schemaVersion: typeof PACKING_RUN_STORAGE_SCHEMA_VERSION;
  activeRun: PersistedPackingRunV2 | null;
}

export type PackingRunLoadResult =
  | { status: 'empty'; activeRun: null }
  | { status: 'loaded'; activeRun: PackingRun }
  | { status: 'corrupt'; activeRun: null }
  | { status: 'unavailable'; activeRun: null };

export type PackingRunWriteResult =
  | { status: 'persisted' }
  | { status: 'degraded' };

export interface NewPackingRunInput {
  requestedUnits: number;
  unitsPerCarton: number;
  cartonsPerLoad: number;
  selectedPolicy: PackingPolicy;
  plannedUnits: number;
  referenceCadenceUnitsPerMinute: number;
  productionStartedAt: string;
}

export interface PackingRunIdentityFactory {
  createId(): string;
  nowIso(): string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getDefaultIdentityFactory(): PackingRunIdentityFactory {
  return {
    createId() {
      if (typeof globalThis.crypto?.randomUUID !== 'function') throw new Error('Secure run identity generation is unavailable.');
      return globalThis.crypto.randomUUID();
    },
    nowIso() {
      return new Date().toISOString();
    },
  };
}

export function createNewPackingRun(
  input: NewPackingRunInput,
  identityFactory: PackingRunIdentityFactory = getDefaultIdentityFactory(),
): PackingRun {
  const run: PackingRun = {
    ...input,
    id: identityFactory.createId(),
    createdAt: identityFactory.nowIso(),
    varianceUnits: input.plannedUnits - input.requestedUnits,
    declarations: [],
  };
  validatePackingRun(run);
  return run;
}

function sanitizeDeclaration(value: unknown): PackingDeclaration {
  if (!isRecord(value)) throw new Error('Invalid declaration record.');
  return {
    id: value.id as string,
    createdAt: value.createdAt as string,
    completeCartons: value.completeCartons as number,
    partialCartonUnits: value.partialCartonUnits as number,
  };
}

function sanitizeRun(value: unknown, schemaVersion: number): PackingRun {
  if (!isRecord(value) || !Array.isArray(value.declarations)) throw new Error('Invalid packing run record.');
  const requestedUnits = value.requestedUnits as number;
  const plannedUnits = value.plannedUnits as number;
  const createdAt = value.createdAt as string;
  const run: PackingRun = {
    id: value.id as string,
    createdAt,
    productionStartedAt: schemaVersion === 1 ? createdAt : value.productionStartedAt as string,
    requestedUnits,
    unitsPerCarton: value.unitsPerCarton as number,
    cartonsPerLoad: value.cartonsPerLoad as number,
    selectedPolicy: value.selectedPolicy as PackingPolicy,
    plannedUnits,
    varianceUnits: plannedUnits - requestedUnits,
    referenceCadenceUnitsPerMinute: value.referenceCadenceUnitsPerMinute as number,
    declarations: value.declarations.map(sanitizeDeclaration),
  };
  validatePackingRun(run);
  return run;
}

function serializeRun(run: PackingRun): PersistedPackingRunV2 {
  validatePackingRun(run);
  return {
    id: run.id,
    createdAt: run.createdAt,
    productionStartedAt: run.productionStartedAt,
    requestedUnits: run.requestedUnits,
    unitsPerCarton: run.unitsPerCarton,
    cartonsPerLoad: run.cartonsPerLoad,
    selectedPolicy: run.selectedPolicy,
    plannedUnits: run.plannedUnits,
    referenceCadenceUnitsPerMinute: run.referenceCadenceUnitsPerMinute,
    declarations: run.declarations.map((declaration) => ({
      id: declaration.id,
      createdAt: declaration.createdAt,
      completeCartons: declaration.completeCartons,
      partialCartonUnits: declaration.partialCartonUnits,
    })),
  };
}

export function loadActivePackingRun(storage: PackingStorageLike): PackingRunLoadResult {
  let stored: string | null;
  try {
    stored = storage.getItem(PACKING_ACTIVE_RUN_STORAGE_KEY);
  } catch {
    return { status: 'unavailable', activeRun: null };
  }
  if (stored === null) return { status: 'empty', activeRun: null };

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!isRecord(parsed)) return { status: 'corrupt', activeRun: null };
    if (parsed.activeRun === null && (parsed.schemaVersion === 1 || parsed.schemaVersion === 2)) {
      return { status: 'empty', activeRun: null };
    }
    if (parsed.schemaVersion !== 1 && parsed.schemaVersion !== PACKING_RUN_STORAGE_SCHEMA_VERSION) {
      return { status: 'corrupt', activeRun: null };
    }
    return { status: 'loaded', activeRun: sanitizeRun(parsed.activeRun, parsed.schemaVersion as number) };
  } catch {
    return { status: 'corrupt', activeRun: null };
  }
}

export function persistActivePackingRun(storage: PackingStorageLike, run: PackingRun | null): PackingRunWriteResult {
  const state: PersistedPackingStateV2 = {
    schemaVersion: PACKING_RUN_STORAGE_SCHEMA_VERSION,
    activeRun: run === null ? null : serializeRun(run),
  };
  try {
    storage.setItem(PACKING_ACTIVE_RUN_STORAGE_KEY, JSON.stringify(state));
    return { status: 'persisted' };
  } catch {
    return { status: 'degraded' };
  }
}

export function clearActivePackingRun(storage: PackingStorageLike): PackingRunWriteResult {
  try {
    storage.removeItem(PACKING_ACTIVE_RUN_STORAGE_KEY);
    return { status: 'persisted' };
  } catch {
    return { status: 'degraded' };
  }
}
