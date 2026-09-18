import { isValidPublicStorageValue } from '../utils/publicStorageValidation';

export const PUBLIC_STORAGE_VERSION = 8;

export type PublicStorageFailureReason =
  | 'access'
  | 'parse'
  | 'schema'
  | 'normalize'
  | 'serialize'
  | 'quota'
  | 'write'
  | 'verify'
  | 'future-version';

export type PublicStorageReadResult<T> =
  | { status: 'missing'; key: string }
  | { status: 'loaded'; key: string; value: T; normalized: boolean }
  | { status: 'invalid'; key: string; reason: 'parse' | 'schema' | 'normalize'; raw: string; errorName?: string }
  | { status: 'degraded'; key: string; reason: 'access'; errorName?: string };

export type PublicStorageWriteResult =
  | { status: 'persisted'; key: string }
  | { status: 'degraded'; key: string; reason: Exclude<PublicStorageFailureReason, 'parse' | 'normalize'>; errorName?: string; futureVersion?: number };

export type PublicStorageCompatibilityResult =
  | { status: 'compatible' }
  | { status: 'future-version'; key: string; version: number }
  | { status: 'degraded'; reason: 'access'; errorName?: string };

export function versionedPublicStorageKey(logicalKey: string): string {
  return `${logicalKey}.v${PUBLIC_STORAGE_VERSION}`;
}

function errorName(error: unknown): string | undefined {
  return error instanceof Error || (typeof DOMException !== 'undefined' && error instanceof DOMException)
    ? error.name
    : undefined;
}

function getStorage(): Storage {
  if (typeof window === 'undefined') throw new Error('Browser storage is unavailable.');
  return window.localStorage;
}

function classifyWriteError(error: unknown): 'quota' | 'access' | 'write' {
  const name = errorName(error);
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') return 'quota';
  if (name === 'SecurityError' || name === 'InvalidStateError') return 'access';
  return 'write';
}

export function inspectPublicStorageCompatibility(logicalKey: string): PublicStorageCompatibilityResult {
  try {
    const storage = getStorage();
    const prefix = `${logicalKey}.v`;
    let newestVersion = PUBLIC_STORAGE_VERSION;
    let newestKey = '';
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const suffix = key.slice(prefix.length);
      if (!/^\d+$/.test(suffix)) continue;
      const version = Number(suffix);
      if (Number.isFinite(version) && version > newestVersion) {
        newestVersion = version;
        newestKey = key;
      }
    }
    return newestKey
      ? { status: 'future-version', key: newestKey, version: newestVersion }
      : { status: 'compatible' };
  } catch (error) {
    return { status: 'degraded', reason: 'access', errorName: errorName(error) };
  }
}

export function readPublicStorageValue<T>(
  logicalKey: string,
  normalize?: (value: T) => T,
): PublicStorageReadResult<T> {
  const key = versionedPublicStorageKey(logicalKey);
  let raw: string | null;
  try {
    raw = getStorage().getItem(key);
  } catch (error) {
    return { status: 'degraded', key, reason: 'access', errorName: errorName(error) };
  }
  if (raw === null) return { status: 'missing', key };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { status: 'invalid', key, reason: 'parse', raw, errorName: errorName(error) };
  }
  if (!isValidPublicStorageValue(logicalKey, parsed)) {
    return { status: 'invalid', key, reason: 'schema', raw };
  }

  const validated = parsed as T;
  if (!normalize) return { status: 'loaded', key, value: validated, normalized: false };

  try {
    const value = normalize(validated);
    if (!isValidPublicStorageValue(logicalKey, value)) {
      return { status: 'invalid', key, reason: 'normalize', raw };
    }
    const normalized = JSON.stringify(value) !== JSON.stringify(parsed);
    return { status: 'loaded', key, value, normalized };
  } catch (error) {
    return { status: 'invalid', key, reason: 'normalize', raw, errorName: errorName(error) };
  }
}

export function writePublicStorageValue<T>(logicalKey: string, value: T): PublicStorageWriteResult {
  const key = versionedPublicStorageKey(logicalKey);
  const compatibility = inspectPublicStorageCompatibility(logicalKey);
  if (compatibility.status === 'degraded') {
    return { status: 'degraded', key, reason: 'access', errorName: compatibility.errorName };
  }
  if (compatibility.status === 'future-version') {
    return { status: 'degraded', key, reason: 'future-version', futureVersion: compatibility.version };
  }
  if (!isValidPublicStorageValue(logicalKey, value)) {
    return { status: 'degraded', key, reason: 'schema' };
  }

  let serialized: string;
  try {
    const candidate = JSON.stringify(value);
    if (typeof candidate !== 'string') return { status: 'degraded', key, reason: 'serialize' };
    serialized = candidate;
  } catch (error) {
    return { status: 'degraded', key, reason: 'serialize', errorName: errorName(error) };
  }

  let storage: Storage;
  try {
    storage = getStorage();
    storage.setItem(key, serialized);
  } catch (error) {
    return { status: 'degraded', key, reason: classifyWriteError(error), errorName: errorName(error) };
  }

  try {
    if (storage.getItem(key) !== serialized) {
      return { status: 'degraded', key, reason: 'verify' };
    }
  } catch (error) {
    return { status: 'degraded', key, reason: 'verify', errorName: errorName(error) };
  }
  return { status: 'persisted', key };
}
