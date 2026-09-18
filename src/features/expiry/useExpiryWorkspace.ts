import { useCallback, useEffect, useState } from 'react';
import { initialChangeHistory, initialConditioningLines } from '../../data/expiryData';
import { runWithRequiredWebLock, hasRequiredWebLocks } from '../../persistence/requiredWebLock';
import { prepareDeclaration, type DeclarationDraft, type DeclarationError, type DeclarationKind } from './declaration';
import {
  EXPIRY_AGGREGATE_KEY,
  loadExpiryWorkspace,
  persistExpiryTransition,
  type ExpiryStorageIssue,
  type ExpiryWriteResult,
} from './persistence';

const EXPIRY_LOCK_NAME = 'protocap:expiry:workspace';

export type ExpiryDeclarationResult =
  | ExpiryWriteResult
  | { status: 'invalid'; error: DeclarationError };

function concurrencyReadonly() {
  const loaded = loadExpiryWorkspace(initialConditioningLines, initialChangeHistory);
  return { ...loaded, status: 'readonly' as const, issues: ['concurrency-unavailable' as ExpiryStorageIssue, ...loaded.issues] };
}

export function useExpiryWorkspace() {
  const [snapshot, setSnapshot] = useState(() =>
    hasRequiredWebLocks()
      ? loadExpiryWorkspace(initialConditioningLines, initialChangeHistory)
      : concurrencyReadonly(),
  );

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== EXPIRY_AGGREGATE_KEY) return;
      setSnapshot(hasRequiredWebLocks()
        ? loadExpiryWorkspace(initialConditioningLines, initialChangeHistory)
        : concurrencyReadonly());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (snapshot.status !== 'migration-pending') return;
    let active = true;
    void runWithRequiredWebLock(EXPIRY_LOCK_NAME, () => {
      const latest = loadExpiryWorkspace(initialConditioningLines, initialChangeHistory);
      if (latest.status === 'ready') return { loaded: latest, result: null as ExpiryWriteResult | null };
      if (latest.status !== 'migration-pending') return { loaded: latest, result: null as ExpiryWriteResult | null };
      const result = persistExpiryTransition(latest.aggregate.revision, latest.aggregate);
      return { loaded: latest, result };
    }).then((locked) => {
      if (!active) return;
      if (locked.status === 'unavailable') {
        setSnapshot(concurrencyReadonly());
        return;
      }
      const { loaded, result } = locked.value;
      if (!result) {
        setSnapshot(loaded);
        return;
      }
      if (result.status === 'persisted') {
        setSnapshot({ aggregate: result.aggregate, status: 'ready', issues: [] });
        return;
      }
      setSnapshot((current) => ({
        ...current,
        status: result.reason === 'future-version' ? 'readonly' : result.reason === 'conflict' ? 'recovery-required' : 'degraded',
        issues: result.reason === 'conflict' ? ['storage-conflict'] : ['migration-write-failed'],
      }));
    });
    return () => { active = false; };
  }, [snapshot.status]);

  const commitDeclaration = useCallback(async (
    lineId: string,
    kind: DeclarationKind,
    draft: DeclarationDraft,
    operationId: string,
  ): Promise<ExpiryDeclarationResult> => {
    if (!hasRequiredWebLocks()) {
      setSnapshot(concurrencyReadonly());
      return { status: 'degraded', key: EXPIRY_AGGREGATE_KEY, reason: 'concurrency-unavailable' };
    }

    const locked = await runWithRequiredWebLock(EXPIRY_LOCK_NAME, () => {
      const latest = loadExpiryWorkspace(initialConditioningLines, initialChangeHistory);
      if (latest.status === 'readonly') {
        return { status: 'degraded', key: EXPIRY_AGGREGATE_KEY, reason: 'future-version' } as ExpiryWriteResult;
      }
      if (latest.status === 'recovery-required') {
        return { status: 'degraded', key: EXPIRY_AGGREGATE_KEY, reason: 'recovery-required' } as ExpiryWriteResult;
      }
      if (latest.status === 'degraded') {
        return { status: 'degraded', key: EXPIRY_AGGREGATE_KEY, reason: 'access' } as ExpiryWriteResult;
      }
      const existing = latest.aggregate.history.find((entry) => entry.id === operationId);
      if (existing) {
        if (latest.status === 'ready') {
          return { status: 'persisted', key: EXPIRY_AGGREGATE_KEY, aggregate: latest.aggregate, idempotent: true } as ExpiryWriteResult;
        }
        const migrated = persistExpiryTransition(latest.aggregate.revision, latest.aggregate);
        return migrated.status === 'persisted'
          ? { ...migrated, idempotent: true }
          : migrated;
      }

      // Validate against the latest state while holding the lock before any migration/write.
      // Invalid or future drafts therefore produce zero durable writes even from memory/v1/v8 sources.
      const prepared = prepareDeclaration(latest.aggregate.lines, lineId, kind, draft, new Date(), operationId);
      if (!prepared.ok) return { status: 'invalid', error: prepared.error } as ExpiryDeclarationResult;

      return persistExpiryTransition(latest.aggregate.revision, {
        schemaVersion: 2,
        lines: prepared.lines,
        history: [prepared.entry, ...latest.aggregate.history],
      });
    });

    if (locked.status === 'unavailable') {
      setSnapshot(concurrencyReadonly());
      return { status: 'degraded', key: EXPIRY_AGGREGATE_KEY, reason: 'concurrency-unavailable' };
    }

    const result = locked.value;
    if (result.status === 'invalid') return result;
    if (result.status === 'persisted') {
      setSnapshot({ aggregate: result.aggregate, status: 'ready', issues: [] });
      return result;
    }
    setSnapshot((current) => ({
      ...current,
      status: result.reason === 'future-version' || result.reason === 'concurrency-unavailable'
        ? 'readonly'
        : result.reason === 'conflict' || result.reason === 'identity-conflict'
          ? 'recovery-required'
          : 'degraded',
      issues: result.reason === 'concurrency-unavailable'
        ? ['concurrency-unavailable']
        : result.reason === 'conflict' || result.reason === 'identity-conflict'
          ? ['storage-conflict']
          : current.issues,
    }));
    return result;
  }, []);

  return {
    lines: snapshot.aggregate.lines,
    history: snapshot.aggregate.history,
    status: snapshot.status,
    issues: snapshot.issues,
    commitDeclaration,
  } as const;
}
