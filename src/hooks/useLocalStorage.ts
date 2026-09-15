import { useCallback, useEffect, useRef, useState } from 'react';
import { isValidPublicStorageValue } from '../utils/publicStorageValidation';

const DATA_VERSION = 'v8';

export type LocalStoragePersistenceStatus = 'persisted' | 'degraded';

function versionedKey(key: string) {
  return `${key}.${DATA_VERSION}`;
}

interface InitialLocalStorageState<T> {
  value: T;
  persistenceStatus: LocalStoragePersistenceStatus;
}

function loadInitialValue<T>(
  key: string,
  vkey: string,
  initialValue: T,
  normalize?: (value: T) => T,
): InitialLocalStorageState<T> {
  try {
    const stored = window.localStorage.getItem(vkey);
    if (!stored) return { value: initialValue, persistenceStatus: 'persisted' };
    const parsed: unknown = JSON.parse(stored);
    if (!isValidPublicStorageValue(key, parsed)) return { value: initialValue, persistenceStatus: 'persisted' };
    const validated = parsed as T;
    return {
      value: normalize ? normalize(validated) : validated,
      persistenceStatus: 'persisted',
    };
  } catch {
    return { value: initialValue, persistenceStatus: 'degraded' };
  }
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  normalize?: (value: T) => T,
) {
  const vkey = versionedKey(key);
  const initialRef = useRef<InitialLocalStorageState<T> | null>(null);
  if (initialRef.current === null) {
    initialRef.current = loadInitialValue(key, vkey, initialValue, normalize);
  }

  const [value, setValue] = useState<T>(initialRef.current.value);
  const [persistenceStatus, setPersistenceStatus] = useState<LocalStoragePersistenceStatus>(
    initialRef.current.persistenceStatus,
  );

  const persist = useCallback((nextValue: T) => {
    try {
      window.localStorage.setItem(vkey, JSON.stringify(nextValue));
      setPersistenceStatus('persisted');
    } catch {
      setPersistenceStatus('degraded');
    }
  }, [vkey]);

  useEffect(() => {
    persist(value);
  }, [persist, value]);

  return [value, setValue, persistenceStatus] as const;
}
