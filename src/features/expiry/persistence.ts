import type { ChangeHistoryEntry, ConditioningLine } from '../../types/expiry';
import { isValidPublicStorageValue } from '../../utils/publicStorageValidation';

export const EXPIRY_AGGREGATE_VERSION = 2;
export const EXPIRY_AGGREGATE_KEY = 'lineops.expiry.aggregate.v2';
export const EXPIRY_PREVIOUS_AGGREGATE_KEY = 'lineops.expiry.aggregate.v1';
export const EXPIRY_AGGREGATE_PREFIX = 'lineops.expiry.aggregate.v';
export const EXPIRY_LEGACY_LINES_KEY = 'lineops.expiry.lines.v8';
export const EXPIRY_LEGACY_HISTORY_KEY = 'lineops.expiry.history.v8';

export interface ExpiryAggregateV2 {
  schemaVersion: 2;
  revision: number;
  lines: ConditioningLine[];
  history: ChangeHistoryEntry[];
}

interface ExpiryAggregateV1 {
  schemaVersion: 1;
  lines: ConditioningLine[];
  history: ChangeHistoryEntry[];
}

export type ExpiryWorkspaceStatus =
  | 'ready'
  | 'memory'
  | 'migration-pending'
  | 'degraded'
  | 'recovery-required'
  | 'readonly';

export type ExpiryStorageIssue =
  | 'storage-unavailable'
  | 'aggregate-invalid'
  | 'legacy-lines-missing'
  | 'legacy-history-missing'
  | 'legacy-lines-invalid'
  | 'legacy-history-invalid'
  | 'future-version'
  | 'migration-write-failed'
  | 'storage-conflict'
  | 'concurrency-unavailable';

export interface LoadedExpiryWorkspace {
  aggregate: ExpiryAggregateV2;
  status: ExpiryWorkspaceStatus;
  issues: ExpiryStorageIssue[];
}

export type ExpiryWriteFailureReason =
  | 'access'
  | 'quota'
  | 'write'
  | 'serialize'
  | 'schema'
  | 'verify'
  | 'future-version'
  | 'conflict'
  | 'identity-conflict'
  | 'recovery-required'
  | 'concurrency-unavailable';

export type ExpiryWriteResult =
  | { status: 'persisted'; key: string; aggregate: ExpiryAggregateV2; idempotent: boolean }
  | { status: 'degraded'; key: string; reason: ExpiryWriteFailureReason; errorName?: string; futureVersion?: number };

type LegacyReadResult<T> =
  | { status: 'loaded'; value: T }
  | { status: 'missing' }
  | { status: 'invalid' }
  | { status: 'degraded'; errorName?: string };

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

function getStorage(): Storage {
  if (typeof window === 'undefined') throw new Error('Browser storage is unavailable.');
  return window.localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validPayload(value: Record<string, unknown>): boolean {
  return isValidPublicStorageValue('lineops.expiry.lines', value.lines)
    && isValidPublicStorageValue('lineops.expiry.history', value.history);
}

export function isExpiryAggregate(value: unknown): value is ExpiryAggregateV2 {
  return isRecord(value)
    && value.schemaVersion === EXPIRY_AGGREGATE_VERSION
    && Number.isSafeInteger(value.revision)
    && (value.revision as number) >= 0
    && validPayload(value);
}

function isPreviousExpiryAggregate(value: unknown): value is ExpiryAggregateV1 {
  return isRecord(value) && value.schemaVersion === 1 && validPayload(value);
}

export function serializeExpiryAggregate(value: ExpiryAggregateV2): string {
  return JSON.stringify(value);
}

function readLegacyValue<T>(key: string, logicalKey: string): LegacyReadResult<T> {
  let raw: string | null;
  try {
    raw = getStorage().getItem(key);
  } catch (error) {
    return { status: 'degraded', errorName: errorName(error) };
  }
  if (raw === null) return { status: 'missing' };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isValidPublicStorageValue(logicalKey, parsed)) return { status: 'invalid' };
    return { status: 'loaded', value: parsed as T };
  } catch {
    return { status: 'invalid' };
  }
}

function inspectFutureAggregateVersion():
  | { status: 'compatible' }
  | { status: 'future-version'; version: number }
  | { status: 'degraded'; errorName?: string } {
  try {
    const storage = getStorage();
    let newest = EXPIRY_AGGREGATE_VERSION;
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith(EXPIRY_AGGREGATE_PREFIX)) continue;
      const suffix = key.slice(EXPIRY_AGGREGATE_PREFIX.length);
      if (!/^\d+$/.test(suffix)) continue;
      const version = Number(suffix);
      if (Number.isSafeInteger(version) && version > newest) newest = version;
    }
    return newest > EXPIRY_AGGREGATE_VERSION
      ? { status: 'future-version', version: newest }
      : { status: 'compatible' };
  } catch (error) {
    return { status: 'degraded', errorName: errorName(error) };
  }
}

function asV2(lines: ConditioningLine[], history: ChangeHistoryEntry[], revision = 0): ExpiryAggregateV2 {
  return { schemaVersion: 2, revision, lines, history };
}

function legacyFallback(
  initialLines: ConditioningLine[],
  initialHistory: ChangeHistoryEntry[],
  allowInitialWhenEmpty: boolean,
): LoadedExpiryWorkspace {
  const lines = readLegacyValue<ConditioningLine[]>(EXPIRY_LEGACY_LINES_KEY, 'lineops.expiry.lines');
  const history = readLegacyValue<ChangeHistoryEntry[]>(EXPIRY_LEGACY_HISTORY_KEY, 'lineops.expiry.history');

  if (lines.status === 'degraded' || history.status === 'degraded') {
    return {
      aggregate: asV2(lines.status === 'loaded' ? lines.value : [], history.status === 'loaded' ? history.value : []),
      status: 'degraded',
      issues: ['storage-unavailable'],
    };
  }
  if (lines.status === 'missing' && history.status === 'missing' && allowInitialWhenEmpty) {
    return { aggregate: asV2(initialLines, initialHistory), status: 'memory', issues: [] };
  }
  if (lines.status === 'loaded' && history.status === 'loaded') {
    return { aggregate: asV2(lines.value, history.value), status: 'migration-pending', issues: [] };
  }
  const issues: ExpiryStorageIssue[] = [];
  if (lines.status === 'missing') issues.push('legacy-lines-missing');
  if (history.status === 'missing') issues.push('legacy-history-missing');
  if (lines.status === 'invalid') issues.push('legacy-lines-invalid');
  if (history.status === 'invalid') issues.push('legacy-history-invalid');
  return {
    aggregate: asV2(lines.status === 'loaded' ? lines.value : [], history.status === 'loaded' ? history.value : []),
    status: 'recovery-required',
    issues,
  };
}

export function loadExpiryWorkspace(
  initialLines: ConditioningLine[],
  initialHistory: ChangeHistoryEntry[],
): LoadedExpiryWorkspace {
  const compatibility = inspectFutureAggregateVersion();
  if (compatibility.status === 'degraded') {
    return { aggregate: asV2([], []), status: 'degraded', issues: ['storage-unavailable'] };
  }

  let storage: Storage;
  try {
    storage = getStorage();
  } catch {
    return { aggregate: asV2([], []), status: 'degraded', issues: ['storage-unavailable'] };
  }

  const raw = storage.getItem(EXPIRY_AGGREGATE_KEY);
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isExpiryAggregate(parsed)) {
        return {
          aggregate: parsed,
          status: compatibility.status === 'future-version' ? 'readonly' : 'ready',
          issues: compatibility.status === 'future-version' ? ['future-version'] : [],
        };
      }
    } catch {
      // Preserve invalid bytes and fall through to older readable evidence.
    }
    const fallback = legacyFallback(initialLines, initialHistory, false);
    return {
      ...fallback,
      status: compatibility.status === 'future-version' ? 'readonly' : 'recovery-required',
      issues: ['aggregate-invalid', ...(compatibility.status === 'future-version' ? ['future-version' as const] : []), ...fallback.issues],
    };
  }

  const previousRaw = storage.getItem(EXPIRY_PREVIOUS_AGGREGATE_KEY);
  if (previousRaw !== null) {
    try {
      const parsed: unknown = JSON.parse(previousRaw);
      if (isPreviousExpiryAggregate(parsed)) {
        return {
          aggregate: asV2(parsed.lines, parsed.history),
          status: compatibility.status === 'future-version' ? 'readonly' : 'migration-pending',
          issues: compatibility.status === 'future-version' ? ['future-version'] : [],
        };
      }
    } catch {
      // Preserve invalid v1 and require recovery.
    }
    return {
      aggregate: asV2([], []),
      status: compatibility.status === 'future-version' ? 'readonly' : 'recovery-required',
      issues: ['aggregate-invalid', ...(compatibility.status === 'future-version' ? ['future-version' as const] : [])],
    };
  }

  const fallback = legacyFallback(initialLines, initialHistory, true);
  return compatibility.status === 'future-version'
    ? { ...fallback, status: 'readonly', issues: ['future-version', ...fallback.issues] }
    : fallback;
}

export function persistExpiryTransition(
  expectedRevision: number,
  next: Omit<ExpiryAggregateV2, 'revision'> & { revision?: number },
): ExpiryWriteResult {
  const compatibility = inspectFutureAggregateVersion();
  if (compatibility.status === 'degraded') {
    return { status: 'degraded', key: EXPIRY_AGGREGATE_KEY, reason: 'access', errorName: compatibility.errorName };
  }
  if (compatibility.status === 'future-version') {
    return { status: 'degraded', key: EXPIRY_AGGREGATE_KEY, reason: 'future-version', futureVersion: compatibility.version };
  }

  let storage: Storage;
  let currentRaw: string | null;
  try {
    storage = getStorage();
    currentRaw = storage.getItem(EXPIRY_AGGREGATE_KEY);
  } catch (error) {
    return { status: 'degraded', key: EXPIRY_AGGREGATE_KEY, reason: 'access', errorName: errorName(error) };
  }

  let current: ExpiryAggregateV2 | null = null;
  if (currentRaw !== null) {
    try {
      const parsed: unknown = JSON.parse(currentRaw);
      if (!isExpiryAggregate(parsed)) return { status: 'degraded', key: EXPIRY_AGGREGATE_KEY, reason: 'recovery-required' };
      current = parsed;
    } catch {
      return { status: 'degraded', key: EXPIRY_AGGREGATE_KEY, reason: 'recovery-required' };
    }
  }
  const currentRevision = current?.revision ?? 0;
  if (currentRevision !== expectedRevision) {
    return { status: 'degraded', key: EXPIRY_AGGREGATE_KEY, reason: 'conflict' };
  }

  const persisted: ExpiryAggregateV2 = {
    schemaVersion: 2,
    revision: currentRevision + 1,
    lines: next.lines,
    history: next.history,
  };
  if (!isExpiryAggregate(persisted)) {
    return { status: 'degraded', key: EXPIRY_AGGREGATE_KEY, reason: 'schema' };
  }

  let serialized: string;
  try {
    serialized = serializeExpiryAggregate(persisted);
  } catch (error) {
    return { status: 'degraded', key: EXPIRY_AGGREGATE_KEY, reason: 'serialize', errorName: errorName(error) };
  }

  try {
    storage.setItem(EXPIRY_AGGREGATE_KEY, serialized);
  } catch (error) {
    return { status: 'degraded', key: EXPIRY_AGGREGATE_KEY, reason: classifyWriteError(error), errorName: errorName(error) };
  }
  try {
    if (storage.getItem(EXPIRY_AGGREGATE_KEY) !== serialized) {
      return { status: 'degraded', key: EXPIRY_AGGREGATE_KEY, reason: 'verify' };
    }
  } catch (error) {
    return { status: 'degraded', key: EXPIRY_AGGREGATE_KEY, reason: 'verify', errorName: errorName(error) };
  }
  return { status: 'persisted', key: EXPIRY_AGGREGATE_KEY, aggregate: persisted, idempotent: false };
}
