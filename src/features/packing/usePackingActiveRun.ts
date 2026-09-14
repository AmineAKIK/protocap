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

  const clearRun = useCallback((): PackingRunWriteResult => {
    const storage = getBrowserPackingStorage();
    const result = storage ? clearActivePackingRun(storage) : degradedWriteResult;
    setState({ activeRun: null, persistenceStatus: toPersistenceStatus(result) });
    return result;
  }, []);

  return {
    activeRun: state.activeRun,
    persistenceStatus: state.persistenceStatus,
    startRun,
    updateRun,
    clearRun,
  };
}
