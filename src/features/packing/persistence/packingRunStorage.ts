import {
  validatePackingRun,
  type PackingDeclaration,
  type PackingRun,
} from '../domain/packingRun';
import type { PackingPolicy } from '../../../utils/packing';

export const PACKING_ACTIVE_RUN_STORAGE_KEY = 'lineops.packing.active-run.v1';
export const PACKING_RUN_STORAGE_SCHEMA_VERSION = 1 as const;

export interface PackingStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface PersistedPackingDeclarationV1 {
  id: string;
  createdAt: string;
  completeCartons: number;
  partialCartonUnits: number;
}

interface PersistedPackingRunV1 {
  id: string;
  createdAt: string;
  requestedUnits: number;
  unitsPerCarton: number;
  cartonsPerLoad: number;
  selectedPolicy: PackingPolicy;
  plannedUnits: number;
  referenceCadenceUnitsPerMinute: number;
  declarations: PersistedPackingDeclarationV1[];
}

interface PersistedPackingStateV1 {
  schemaVersion: typeof PACKING_RUN_STORAGE_SCHEMA_VERSION;
  activeRun: PersistedPackingRunV1 | null;
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
      if (typeof globalThis.crypto?.randomUUID !== 'function') {
        throw new Error('Secure run identity generation is unavailable.');
      }
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
  if (!isRecord(value)) {
    throw new Error('Invalid declaration record.');
  }

  return {
    id: value.id as string,
    createdAt: value.createdAt as string,
    completeCartons: value.completeCartons as number,
    partialCartonUnits: value.partialCartonUnits as number,
  };
}

function sanitizeRun(value: unknown): PackingRun {
  if (!isRecord(value) || !Array.isArray(value.declarations)) {
    throw new Error('Invalid packing run record.');
  }

  const requestedUnits = value.requestedUnits as number;
  const plannedUnits = value.plannedUnits as number;
  const run: PackingRun = {
    id: value.id as string,
    createdAt: value.createdAt as string,
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

function serializeRun(run: PackingRun): PersistedPackingRunV1 {
  validatePackingRun(run);

  return {
    id: run.id,
    createdAt: run.createdAt,
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

  if (stored === null) {
    return { status: 'empty', activeRun: null };
  }

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!isRecord(parsed) || parsed.schemaVersion !== PACKING_RUN_STORAGE_SCHEMA_VERSION) {
      return { status: 'corrupt', activeRun: null };
    }

    if (parsed.activeRun === null) {
      return { status: 'empty', activeRun: null };
    }

    return { status: 'loaded', activeRun: sanitizeRun(parsed.activeRun) };
  } catch {
    return { status: 'corrupt', activeRun: null };
  }
}

export function persistActivePackingRun(
  storage: PackingStorageLike,
  run: PackingRun | null,
): PackingRunWriteResult {
  try {
    const state: PersistedPackingStateV1 = {
      schemaVersion: PACKING_RUN_STORAGE_SCHEMA_VERSION,
      activeRun: run === null ? null : serializeRun(run),
    };
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
