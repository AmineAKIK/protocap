import { useCallback, useRef, useState, type SetStateAction } from 'react';
import { isValidPublicStorageValue } from '../utils/publicStorageValidation';

const DATA_VERSION = 'v8';

export type LocalStoragePersistenceStatus = 'persisted' | 'degraded' | 'recovered';

function versionedKey(key: string) {
  return `${key}.${DATA_VERSION}`;
}

interface InitialLocalStorageState<T> {
  value: T;
  persistenceStatus: LocalStoragePersistenceStatus;
}

function persistValue<T>(vkey: string, value: T): Exclude<LocalStoragePersistenceStatus, 'recovered'> {
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
  let recovered = false;
  if (stored !== null) {
    try {
      const parsed: unknown = JSON.parse(stored);
      if (isValidPublicStorageValue(key, parsed)) {
        const validated = parsed as T;
        value = normalize ? normalize(validated) : validated;
      } else {
        recovered = true;
      }
    } catch {
      recovered = true;
      value = initialValue;
    }
  }

  const writeStatus = persistValue(vkey, value);
  if (writeStatus === 'degraded') return { value, persistenceStatus: 'degraded' };
  return { value, persistenceStatus: recovered ? 'recovered' : 'persisted' };
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

  const setValue = useCallback((action: SetStateAction<T>): Exclude<LocalStoragePersistenceStatus, 'recovered'> => {
    const currentValue = valueRef.current;
    const nextValue = typeof action === 'function'
      ? (action as (previous: T) => T)(currentValue)
      : action;

    valueRef.current = nextValue;
    setValueState(nextValue);
    const status = persistValue(vkey, nextValue);
    setPersistenceStatus(status);
    return status;
  }, [vkey]);

  return [value, setValue, persistenceStatus] as const;
}
