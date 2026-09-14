import { useCallback, useState } from 'react';
import type { PackingRun } from './domain/packingRun';
import {
  clearActivePackingRun,
  createNewPackingRun,
  loadActivePackingRun,
  persistActivePackingRun,
  type NewPackingRunInput,
  type PackingRunWriteResult,
} from './persistence/packingRunStorage';

export type PackingPersistenceStatus = 'persisted' | 'degraded';

interface InitialActiveRunState {
  activeRun: PackingRun | null;
  persistenceStatus: PackingPersistenceStatus;
}

function loadInitialActiveRun(): InitialActiveRunState {
  const result = loadActivePackingRun(window.localStorage);
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

export function usePackingActiveRun() {
  const [state, setState] = useState<InitialActiveRunState>(loadInitialActiveRun);

  const startRun = useCallback((input: NewPackingRunInput): PackingRun => {
    const run = createNewPackingRun(input);
    const result = persistActivePackingRun(window.localStorage, run);
    setState({ activeRun: run, persistenceStatus: toPersistenceStatus(result) });
    return run;
  }, []);

  const updateRun = useCallback((run: PackingRun): PackingRunWriteResult => {
    const result = persistActivePackingRun(window.localStorage, run);
    setState({ activeRun: run, persistenceStatus: toPersistenceStatus(result) });
    return result;
  }, []);

  const clearRun = useCallback((): PackingRunWriteResult => {
    const result = clearActivePackingRun(window.localStorage);
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
