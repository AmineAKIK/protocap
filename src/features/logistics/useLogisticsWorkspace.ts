import { useCallback, useRef, useState } from 'react';
import {
  inspectPublicStorageCompatibility,
  readPublicStorageValue,
  writePublicStorageValue,
  type PublicStorageWriteResult,
} from '../../persistence/publicLocalStorage';
import type { LogisticsRequest, LogisticsStatus } from '../../types/logistics';
import { transitionLogisticsRequest } from './logisticsModel';

const LOGISTICS_KEY = 'lineops.logistics.requests';

export type LogisticsWorkspaceStatus = 'memory' | 'persisted' | 'recovery' | 'readonly' | 'degraded' | 'write-failed';
export type LogisticsMutationFailureReason =
  | 'identity-conflict'
  | 'invalid-transition'
  | 'not-found'
  | 'readonly'
  | Exclude<Extract<PublicStorageWriteResult, { status: 'degraded' }>['reason'], 'schema'> | 'schema';

export type LogisticsMutationResult =
  | { status: 'persisted'; idempotent: boolean }
  | { status: 'degraded'; reason: LogisticsMutationFailureReason; errorName?: string; futureVersion?: number };

interface Snapshot {
  requests: LogisticsRequest[];
  status: LogisticsWorkspaceStatus;
  futureVersion?: number;
}

function loadSnapshot(initial: LogisticsRequest[]): Snapshot {
  const compatibility = inspectPublicStorageCompatibility(LOGISTICS_KEY);
  const read = readPublicStorageValue<LogisticsRequest[]>(LOGISTICS_KEY);

  if (compatibility.status === 'degraded') {
    return { requests: read.status === 'loaded' ? read.value : [], status: 'degraded' };
  }
  if (compatibility.status === 'future-version') {
    return {
      requests: read.status === 'loaded' ? read.value : [],
      status: 'readonly',
      futureVersion: compatibility.version,
    };
  }
  if (read.status === 'loaded') return { requests: read.value, status: 'persisted' };
  if (read.status === 'invalid') return { requests: [], status: 'recovery' };
  if (read.status === 'degraded') return { requests: [], status: 'degraded' };
  return { requests: initial, status: 'memory' };
}

function failure(result: Extract<PublicStorageWriteResult, { status: 'degraded' }>): LogisticsMutationResult {
  return {
    status: 'degraded',
    reason: result.reason,
    errorName: result.errorName,
    futureVersion: result.futureVersion,
  };
}

export function useLogisticsWorkspace(initial: LogisticsRequest[]) {
  const [snapshot, setSnapshot] = useState<Snapshot>(() => loadSnapshot(initial));
  const requestsRef = useRef(snapshot.requests);
  const statusRef = useRef(snapshot.status);

  const commit = useCallback((next: LogisticsRequest[]): LogisticsMutationResult => {
    if (statusRef.current === 'readonly') return { status: 'degraded', reason: 'readonly' };
    if (statusRef.current === 'recovery') return { status: 'degraded', reason: 'readonly' };

    const result = writePublicStorageValue(LOGISTICS_KEY, next);
    if (result.status === 'degraded') {
      const status = result.reason === 'future-version' ? 'readonly' : 'write-failed';
      statusRef.current = status;
      setSnapshot((current) => ({
        ...current,
        status,
        futureVersion: result.futureVersion ?? current.futureVersion,
      }));
      return failure(result);
    }

    requestsRef.current = next;
    statusRef.current = 'persisted';
    setSnapshot({ requests: next, status: 'persisted' });
    return { status: 'persisted', idempotent: false };
  }, []);

  const createRequest = useCallback((request: LogisticsRequest): LogisticsMutationResult => {
    const existing = requestsRef.current.find((current) => current.id === request.id);
    if (existing) {
      if (JSON.stringify(existing) === JSON.stringify(request)) {
        return { status: 'persisted', idempotent: true };
      }
      return { status: 'degraded', reason: 'identity-conflict' };
    }
    return commit([request, ...requestsRef.current]);
  }, [commit]);

  const updateStatus = useCallback((
    id: string,
    target: LogisticsStatus,
    completedAt: string,
  ): LogisticsMutationResult => {
    const index = requestsRef.current.findIndex((request) => request.id === id);
    if (index < 0) return { status: 'degraded', reason: 'not-found' };
    const transitioned = transitionLogisticsRequest(requestsRef.current[index], target, completedAt);
    if (!transitioned.ok) return { status: 'degraded', reason: transitioned.reason };
    const next = requestsRef.current.slice();
    next[index] = transitioned.request;
    return commit(next);
  }, [commit]);

  return {
    requests: snapshot.requests,
    status: snapshot.status,
    futureVersion: snapshot.futureVersion,
    createRequest,
    updateStatus,
  } as const;
}
