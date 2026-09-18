import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import {
  inspectPublicStorageCompatibility,
  readPublicStorageValue,
  versionedPublicStorageKey,
  writePublicStorageValue,
  type PublicStorageWriteResult,
} from '../persistence/publicLocalStorage';

export type LocalStoragePersistenceStatus = 'memory' | 'persisted' | 'normalized' | 'recovered' | 'degraded' | 'readonly';

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
    persistenceStatus = read.normalized ? 'normalized' : 'persisted';
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
  const [snapshot, setSnapshot] = useState<LocalStorageSnapshot<T>>(() =>
    loadSnapshot(key, initialValue, normalize),
  );
  const valueRef = useRef(snapshot.value);
  const keyRef = useRef(key);

  useEffect(() => {
    if (keyRef.current === key) return;
    const next = loadSnapshot(key, initialValue, normalize);
    keyRef.current = key;
    valueRef.current = next.value;
    setSnapshot(next);
  }, [initialValue, key, normalize]);

  const setValue = useCallback((action: SetStateAction<T>): PublicStorageWriteResult => {
    // A consumer can call its setter before the key-change effect has committed.
    // Rebase on the requested key first so an old-key value can never be written under a new key.
    let currentValue = valueRef.current;
    if (keyRef.current !== key) {
      const currentKeySnapshot = loadSnapshot(key, initialValue, normalize);
      keyRef.current = key;
      valueRef.current = currentKeySnapshot.value;
      currentValue = currentKeySnapshot.value;
      setSnapshot(currentKeySnapshot);
    }
    const nextValue = typeof action === 'function'
      ? (action as (previous: T) => T)(currentValue)
      : action;
    const result = writePublicStorageValue(key, nextValue);

    valueRef.current = nextValue;
    setSnapshot({
      logicalKey: key,
      versionedKey: versionedPublicStorageKey(key),
      value: nextValue,
      persistenceStatus: result.status === 'persisted'
        ? 'persisted'
        : result.reason === 'future-version'
          ? 'readonly'
          : 'degraded',
    });
    return result;
  }, [initialValue, key, normalize]);

  return [snapshot.value, setValue, snapshot.persistenceStatus] as const;
}
