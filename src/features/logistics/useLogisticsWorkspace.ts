import { useCallback, useEffect, useState } from 'react';
import { hasRequiredWebLocks, runWithRequiredWebLock } from '../../persistence/requiredWebLock';
import type { LogisticsRequest, LogisticsStatus } from '../../types/logistics';
import { transitionLogisticsRequest } from './logisticsModel';
import {
  LOGISTICS_WORKSPACE_KEY,
  loadLogisticsWorkspace,
  persistLogisticsWorkspace,
  type LogisticsPersistenceResult,
  type LoadedLogisticsWorkspace,
  type LogisticsWorkspaceV9,
} from './logisticsPersistence';

const LOGISTICS_LOCK_NAME = 'protocap:logistics:workspace';

export type LogisticsWorkspaceStatus = 'memory' | 'persisted' | 'migration-pending' | 'recovery' | 'readonly' | 'degraded' | 'write-failed';
export type LogisticsMutationFailureReason =
  | 'identity-conflict'
  | 'invalid-transition'
  | 'not-found'
  | 'readonly'
  | 'access'
  | 'quota'
  | 'write'
  | 'serialize'
  | 'schema'
  | 'verify'
  | 'future-version'
  | 'conflict'
  | 'recovery'
  | 'concurrency-unavailable';

export type LogisticsMutationResult =
  | { status: 'persisted'; idempotent: boolean }
  | { status: 'degraded'; reason: LogisticsMutationFailureReason; errorName?: string; futureVersion?: number };

function mapStatus(loaded: LoadedLogisticsWorkspace): LogisticsWorkspaceStatus {
  if (loaded.status === 'ready') return 'persisted';
  return loaded.status;
}

function concurrencyReadonly(initial: LogisticsRequest[]): LoadedLogisticsWorkspace {
  const loaded = loadLogisticsWorkspace(initial);
  return { ...loaded, status: 'readonly' };
}

function failure(result: Extract<LogisticsPersistenceResult, { status: 'degraded' }>): LogisticsMutationResult {
  return { status: 'degraded', reason: result.reason, errorName: result.errorName, futureVersion: result.futureVersion };
}

export function useLogisticsWorkspace(initial: LogisticsRequest[]) {
  const [loaded, setLoaded] = useState<LoadedLogisticsWorkspace>(() =>
    hasRequiredWebLocks() ? loadLogisticsWorkspace(initial) : concurrencyReadonly(initial),
  );

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== LOGISTICS_WORKSPACE_KEY) return;
      setLoaded(hasRequiredWebLocks() ? loadLogisticsWorkspace(initial) : concurrencyReadonly(initial));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [initial]);

  useEffect(() => {
    if (loaded.status !== 'migration-pending') return;
    let active = true;
    void runWithRequiredWebLock(LOGISTICS_LOCK_NAME, () => {
      const latest = loadLogisticsWorkspace(initial);
      if (latest.status === 'ready') return { latest, persisted: null as LogisticsPersistenceResult | null };
      if (latest.status !== 'migration-pending') return { latest, persisted: null as LogisticsPersistenceResult | null };
      const persisted = persistLogisticsWorkspace(latest.workspace.revision, latest.workspace.requests);
      return { latest, persisted };
    }).then((locked) => {
      if (!active) return;
      if (locked.status === 'unavailable') {
        setLoaded(concurrencyReadonly(initial));
        return;
      }
      if (!locked.value.persisted) {
        setLoaded(locked.value.latest);
        return;
      }
      const persisted = locked.value.persisted;
      if (persisted.status === 'persisted') {
        setLoaded({ workspace: persisted.workspace, status: 'ready' });
      } else {
        setLoaded((current) => ({ ...current, status: persisted.reason === 'future-version' ? 'readonly' : 'degraded', futureVersion: persisted.futureVersion }));
      }
    });
    return () => { active = false; };
  }, [initial, loaded.status]);

  type LockedMutation =
    | { kind: 'result'; result: LogisticsMutationResult }
    | { kind: 'committed'; workspace: LogisticsWorkspaceV9 };

  const runMutation = useCallback(async (
    mutate: (latest: LogisticsRequest[]) => LogisticsMutationResult | { status: 'next'; requests: LogisticsRequest[] },
  ): Promise<LogisticsMutationResult> => {
    if (!hasRequiredWebLocks()) {
      setLoaded(concurrencyReadonly(initial));
      return { status: 'degraded', reason: 'concurrency-unavailable' };
    }

    const locked = await runWithRequiredWebLock<LockedMutation>(LOGISTICS_LOCK_NAME, () => {
      let latest = loadLogisticsWorkspace(initial);
      if (latest.status === 'readonly') {
        return { kind: 'result', result: { status: 'degraded', reason: 'future-version', futureVersion: latest.futureVersion } };
      }
      if (latest.status === 'recovery') {
        return { kind: 'result', result: { status: 'degraded', reason: 'recovery' } };
      }
      if (latest.status === 'degraded') {
        return { kind: 'result', result: { status: 'degraded', reason: 'access' } };
      }
      if (latest.status === 'migration-pending' || latest.status === 'memory') {
        const migrated = persistLogisticsWorkspace(latest.workspace.revision, latest.workspace.requests);
        if (migrated.status === 'degraded') return { kind: 'result', result: failure(migrated) };
        latest = { workspace: migrated.workspace, status: 'ready' };
      }

      const outcome = mutate(latest.workspace.requests);
      if (outcome.status !== 'next') return { kind: 'result', result: outcome };
      const persisted = persistLogisticsWorkspace(latest.workspace.revision, outcome.requests);
      if (persisted.status === 'degraded') return { kind: 'result', result: failure(persisted) };
      return { kind: 'committed', workspace: persisted.workspace };
    });

    if (locked.status === 'unavailable') {
      setLoaded(concurrencyReadonly(initial));
      return { status: 'degraded', reason: 'concurrency-unavailable' };
    }

    if (locked.value.kind === 'committed') {
      setLoaded({ workspace: locked.value.workspace, status: 'ready' });
      return { status: 'persisted', idempotent: false };
    }

    const result = locked.value.result;
    if (result.status === 'persisted') {
      setLoaded(loadLogisticsWorkspace(initial));
      return result;
    }
    setLoaded((current) => ({
      ...current,
      status: result.reason === 'future-version' || result.reason === 'concurrency-unavailable'
        ? 'readonly'
        : result.reason === 'conflict' || result.reason === 'recovery' || result.reason === 'identity-conflict'
          ? 'recovery'
          : 'write-failed',
      futureVersion: result.futureVersion ?? current.futureVersion,
    }));
    return result;
  }, [initial]);

  const createRequest = useCallback(async (request: LogisticsRequest): Promise<LogisticsMutationResult> =>
    runMutation((latest) => {
      const existing = latest.find((current) => current.id === request.id);
      if (existing) {
        return JSON.stringify(existing) === JSON.stringify(request)
          ? { status: 'persisted', idempotent: true }
          : { status: 'degraded', reason: 'identity-conflict' };
      }
      return { status: 'next', requests: [request, ...latest] };
    }), [runMutation]);

  const updateStatus = useCallback(async (
    id: string,
    target: LogisticsStatus,
    completedAt: string,
  ): Promise<LogisticsMutationResult> =>
    runMutation((latest) => {
      const index = latest.findIndex((request) => request.id === id);
      if (index < 0) return { status: 'degraded', reason: 'not-found' };
      const transitioned = transitionLogisticsRequest(latest[index], target, completedAt);
      if (!transitioned.ok) return { status: 'degraded', reason: transitioned.reason };
      const next = latest.slice();
      next[index] = transitioned.request;
      return { status: 'next', requests: next };
    }), [runMutation]);

  return {
    requests: loaded.workspace.requests,
    status: mapStatus(loaded),
    futureVersion: loaded.futureVersion,
    createRequest,
    updateStatus,
  } as const;
}
