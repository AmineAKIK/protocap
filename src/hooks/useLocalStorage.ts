import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
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

function persistValue<T>(vkey: string, value: T): LocalStoragePersistenceStatus {
  try {
    window.localStorage.setItem(vkey, JSON.stringify(value));
    return 'persisted';
  } catch {
    return 'degraded';
  }
}

function loadInitialValue<T>(
  key: string,
  vkey: string,
  initialValue: T,
  normalize?: (value: T) => T,
): InitialLocalStorageState<T> {
  let stored: string | null;
  try {
    stored = window.localStorage.getItem(vkey);
  } catch {
    return { value: initialValue, persistenceStatus: 'degraded' };
  }

  let value = initialValue;
  if (stored) {
    try {
      const parsed: unknown = JSON.parse(stored);
      if (isValidPublicStorageValue(key, parsed)) {
        const validated = parsed as T;
        value = normalize ? normalize(validated) : validated;
      }
    } catch {
      value = initialValue;
    }
  }

  return { value, persistenceStatus: persistValue(vkey, value) };
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  normalize?: (value: T) => T,
) {
  const vkey = versionedKey(key);
  const [initialState] = useState<InitialLocalStorageState<T>>(() =>
    loadInitialValue(key, vkey, initialValue, normalize),
  );
  const [value, setValueState] = useState<T>(initialState.value);
  const [persistenceStatus, setPersistenceStatus] = useState<LocalStoragePersistenceStatus>(
    initialState.persistenceStatus,
  );
  const valueRef = useRef(value);

  const setValue = useCallback<Dispatch<SetStateAction<T>>>((action) => {
    const currentValue = valueRef.current;
    const nextValue = typeof action === 'function'
      ? (action as (previous: T) => T)(currentValue)
      : action;

    valueRef.current = nextValue;
    setValueState(nextValue);
    setPersistenceStatus(persistValue(vkey, nextValue));
  }, [vkey]);

  return [value, setValue, persistenceStatus] as const;
}
