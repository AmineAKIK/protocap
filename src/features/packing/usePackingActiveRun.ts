import { useCallback, useState } from 'react';
import type { PackingRun } from './domain/packingRun';
import {
  clearActivePackingRun,
  createNewPackingRun,
  loadActivePackingRun,
  persistActivePackingRun,
  type NewPackingRunInput,
  type PackingRunWriteResult,
  type PackingStorageLike,
} from './persistence/packingRunStorage';

export type PackingPersistenceStatus = 'persisted' | 'degraded';

interface InitialActiveRunState {
  activeRun: PackingRun | null;
  persistenceStatus: PackingPersistenceStatus;
}

export interface PackingRunStartAttempt {
  run: PackingRun;
  status: PackingPersistenceStatus;
}

const PACKING_PERSISTENCE_PROBE_KEY = 'lineops.packing.persistence-probe.v1';

function getBrowserPackingStorage(): PackingStorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function loadInitialActiveRun(): InitialActiveRunState {
  const storage = getBrowserPackingStorage();
  if (!storage) {
    return { activeRun: null, persistenceStatus: 'degraded' };
  }

  const result = loadActivePackingRun(storage);
  if (result.status === 'loaded') {
    return { activeRun: result.activeRun, persistenceStatus: 'persisted' };
  }

  return {
    activeRun: null,
    persistenceStatus: result.status === 'unavailable' || result.status === 'corrupt' ? 'degraded' : 'persisted',
  };
}

function toPersistenceStatus(result: PackingRunWriteResult): PackingPersistenceStatus {
  return result.status;
}

const degradedWriteResult: PackingRunWriteResult = { status: 'degraded' };

export function usePackingActiveRun() {
  const [state, setState] = useState<InitialActiveRunState>(loadInitialActiveRun);

  const probePersistence = useCallback((): PackingPersistenceStatus => {
    const storage = getBrowserPackingStorage();
    if (!storage) return 'degraded';
    try {
      storage.setItem(PACKING_PERSISTENCE_PROBE_KEY, '1');
      storage.removeItem(PACKING_PERSISTENCE_PROBE_KEY);
      return 'persisted';
    } catch {
      return 'degraded';
    }
  }, []);

  const tryStartRun = useCallback((input: NewPackingRunInput): PackingRunStartAttempt => {
    const run = createNewPackingRun(input);
    const storage = getBrowserPackingStorage();
    const result = storage ? persistActivePackingRun(storage, run) : degradedWriteResult;
    const status = toPersistenceStatus(result);
    if (status === 'persisted') setState({ activeRun: run, persistenceStatus: status });
    else setState((current) => ({ ...current, persistenceStatus: status }));
    return { run, status };
  }, []);

  const startRun = useCallback((input: NewPackingRunInput): PackingRun => {
    const run = createNewPackingRun(input);
    const storage = getBrowserPackingStorage();
    const result = storage ? persistActivePackingRun(storage, run) : degradedWriteResult;
    setState({ activeRun: run, persistenceStatus: toPersistenceStatus(result) });
    return run;
  }, []);

  const updateRun = useCallback((run: PackingRun): PackingRunWriteResult => {
    const storage = getBrowserPackingStorage();
    const result = storage ? persistActivePackingRun(storage, run) : degradedWriteResult;
    setState({ activeRun: run, persistenceStatus: toPersistenceStatus(result) });
    return result;
  }, []);

  const tryClearRun = useCallback((): PackingRunWriteResult => {
    const storage = getBrowserPackingStorage();
    const result = storage ? clearActivePackingRun(storage) : degradedWriteResult;
    if (result.status === 'persisted') setState({ activeRun: null, persistenceStatus: 'persisted' });
    else setState((current) => ({ ...current, persistenceStatus: 'degraded' }));
    return result;
  }, []);

  const clearRun = useCallback((): PackingRunWriteResult => {
    const storage = getBrowserPackingStorage();
    const result = storage ? clearActivePackingRun(storage) : degradedWriteResult;
    setState({ activeRun: null, persistenceStatus: toPersistenceStatus(result) });
    return result;
  }, []);

  return {
    activeRun: state.activeRun,
    persistenceStatus: state.persistenceStatus,
    probePersistence,
    tryStartRun,
    startRun,
    updateRun,
    tryClearRun,
    clearRun,
  };
}
