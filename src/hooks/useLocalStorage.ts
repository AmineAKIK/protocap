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
    window.localStorage.setItem(vkey, JSON.stringify(value));
  }, [vkey, value]);

  return [value, setValue] as const;
}
