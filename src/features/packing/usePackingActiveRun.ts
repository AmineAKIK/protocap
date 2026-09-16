import { useCallback, useEffect, useRef, useState } from 'react';
import type { PackingRun } from './domain/packingRun';
import {
  createNewPackingRun,
  loadPackingWorkspace,
  PACKING_ACTIVE_RUN_STORAGE_KEY,
  persistPackingWorkspace,
  type PersistedPackingDraft,
  type NewPackingRunInput,
  type PackingRunWriteResult,
  type PackingStorageLike,
} from './persistence/packingRunStorage';

export type PackingPersistenceStatus = 'persisted' | 'degraded';

interface InitialActiveRunState {
  activeRun: PackingRun | null;
  draft: PersistedPackingDraft | null;
  revision: number;
  persistenceStatus: PackingPersistenceStatus;
  conflictDetected: boolean;
  externalSyncVersion: number;
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
    return { activeRun: null, draft: null, revision: 0, persistenceStatus: 'degraded', conflictDetected: false, externalSyncVersion: 0 };
  }

  const result = loadPackingWorkspace(storage);
  if (result.status === 'loaded') {
    return { activeRun: result.activeRun, draft: result.draft, revision: result.revision, persistenceStatus: 'persisted', conflictDetected: false, externalSyncVersion: 0 };
  }

  return {
    activeRun: null,
    draft: null,
    revision: result.revision,
    persistenceStatus: result.status === 'unavailable' || result.status === 'corrupt' ? 'degraded' : 'persisted',
    conflictDetected: false,
    externalSyncVersion: 0,
  };
}

function toPersistenceStatus(result: PackingRunWriteResult): PackingPersistenceStatus {
  return result.status === 'persisted' ? 'persisted' : 'degraded';
}

const degradedWriteResult: PackingRunWriteResult = { status: 'degraded' };

export function usePackingActiveRun() {
  const [state, setState] = useState<InitialActiveRunState>(loadInitialActiveRun);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const commitState = useCallback((next: InitialActiveRunState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const reconcileConflict = useCallback((storage: PackingStorageLike, current: InitialActiveRunState) => {
    const latest = loadPackingWorkspace(storage);
    if (latest.status === 'loaded') {
      commitState({ activeRun: latest.activeRun, draft: latest.draft, revision: latest.revision, persistenceStatus: 'degraded', conflictDetected: true, externalSyncVersion: current.externalSyncVersion + 1 });
    } else if (latest.status === 'empty') {
      commitState({ activeRun: null, draft: null, revision: latest.revision, persistenceStatus: 'degraded', conflictDetected: true, externalSyncVersion: current.externalSyncVersion + 1 });
    } else {
      commitState({ ...current, persistenceStatus: 'degraded', conflictDetected: true });
    }
  }, [commitState]);

  useEffect(() => {
    function syncFromAnotherTab(event: StorageEvent) {
      if (event.key !== PACKING_ACTIVE_RUN_STORAGE_KEY) return;
      const storage = getBrowserPackingStorage();
      if (!storage) return;
      const incoming = loadPackingWorkspace(storage);
      if (incoming.status === 'loaded') {
        setState((current) => incoming.revision > current.revision ? {
          activeRun: incoming.activeRun,
          draft: incoming.draft,
          revision: incoming.revision,
          persistenceStatus: 'persisted',
          conflictDetected: true,
          externalSyncVersion: current.externalSyncVersion + 1,
        } : current);
      } else if (incoming.status === 'empty') {
        setState((current) => incoming.revision > current.revision ? {
          activeRun: null,
          draft: null,
          revision: incoming.revision,
          persistenceStatus: 'persisted',
          conflictDetected: true,
          externalSyncVersion: current.externalSyncVersion + 1,
        } : current);
      }
    }
    window.addEventListener('storage', syncFromAnotherTab);
    return () => window.removeEventListener('storage', syncFromAnotherTab);
  }, []);

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
    const result = storage ? persistPackingWorkspace(storage, run, null) : degradedWriteResult;
    const status = toPersistenceStatus(result);
    if (status === 'persisted') commitState({ activeRun: run, draft: null, revision: result.status === 'persisted' ? result.revision ?? 0 : 0, persistenceStatus: status, conflictDetected: false, externalSyncVersion: 0 });
    else setState((current) => ({ ...current, persistenceStatus: status }));
    return { run, status };
  }, [commitState]);

  const startRun = useCallback((input: NewPackingRunInput): PackingRun => {
    const run = createNewPackingRun(input);
    const storage = getBrowserPackingStorage();
    const result = storage ? persistPackingWorkspace(storage, run, null) : degradedWriteResult;
    commitState({ activeRun: run, draft: null, revision: result.status === 'persisted' ? result.revision ?? 0 : 0, persistenceStatus: toPersistenceStatus(result), conflictDetected: false, externalSyncVersion: 0 });
    return run;
  }, [commitState]);

  const updateRun = useCallback((run: PackingRun): PackingRunWriteResult => {
    const storage = getBrowserPackingStorage();
    const current = stateRef.current;
    const result = storage ? persistPackingWorkspace(storage, run, null, current.revision) : degradedWriteResult;
    if (result.status === 'conflict' && storage) reconcileConflict(storage, current);
    else commitState({ activeRun: run, draft: null, revision: result.status === 'persisted' ? result.revision ?? current.revision : current.revision, persistenceStatus: toPersistenceStatus(result), conflictDetected: false, externalSyncVersion: current.externalSyncVersion });
    return result;
  }, [commitState, reconcileConflict]);

  const updateDraft = useCallback((draft: PersistedPackingDraft | null): PackingRunWriteResult => {
    const storage = getBrowserPackingStorage();
    const current = stateRef.current;
    if (!current.activeRun) return degradedWriteResult;
    const result = storage ? persistPackingWorkspace(storage, current.activeRun, draft, current.revision) : degradedWriteResult;
    if (result.status === 'conflict' && storage) reconcileConflict(storage, current);
    else commitState({ ...current, draft, revision: result.status === 'persisted' ? result.revision ?? current.revision : current.revision, persistenceStatus: toPersistenceStatus(result), conflictDetected: false });
    return result;
  }, [commitState, reconcileConflict]);

  const tryClearRun = useCallback((): PackingRunWriteResult => {
    const storage = getBrowserPackingStorage();
    const current = stateRef.current;
    const result = storage ? persistPackingWorkspace(storage, null, null, current.revision) : degradedWriteResult;
    if (result.status === 'persisted') commitState({ activeRun: null, draft: null, revision: result.revision ?? current.revision, persistenceStatus: 'persisted', conflictDetected: false, externalSyncVersion: current.externalSyncVersion });
    else if (result.status === 'conflict' && storage) reconcileConflict(storage, current);
    else commitState({ ...current, persistenceStatus: 'degraded', conflictDetected: result.status === 'conflict' || current.conflictDetected });
    return result;
  }, [commitState, reconcileConflict]);

  const clearRun = useCallback((): PackingRunWriteResult => {
    return tryClearRun();
  }, [tryClearRun]);

  return {
    activeRun: state.activeRun,
    draft: state.draft,
    conflictDetected: state.conflictDetected,
    externalSyncVersion: state.externalSyncVersion,
    persistenceStatus: state.persistenceStatus,
    probePersistence,
    tryStartRun,
    startRun,
    updateRun,
    updateDraft,
    tryClearRun,
    clearRun,
  };
}
