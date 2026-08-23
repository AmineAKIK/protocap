import { useEffect, useState } from 'react';

const DATA_VERSION = 'v8';

function versionedKey(key: string) {
  return `${key}.${DATA_VERSION}`;
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  const vkey = versionedKey(key);

  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(vkey);
      return stored ? (JSON.parse(stored) as T) : initialValue;
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
