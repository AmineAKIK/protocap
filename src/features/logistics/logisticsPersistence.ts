import type { LogisticsRequest } from '../../types/logistics';
import { isValidPublicStorageValue } from '../../utils/publicStorageValidation';

export const LOGISTICS_WORKSPACE_VERSION = 9;
export const LOGISTICS_WORKSPACE_KEY = 'lineops.logistics.requests.v9';
export const LOGISTICS_WORKSPACE_PREFIX = 'lineops.logistics.requests.v';
export const LOGISTICS_LEGACY_KEY = 'lineops.logistics.requests.v8';

export interface LogisticsWorkspaceV9 {
  schemaVersion: 9;
  revision: number;
  requests: LogisticsRequest[];
}

export type LogisticsLoadStatus = 'ready' | 'memory' | 'migration-pending' | 'recovery' | 'readonly' | 'degraded' | 'write-failed';

export interface LoadedLogisticsWorkspace {
  workspace: LogisticsWorkspaceV9;
  status: LogisticsLoadStatus;
  futureVersion?: number;
}

export type LogisticsPersistenceFailure =
  | 'access'
  | 'quota'
  | 'write'
  | 'serialize'
  | 'schema'
  | 'verify'
  | 'future-version'
  | 'conflict'
  | 'recovery'
  | 'concurrency-unavailable';

export type LogisticsPersistenceResult =
  | { status: 'persisted'; workspace: LogisticsWorkspaceV9; idempotent: boolean }
  | { status: 'degraded'; reason: LogisticsPersistenceFailure; errorName?: string; futureVersion?: number };

function errorName(error: unknown): string | undefined {
  return error instanceof Error || (typeof DOMException !== 'undefined' && error instanceof DOMException)
    ? error.name
    : undefined;
}

function classifyWriteError(error: unknown): 'quota' | 'access' | 'write' {
  const name = errorName(error);
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') return 'quota';
  if (name === 'SecurityError' || name === 'InvalidStateError') return 'access';
  return 'write';
}

function storage(): Storage {
  if (typeof window === 'undefined') throw new Error('Browser storage unavailable.');
  return window.localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isLogisticsWorkspace(value: unknown): value is LogisticsWorkspaceV9 {
  return isRecord(value)
    && value.schemaVersion === 9
    && Number.isSafeInteger(value.revision)
    && (value.revision as number) >= 0
    && isValidPublicStorageValue('lineops.logistics.requests', value.requests);
}

function futureVersion(store: Storage): number | null {
  let newest = LOGISTICS_WORKSPACE_VERSION;
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index);
    if (!key?.startsWith(LOGISTICS_WORKSPACE_PREFIX)) continue;
    const suffix = key.slice(LOGISTICS_WORKSPACE_PREFIX.length);
    if (!/^\d+$/.test(suffix)) continue;
    const version = Number(suffix);
    if (Number.isSafeInteger(version) && version > newest) newest = version;
  }
  return newest > LOGISTICS_WORKSPACE_VERSION ? newest : null;
}

function workspace(requests: LogisticsRequest[], revision = 0): LogisticsWorkspaceV9 {
  return { schemaVersion: 9, revision, requests };
}

export function loadLogisticsWorkspace(initial: LogisticsRequest[]): LoadedLogisticsWorkspace {
  let store: Storage;
  try {
    store = storage();
  } catch {
    return { workspace: workspace([]), status: 'degraded' };
  }

  let future: number | null;
  try {
    future = futureVersion(store);
  } catch {
    return { workspace: workspace([]), status: 'degraded' };
  }

  let currentRaw: string | null;
  try {
    currentRaw = store.getItem(LOGISTICS_WORKSPACE_KEY);
  } catch {
    return { workspace: workspace([]), status: 'degraded' };
  }

  if (currentRaw !== null) {
    try {
      const parsed: unknown = JSON.parse(currentRaw);
      if (isLogisticsWorkspace(parsed)) {
        return future
          ? { workspace: parsed, status: 'readonly', futureVersion: future }
          : { workspace: parsed, status: 'ready' };
      }
    } catch {
      // Preserve corrupt bytes and fail closed.
    }
    return { workspace: workspace([]), status: future ? 'readonly' : 'recovery', futureVersion: future ?? undefined };
  }

  let legacyRaw: string | null;
  try {
    legacyRaw = store.getItem(LOGISTICS_LEGACY_KEY);
  } catch {
    return { workspace: workspace([]), status: 'degraded' };
  }

  if (legacyRaw === null) {
    return future
      ? { workspace: workspace(initial), status: 'readonly', futureVersion: future }
      : { workspace: workspace(initial), status: 'memory' };
  }

  try {
    const parsed: unknown = JSON.parse(legacyRaw);
    if (!isValidPublicStorageValue('lineops.logistics.requests', parsed)) {
      return { workspace: workspace([]), status: future ? 'readonly' : 'recovery', futureVersion: future ?? undefined };
    }
    const migrated = workspace(parsed as LogisticsRequest[]);
    return future
      ? { workspace: migrated, status: 'readonly', futureVersion: future }
      : { workspace: migrated, status: 'migration-pending' };
  } catch {
    return { workspace: workspace([]), status: future ? 'readonly' : 'recovery', futureVersion: future ?? undefined };
  }
}

export function persistLogisticsWorkspace(
  expectedRevision: number,
  requests: LogisticsRequest[],
): LogisticsPersistenceResult {
  if (!isValidPublicStorageValue('lineops.logistics.requests', requests)) {
    return { status: 'degraded', reason: 'schema' };
  }

  let store: Storage;
  try {
    store = storage();
    const future = futureVersion(store);
    if (future) return { status: 'degraded', reason: 'future-version', futureVersion: future };
  } catch (error) {
    return { status: 'degraded', reason: 'access', errorName: errorName(error) };
  }

  let current: LogisticsWorkspaceV9 | null = null;
  try {
    const raw = store.getItem(LOGISTICS_WORKSPACE_KEY);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (!isLogisticsWorkspace(parsed)) return { status: 'degraded', reason: 'recovery' };
      current = parsed;
    }
  } catch (error) {
    return { status: 'degraded', reason: 'access', errorName: errorName(error) };
  }

  const currentRevision = current?.revision ?? 0;
  if (currentRevision !== expectedRevision) return { status: 'degraded', reason: 'conflict' };

  const next = workspace(requests, currentRevision + 1);
  let serialized: string;
  try {
    serialized = JSON.stringify(next);
  } catch (error) {
    return { status: 'degraded', reason: 'serialize', errorName: errorName(error) };
  }

  try {
    store.setItem(LOGISTICS_WORKSPACE_KEY, serialized);
  } catch (error) {
    return { status: 'degraded', reason: classifyWriteError(error), errorName: errorName(error) };
  }
  try {
    if (store.getItem(LOGISTICS_WORKSPACE_KEY) !== serialized) return { status: 'degraded', reason: 'verify' };
  } catch (error) {
    return { status: 'degraded', reason: 'verify', errorName: errorName(error) };
  }
  return { status: 'persisted', workspace: next, idempotent: false };
}
