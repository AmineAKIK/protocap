import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChangeHistoryEntry, ConditioningLine } from '../../types/expiry';
import {
  EXPIRY_AGGREGATE_KEY,
  EXPIRY_LEGACY_HISTORY_KEY,
  EXPIRY_LEGACY_LINES_KEY,
  EXPIRY_PREVIOUS_AGGREGATE_KEY,
  loadExpiryWorkspace,
  persistExpiryTransition,
  serializeExpiryAggregate,
  type ExpiryAggregateV2,
} from './persistence';

const line: ConditioningLine = {
  id: 'a',
  name: 'Ligne A',
  vat: 'Cuve 1',
  product: 'Fixture',
  conditioningStartedAt: '2026-09-15T12:00:00.000Z',
  elements: [{
    type: 'fillingBlock',
    label: 'Bloc',
    lastChangedAt: '2026-09-15T12:00:00.000Z',
    expiresAt: '2026-09-20T12:00:00.000Z',
    validityDays: 5,
    operator: 'Fixture',
  }],
};
const event: ChangeHistoryEntry = {
  id: 'evt-1',
  lineId: 'a',
  lineName: 'Ligne A',
  elementLabel: 'Bloc de remplissage',
  changedAt: '2026-09-15T12:00:00.000Z',
  newExpiresAt: '2026-09-20T12:00:00.000Z',
  operator: 'Fixture',
};

function v2(history: ChangeHistoryEntry[] = [event], revision = 0): ExpiryAggregateV2 {
  return { schemaVersion: 2, revision, lines: [line], history };
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('Expiry revisioned persistence', () => {
  it('T14/T40: migrates a valid v1 aggregate without modifying v1', () => {
    const previous = { schemaVersion: 1, lines: [line], history: [event] };
    const raw = JSON.stringify(previous);
    localStorage.setItem(EXPIRY_PREVIOUS_AGGREGATE_KEY, raw);

    const loaded = loadExpiryWorkspace([], []);
    expect(loaded).toMatchObject({
      status: 'migration-pending',
      aggregate: { schemaVersion: 2, revision: 0, lines: [line], history: [event] },
    });
    expect(localStorage.getItem(EXPIRY_AGGREGATE_KEY)).toBeNull();

    const persisted = persistExpiryTransition(0, loaded.aggregate);
    expect(persisted).toMatchObject({ status: 'persisted', aggregate: { revision: 1 } });
    expect(localStorage.getItem(EXPIRY_PREVIOUS_AGGREGATE_KEY)).toBe(raw);
  });

  it('T14: still migrates the original two v8 keys without modifying either source', () => {
    localStorage.setItem(EXPIRY_LEGACY_LINES_KEY, JSON.stringify([line]));
    localStorage.setItem(EXPIRY_LEGACY_HISTORY_KEY, JSON.stringify([event]));
    const sources = [
      localStorage.getItem(EXPIRY_LEGACY_LINES_KEY),
      localStorage.getItem(EXPIRY_LEGACY_HISTORY_KEY),
    ];

    const loaded = loadExpiryWorkspace([], []);
    expect(loaded.status).toBe('migration-pending');
    const persisted = persistExpiryTransition(0, loaded.aggregate);
    expect(persisted.status).toBe('persisted');
    expect([
      localStorage.getItem(EXPIRY_LEGACY_LINES_KEY),
      localStorage.getItem(EXPIRY_LEGACY_HISTORY_KEY),
    ]).toEqual(sources);
  });

  it('T23: a stale revision is rejected instead of overwriting a newer compatible tab', () => {
    const first = persistExpiryTransition(0, v2([], 0));
    expect(first).toMatchObject({ status: 'persisted', aggregate: { revision: 1 } });

    const newer = persistExpiryTransition(1, {
      schemaVersion: 2,
      lines: [{ ...line, vat: 'Cuve onglet A' }],
      history: [event],
    });
    expect(newer).toMatchObject({ status: 'persisted', aggregate: { revision: 2 } });

    const stale = persistExpiryTransition(1, {
      schemaVersion: 2,
      lines: [{ ...line, vat: 'Cuve onglet B' }],
      history: [],
    });
    expect(stale).toMatchObject({ status: 'degraded', reason: 'conflict' });

    const stored = JSON.parse(localStorage.getItem(EXPIRY_AGGREGATE_KEY)!) as ExpiryAggregateV2;
    expect(stored.revision).toBe(2);
    expect(stored.lines[0].vat).toBe('Cuve onglet A');
    expect(stored.history).toEqual([event]);
  });

  it('T15/T41: future v3 is read-only and neither v2 nor historical sources are rewritten', () => {
    const current = v2([], 3);
    localStorage.setItem(EXPIRY_AGGREGATE_KEY, serializeExpiryAggregate(current));
    localStorage.setItem('lineops.expiry.aggregate.v3', JSON.stringify({ schemaVersion: 3 }));
    const before = Array.from({ length: localStorage.length }, (_, index) => {
      const key = localStorage.key(index)!;
      return [key, localStorage.getItem(key)];
    }).sort();

    const loaded = loadExpiryWorkspace([], []);
    expect(loaded.status).toBe('readonly');
    expect(loaded.issues).toContain('future-version');
    expect(persistExpiryTransition(3, current)).toMatchObject({
      status: 'degraded',
      reason: 'future-version',
      futureVersion: 3,
    });
    expect(Array.from({ length: localStorage.length }, (_, index) => {
      const key = localStorage.key(index)!;
      return [key, localStorage.getItem(key)];
    }).sort()).toEqual(before);
  });

  it('T15: malformed v2 is preserved and forces recovery instead of reset', () => {
    localStorage.setItem(EXPIRY_AGGREGATE_KEY, '{broken');
    const raw = localStorage.getItem(EXPIRY_AGGREGATE_KEY);
    const loaded = loadExpiryWorkspace([], []);
    expect(loaded.status).toBe('recovery-required');
    expect(loaded.issues).toContain('aggregate-invalid');
    expect(localStorage.getItem(EXPIRY_AGGREGATE_KEY)).toBe(raw);
  });
});
