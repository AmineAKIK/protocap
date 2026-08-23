import { useEffect, useState } from 'react';
import {
  isShiftGuidePersistentStorageDegraded,
  SHIFTGUIDE_STORAGE_DEGRADED_EVENT,
} from './shiftGuideStorage';

export function useShiftGuideStorageHealth() {
  const [degraded, setDegraded] = useState(isShiftGuidePersistentStorageDegraded);

  useEffect(() => {
    const handleDegraded = () => setDegraded(true);
    window.addEventListener(SHIFTGUIDE_STORAGE_DEGRADED_EVENT, handleDegraded);
    return () => window.removeEventListener(SHIFTGUIDE_STORAGE_DEGRADED_EVENT, handleDegraded);
  }, []);

  return { persistentStorageDegraded: degraded };
}
