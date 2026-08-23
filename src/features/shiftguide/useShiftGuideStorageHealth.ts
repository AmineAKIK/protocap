import { useEffect, useState } from 'react';
import {
  isShiftGuideConcurrencyDegraded,
  SHIFTGUIDE_CONCURRENCY_DEGRADED_EVENT,
} from './shiftGuideConcurrency';
import {
  isShiftGuidePersistentStorageDegraded,
  SHIFTGUIDE_STORAGE_DEGRADED_EVENT,
} from './shiftGuideStorage';

export function useShiftGuideStorageHealth() {
  const [storageDegraded, setStorageDegraded] = useState(isShiftGuidePersistentStorageDegraded);
  const [concurrencyDegraded, setConcurrencyDegraded] = useState(isShiftGuideConcurrencyDegraded);

  useEffect(() => {
    const handleStorageDegraded = () => setStorageDegraded(true);
    const handleConcurrencyDegraded = () => setConcurrencyDegraded(true);
    window.addEventListener(SHIFTGUIDE_STORAGE_DEGRADED_EVENT, handleStorageDegraded);
    window.addEventListener(SHIFTGUIDE_CONCURRENCY_DEGRADED_EVENT, handleConcurrencyDegraded);
    return () => {
      window.removeEventListener(SHIFTGUIDE_STORAGE_DEGRADED_EVENT, handleStorageDegraded);
      window.removeEventListener(SHIFTGUIDE_CONCURRENCY_DEGRADED_EVENT, handleConcurrencyDegraded);
    };
  }, []);

  return {
    persistentStorageDegraded: storageDegraded,
    concurrencyProtectionDegraded: concurrencyDegraded,
  };
}
