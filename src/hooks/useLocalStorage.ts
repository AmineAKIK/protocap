import { useEffect, useState } from 'react';

const DATA_VERSION = 'v8';

type StorageValidator<T> = (value: unknown) => value is T;

function versionedKey(key: string) {
  return `${key}.${DATA_VERSION}`;
}

export function useLocalStorage<T>(key: string, initialValue: T, isValid: StorageValidator<T>) {
  const vkey = versionedKey(key);

  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(vkey);
      if (!stored) return initialValue;
      const parsed: unknown = JSON.parse(stored);
      return isValid(parsed) ? parsed : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(vkey, JSON.stringify(value));
    } catch {
      // Browser storage is a persistence enhancement, not a runtime requirement.
      // Quota/security failures must not crash the application.
    }
  }, [vkey, value]);

  return [value, setValue] as const;
}
