import {
  getPackingRunProductionStartedAt,
  validatePackingRun,
  type PackingDeclaration,
  type PackingRun,
} from '../domain/packingRun';
import type { PackingPolicy } from '../../../utils/packing';

export const PACKING_ACTIVE_RUN_STORAGE_KEY = 'lineops.packing.active-run.v1';
export const PACKING_RUN_STORAGE_SCHEMA_VERSION = 3 as const;

export interface PersistedPackingDraft {
  runId: string;
  completeCartons: string;
  partialCartonUnits: string;
  editingDeclarationId: string | null;
  updatedAt: string;
}

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

interface PersistedPackingStateV3 {
  schemaVersion: typeof PACKING_RUN_STORAGE_SCHEMA_VERSION;
  revision: number;
  activeRun: PersistedPackingRunV2 | null;
  draft: PersistedPackingDraft | null;
}

export type PackingRunLoadResult =
  | { status: 'empty'; activeRun: null }
  | { status: 'loaded'; activeRun: PackingRun }
  | { status: 'corrupt'; activeRun: null }
  | { status: 'unavailable'; activeRun: null };

export type PackingRunWriteResult =
  | { status: 'persisted'; revision?: number }
  | { status: 'degraded' }
  | { status: 'conflict'; revision: number };

export type PackingWorkspaceLoadResult =
  | { status: 'empty'; activeRun: null; draft: null; revision: number }
  | { status: 'loaded'; activeRun: PackingRun; draft: PersistedPackingDraft | null; revision: number }
  | { status: 'corrupt' | 'unavailable'; activeRun: null; draft: null; revision: number };

export interface NewPackingRunInput {
  requestedUnits: number;
  unitsPerCarton: number;
  cartonsPerLoad: number;
  selectedPolicy: PackingPolicy;
  plannedUnits: number;
  referenceCadenceUnitsPerMinute: number;
  productionStartedAt?: string;
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
  const createdAt = identityFactory.nowIso();
  const run: PackingRun = {
    ...input,
    productionStartedAt: input.productionStartedAt ?? createdAt,
    id: identityFactory.createId(),
    createdAt,
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

function sanitizeDraft(value: unknown, run: PackingRun): PersistedPackingDraft | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) throw new Error('Invalid packing draft record.');
  const draft: PersistedPackingDraft = {
    runId: value.runId as string,
    completeCartons: value.completeCartons as string,
    partialCartonUnits: value.partialCartonUnits as string,
    editingDeclarationId: value.editingDeclarationId === null ? null : value.editingDeclarationId as string,
    updatedAt: value.updatedAt as string,
  };
  if (
    draft.runId !== run.id ||
    !/^\d*$/.test(draft.completeCartons) ||
    !/^\d*$/.test(draft.partialCartonUnits) ||
    !Number.isFinite(Date.parse(draft.updatedAt)) ||
    (draft.editingDeclarationId !== null && !run.declarations.some((entry) => entry.id === draft.editingDeclarationId))
  ) throw new Error('Invalid packing draft record.');
  return draft;
}

function serializeRun(run: PackingRun): PersistedPackingRunV2 {
  validatePackingRun(run);
  return {
    id: run.id,
    createdAt: run.createdAt,
    productionStartedAt: getPackingRunProductionStartedAt(run),
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

export function loadPackingWorkspace(storage: PackingStorageLike): PackingWorkspaceLoadResult {
  let stored: string | null;
  try {
    stored = storage.getItem(PACKING_ACTIVE_RUN_STORAGE_KEY);
  } catch {
    return { status: 'unavailable', activeRun: null, draft: null, revision: 0 };
  }
  if (stored === null) return { status: 'empty', activeRun: null, draft: null, revision: 0 };

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!isRecord(parsed)) return { status: 'corrupt', activeRun: null, draft: null, revision: 0 };
    if (parsed.activeRun === null && (parsed.schemaVersion === 1 || parsed.schemaVersion === 2 || parsed.schemaVersion === 3)) {
      if (parsed.schemaVersion === 3 && (!Number.isSafeInteger(parsed.revision) || (parsed.revision as number) < 0 || parsed.draft !== null)) {
        return { status: 'corrupt', activeRun: null, draft: null, revision: 0 };
      }
      return { status: 'empty', activeRun: null, draft: null, revision: parsed.schemaVersion === 3 ? parsed.revision as number : 0 };
    }
    if (parsed.schemaVersion !== 1 && parsed.schemaVersion !== 2 && parsed.schemaVersion !== PACKING_RUN_STORAGE_SCHEMA_VERSION) {
      return { status: 'corrupt', activeRun: null, draft: null, revision: 0 };
    }
    const activeRun = sanitizeRun(parsed.activeRun, parsed.schemaVersion as number);
    const revision = parsed.schemaVersion === 3 && Number.isSafeInteger(parsed.revision) && (parsed.revision as number) >= 0
      ? parsed.revision as number
      : 0;
    const draft = parsed.schemaVersion === 3 ? sanitizeDraft(parsed.draft, activeRun) : null;
    return { status: 'loaded', activeRun, draft, revision };
  } catch {
    return { status: 'corrupt', activeRun: null, draft: null, revision: 0 };
  }
}

export function loadActivePackingRun(storage: PackingStorageLike): PackingRunLoadResult {
  const result = loadPackingWorkspace(storage);
  if (result.status === 'loaded') return { status: 'loaded', activeRun: result.activeRun };
  return { status: result.status, activeRun: null };
}

export function persistPackingWorkspace(
  storage: PackingStorageLike,
  activeRun: PackingRun | null,
  draft: PersistedPackingDraft | null,
  expectedRevision?: number,
): PackingRunWriteResult {
  const current = loadPackingWorkspace(storage);
  if (current.status === 'unavailable') return { status: 'degraded' };
  if (current.status === 'corrupt') return { status: 'degraded' };
  if (expectedRevision !== undefined && current.revision !== expectedRevision) {
    return { status: 'conflict', revision: current.revision };
  }
  if (draft && (!activeRun || draft.runId !== activeRun.id)) return { status: 'degraded' };
  const revision = current.revision + 1;
  const state: PersistedPackingStateV3 = {
    schemaVersion: PACKING_RUN_STORAGE_SCHEMA_VERSION,
    revision,
    activeRun: activeRun === null ? null : serializeRun(activeRun),
    draft,
  };
  try {
    storage.setItem(PACKING_ACTIVE_RUN_STORAGE_KEY, JSON.stringify(state));
    return { status: 'persisted', revision };
  } catch {
    return { status: 'degraded' };
  }
}

export function persistActivePackingRun(storage: PackingStorageLike, run: PackingRun | null): PackingRunWriteResult {
  const result = persistPackingWorkspace(storage, run, null);
  return result.status === 'persisted' ? { status: 'persisted' } : result;
}

export function clearActivePackingRun(storage: PackingStorageLike): PackingRunWriteResult {
  try {
    storage.removeItem(PACKING_ACTIVE_RUN_STORAGE_KEY);
    return { status: 'persisted' };
  } catch {
    return { status: 'degraded' };
  }
}
