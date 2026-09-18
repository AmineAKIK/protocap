import { useCallback, useEffect, useState } from 'react';
import { initialChangeHistory, initialConditioningLines } from '../../data/expiryData';
import type { ChangeHistoryEntry, ConditioningLine } from '../../types/expiry';
import {
  EXPIRY_AGGREGATE_KEY,
  loadExpiryWorkspace,
  persistExpiryTransition,
  type ExpiryAggregateV1,
  type ExpiryWriteResult,
  type ExpiryWorkspaceStatus,
} from './persistence';

function blockedWrite(reason: 'future-version' | 'recovery-required'): ExpiryWriteResult {
  return { status: 'degraded', key: EXPIRY_AGGREGATE_KEY, reason };
}

export function useExpiryWorkspace() {
  const [snapshot, setSnapshot] = useState(() =>
    loadExpiryWorkspace(initialConditioningLines, initialChangeHistory),
  );

  useEffect(() => {
    if (snapshot.status !== 'migration-pending') return;
    const result = persistExpiryTransition(snapshot.persistedRaw, snapshot.aggregate, snapshot.aggregate);
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (result.status === 'persisted') {
        setSnapshot((current) => current.status === 'migration-pending'
          ? { ...current, status: 'ready', persistedRaw: result.raw, issues: [] }
          : current);
        return;
      }
      const nextStatus: ExpiryWorkspaceStatus = result.reason === 'future-version'
        ? 'readonly'
        : result.reason === 'conflict'
          ? 'recovery-required'
          : 'degraded';
      setSnapshot((current) => current.status === 'migration-pending'
        ? {
            ...current,
            status: nextStatus,
            issues: result.reason === 'conflict' ? ['storage-conflict'] : ['migration-write-failed'],
          }
        : current);
    });
    return () => { active = false; };
  }, [snapshot]);

  const commitDeclaration = useCallback((
    nextLines: ConditioningLine[],
    entry: ChangeHistoryEntry,
  ): ExpiryWriteResult => {
    if (snapshot.status === 'readonly') return blockedWrite('future-version');
    if (snapshot.status === 'recovery-required') return blockedWrite('recovery-required');

    const existing = snapshot.aggregate.history.find((current) => current.id === entry.id);
    if (existing) {
      return { status: 'degraded', key: EXPIRY_AGGREGATE_KEY, reason: 'identity-conflict' };
    }

    const next: ExpiryAggregateV1 = {
      schemaVersion: 1,
      lines: nextLines,
      history: [entry, ...snapshot.aggregate.history],
    };
    const result = persistExpiryTransition(snapshot.persistedRaw, snapshot.aggregate, next);
    if (result.status === 'persisted') {
      setSnapshot({ aggregate: next, status: 'ready', persistedRaw: result.raw, issues: [] });
      return result;
    }

    setSnapshot((current) => ({
      ...current,
      status: result.reason === 'future-version'
        ? 'readonly'
        : result.reason === 'conflict' || result.reason === 'identity-conflict'
          ? 'recovery-required'
          : 'degraded',
      issues: result.reason === 'conflict' || result.reason === 'identity-conflict'
        ? ['storage-conflict']
        : current.issues,
    }));
    return result;
  }, [snapshot]);

  return {
    lines: snapshot.aggregate.lines,
    history: snapshot.aggregate.history,
    status: snapshot.status,
    issues: snapshot.issues,
    commitDeclaration,
  } as const;
}
