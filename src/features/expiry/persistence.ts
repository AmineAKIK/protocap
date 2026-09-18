import type { ChangeHistoryEntry, ConditioningLine } from '../../types/expiry';
import { isValidPublicStorageValue } from '../../utils/publicStorageValidation';

export const EXPIRY_AGGREGATE_VERSION = 1;
export const EXPIRY_AGGREGATE_KEY = 'lineops.expiry.aggregate.v1';
export const EXPIRY_AGGREGATE_PREFIX = 'lineops.expiry.aggregate.v';
export const EXPIRY_LEGACY_LINES_KEY = 'lineops.expiry.lines.v8';
export const EXPIRY_LEGACY_HISTORY_KEY = 'lineops.expiry.history.v8';

export interface ExpiryAggregateV1 {
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
  | 'storage-conflict';

export interface LoadedExpiryWorkspace {
  aggregate: ExpiryAggregateV1;
  status: ExpiryWorkspaceStatus;
  persistedRaw: string | null;
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
  | 'recovery-required';

export type ExpiryWriteResult =
  | { status: 'persisted'; key: string; raw: string; idempotent: boolean }
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

export function isExpiryAggregate(value: unknown): value is ExpiryAggregateV1 {
  return isRecord(value)
    && value.schemaVersion === EXPIRY_AGGREGATE_VERSION
    && isValidPublicStorageValue('lineops.expiry.lines', value.lines)
    && isValidPublicStorageValue('lineops.expiry.history', value.history);
}

export function serializeExpiryAggregate(value: ExpiryAggregateV1): string {
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

function legacyFallback(
  initialLines: ConditioningLine[],
  initialHistory: ChangeHistoryEntry[],
  allowInitialWhenEmpty: boolean,
): LoadedExpiryWorkspace {
  const lines = readLegacyValue<ConditioningLine[]>(EXPIRY_LEGACY_LINES_KEY, 'lineops.expiry.lines');
  const history = readLegacyValue<ChangeHistoryEntry[]>(EXPIRY_LEGACY_HISTORY_KEY, 'lineops.expiry.history');

  if (lines.status === 'degraded' || history.status === 'degraded') {
    return {
      aggregate: {
        schemaVersion: 1,
        lines: lines.status === 'loaded' ? lines.value : [],
        history: history.status === 'loaded' ? history.value : [],
      },
      status: 'degraded',
      persistedRaw: null,
      issues: ['storage-unavailable'],
    };
  }

  if (lines.status === 'missing' && history.status === 'missing' && allowInitialWhenEmpty) {
    return {
      aggregate: { schemaVersion: 1, lines: initialLines, history: initialHistory },
      status: 'memory',
      persistedRaw: null,
      issues: [],
    };
  }

  if (lines.status === 'loaded' && history.status === 'loaded') {
    return {
      aggregate: { schemaVersion: 1, lines: lines.value, history: history.value },
      status: 'migration-pending',
      persistedRaw: null,
      issues: [],
    };
  }

  const issues: ExpiryStorageIssue[] = [];
  if (lines.status === 'missing') issues.push('legacy-lines-missing');
  if (history.status === 'missing') issues.push('legacy-history-missing');
  if (lines.status === 'invalid') issues.push('legacy-lines-invalid');
  if (history.status === 'invalid') issues.push('legacy-history-invalid');
  return {
    aggregate: {
      schemaVersion: 1,
      lines: lines.status === 'loaded' ? lines.value : [],
      history: history.status === 'loaded' ? history.value : [],
    },
    status: 'recovery-required',
    persistedRaw: null,
    issues,
  };
}

export function loadExpiryWorkspace(
  initialLines: ConditioningLine[],
  initialHistory: ChangeHistoryEntry[],
): LoadedExpiryWorkspace {
  const compatibility = inspectFutureAggregateVersion();
  if (compatibility.status === 'degraded') {
    return {
      aggregate: { schemaVersion: 1, lines: [], history: [] },
      status: 'degraded',
      persistedRaw: null,
      issues: ['storage-unavailable'],
    };
  }

  let raw: string | null;
  try {
    raw = getStorage().getItem(EXPIRY_AGGREGATE_KEY);
  } catch {
    return {
      aggregate: { schemaVersion: 1, lines: [], history: [] },
      status: 'degraded',
      persistedRaw: null,
      issues: ['storage-unavailable'],
    };
  }

  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isExpiryAggregate(parsed)) {
        return {
          aggregate: parsed,
          status: compatibility.status === 'future-version' ? 'readonly' : 'ready',
          persistedRaw: raw,
          issues: compatibility.status === 'future-version' ? ['future-version'] : [],
        };
      }
    } catch {
      // Preserve the invalid aggregate and fall back to readable legacy evidence below.
    }
    const fallback = legacyFallback(initialLines, initialHistory, false);
    return {
      ...fallback,
      status: compatibility.status === 'future-version' ? 'readonly' : 'recovery-required',
      persistedRaw: raw,
      issues: [
        'aggregate-invalid',
        ...(compatibility.status === 'future-version' ? ['future-version' as const] : []),
        ...fallback.issues,
      ],
    };
  }

  const fallback = legacyFallback(initialLines, initialHistory, true);
  if (compatibility.status === 'future-version') {
    return { ...fallback, status: 'readonly', issues: ['future-version', ...fallback.issues] };
  }
  return fallback;
}

export function persistExpiryTransition(
  expectedRaw: string | null,
  base: ExpiryAggregateV1,
  next: ExpiryAggregateV1,
): ExpiryWriteResult {
  const compatibility = inspectFutureAggregateVersion();
  if (compatibility.status === 'degraded') {
    return { status: 'degraded', key: EXPIRY_AGGREGATE_KEY, reason: 'access', errorName: compatibility.errorName };
  }
  if (compatibility.status === 'future-version') {
    return {
      status: 'degraded',
      key: EXPIRY_AGGREGATE_KEY,
      reason: 'future-version',
      futureVersion: compatibility.version,
    };
  }
  if (!isExpiryAggregate(next)) {
    return { status: 'degraded', key: EXPIRY_AGGREGATE_KEY, reason: 'schema' };
  }

  let serialized: string;
  let baseSerialized: string;
  try {
    serialized = serializeExpiryAggregate(next);
    baseSerialized = serializeExpiryAggregate(base);
  } catch (error) {
    return { status: 'degraded', key: EXPIRY_AGGREGATE_KEY, reason: 'serialize', errorName: errorName(error) };
  }

  let storage: Storage;
  let currentRaw: string | null;
  try {
    storage = getStorage();
    currentRaw = storage.getItem(EXPIRY_AGGREGATE_KEY);
  } catch (error) {
    return { status: 'degraded', key: EXPIRY_AGGREGATE_KEY, reason: 'access', errorName: errorName(error) };
  }

  if (currentRaw === serialized) {
    return { status: 'persisted', key: EXPIRY_AGGREGATE_KEY, raw: serialized, idempotent: true };
  }
  if (currentRaw !== expectedRaw && currentRaw !== baseSerialized) {
    return { status: 'degraded', key: EXPIRY_AGGREGATE_KEY, reason: 'conflict' };
  }

  try {
    storage.setItem(EXPIRY_AGGREGATE_KEY, serialized);
  } catch (error) {
    return {
      status: 'degraded',
      key: EXPIRY_AGGREGATE_KEY,
      reason: classifyWriteError(error),
      errorName: errorName(error),
    };
  }

  try {
    if (storage.getItem(EXPIRY_AGGREGATE_KEY) !== serialized) {
      return { status: 'degraded', key: EXPIRY_AGGREGATE_KEY, reason: 'verify' };
    }
  } catch (error) {
    return { status: 'degraded', key: EXPIRY_AGGREGATE_KEY, reason: 'verify', errorName: errorName(error) };
  }
  return { status: 'persisted', key: EXPIRY_AGGREGATE_KEY, raw: serialized, idempotent: false };
}
