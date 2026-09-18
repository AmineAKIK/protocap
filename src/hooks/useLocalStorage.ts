import { useCallback, useReducer, useRef, type SetStateAction } from 'react';
import {
  inspectPublicStorageCompatibility,
  readPublicStorageValue,
  versionedPublicStorageKey,
  writePublicStorageValue,
  type PublicStorageWriteResult,
} from '../persistence/publicLocalStorage';

export type LocalStoragePersistenceStatus = 'memory' | 'persisted' | 'recovered' | 'degraded' | 'readonly';

interface LocalStorageSnapshot<T> {
  logicalKey: string;
  versionedKey: string;
  value: T;
  persistenceStatus: LocalStoragePersistenceStatus;
}

function loadSnapshot<T>(
  logicalKey: string,
  initialValue: T,
  normalize?: (value: T) => T,
): LocalStorageSnapshot<T> {
  const compatibility = inspectPublicStorageCompatibility(logicalKey);
  const read = readPublicStorageValue(logicalKey, normalize);
  let value = initialValue;
  let persistenceStatus: LocalStoragePersistenceStatus = 'memory';

  if (read.status === 'loaded') {
    value = read.value;
    persistenceStatus = read.normalized ? 'recovered' : 'persisted';
  } else if (read.status === 'invalid') {
    // Safe fallback in memory only. The original bytes remain untouched for migration/recovery.
    persistenceStatus = 'recovered';
  } else if (read.status === 'degraded') {
    persistenceStatus = 'degraded';
  }

  if (compatibility.status === 'degraded') persistenceStatus = 'degraded';
  if (compatibility.status === 'future-version') persistenceStatus = 'readonly';

  return {
    logicalKey,
    versionedKey: versionedPublicStorageKey(logicalKey),
    value,
    persistenceStatus,
  };
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  normalize?: (value: T) => T,
) {
  const [, rerender] = useReducer((value: number) => value + 1, 0);
  const snapshotRef = useRef<LocalStorageSnapshot<T> | null>(null);

  if (!snapshotRef.current || snapshotRef.current.logicalKey !== key) {
    snapshotRef.current = loadSnapshot(key, initialValue, normalize);
  }

  const setValue = useCallback((action: SetStateAction<T>): PublicStorageWriteResult => {
    const current = snapshotRef.current;
    if (!current || current.logicalKey !== key) {
      throw new Error('Local storage hook key changed before the write could be prepared.');
    }
    const nextValue = typeof action === 'function'
      ? (action as (previous: T) => T)(current.value)
      : action;
    const result = writePublicStorageValue(key, nextValue);

    snapshotRef.current = {
      logicalKey: key,
      versionedKey: current.versionedKey,
      value: nextValue,
      persistenceStatus: result.status === 'persisted'
        ? 'persisted'
        : result.reason === 'future-version'
          ? 'readonly'
          : 'degraded',
    };
    rerender();
    return result;
  }, [key]);

  const snapshot = snapshotRef.current;
  return [snapshot.value, setValue, snapshot.persistenceStatus] as const;
}
