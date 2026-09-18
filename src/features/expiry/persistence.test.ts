import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChangeHistoryEntry, ConditioningLine } from '../../types/expiry';
import {
  EXPIRY_AGGREGATE_KEY,
  EXPIRY_LEGACY_HISTORY_KEY,
  EXPIRY_LEGACY_LINES_KEY,
  loadExpiryWorkspace,
  persistExpiryTransition,
  serializeExpiryAggregate,
  type ExpiryAggregateV1,
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
const initialLines = [line];
const initialHistory = [event];

function seedLegacy(lines = initialLines, history = initialHistory) {
  localStorage.setItem(EXPIRY_LEGACY_LINES_KEY, JSON.stringify(lines));
  localStorage.setItem(EXPIRY_LEGACY_HISTORY_KEY, JSON.stringify(history));
}
function aggregate(history: ChangeHistoryEntry[] = initialHistory): ExpiryAggregateV1 {
  return { schemaVersion: 1, lines: initialLines, history };
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('Expiry aggregate migration', () => {
  it('T14: plans the two-key v8 migration without modifying either source', () => {
    seedLegacy();
    const sources = [localStorage.getItem(EXPIRY_LEGACY_LINES_KEY), localStorage.getItem(EXPIRY_LEGACY_HISTORY_KEY)];

    const loaded = loadExpiryWorkspace([], []);
    expect(loaded.status).toBe('migration-pending');
    expect(loaded.aggregate).toEqual(aggregate());
    expect(localStorage.getItem(EXPIRY_AGGREGATE_KEY)).toBeNull();
    expect([localStorage.getItem(EXPIRY_LEGACY_LINES_KEY), localStorage.getItem(EXPIRY_LEGACY_HISTORY_KEY)]).toEqual(sources);
  });

  it('T14: migration is resumable and idempotent while v8 sources remain byte-for-byte intact', () => {
    seedLegacy();
    const base = loadExpiryWorkspace([], []);
    const sources = [localStorage.getItem(EXPIRY_LEGACY_LINES_KEY), localStorage.getItem(EXPIRY_LEGACY_HISTORY_KEY)];
    const original = Storage.prototype.setItem;
    let fail = true;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === EXPIRY_AGGREGATE_KEY && fail) {
        fail = false;
        throw new DOMException('Full', 'QuotaExceededError');
      }
      return original.call(this, key, value);
    });

    expect(persistExpiryTransition(null, base.aggregate, base.aggregate)).toMatchObject({
      status: 'degraded', reason: 'quota',
    });
    expect(localStorage.getItem(EXPIRY_AGGREGATE_KEY)).toBeNull();

    const retried = persistExpiryTransition(null, base.aggregate, base.aggregate);
    expect(retried).toMatchObject({ status: 'persisted', idempotent: false });
    const after = localStorage.getItem(EXPIRY_AGGREGATE_KEY);
    expect(after).toBe(serializeExpiryAggregate(base.aggregate));

    const idempotent = persistExpiryTransition(null, base.aggregate, base.aggregate);
    expect(idempotent).toMatchObject({ status: 'persisted', idempotent: true });
    expect(localStorage.getItem(EXPIRY_AGGREGATE_KEY)).toBe(after);
    expect([localStorage.getItem(EXPIRY_LEGACY_LINES_KEY), localStorage.getItem(EXPIRY_LEGACY_HISTORY_KEY)]).toEqual(sources);
  });

  it('T15: malformed aggregate and incomplete legacy data are preserved and block writes', () => {
    localStorage.setItem(EXPIRY_AGGREGATE_KEY, '{broken');
    localStorage.setItem(EXPIRY_LEGACY_LINES_KEY, JSON.stringify(initialLines));
    const raw = localStorage.getItem(EXPIRY_AGGREGATE_KEY);

    const loaded = loadExpiryWorkspace([], []);
    expect(loaded.status).toBe('recovery-required');
    expect(loaded.aggregate.lines).toEqual(initialLines);
    expect(loaded.aggregate.history).toEqual([]);
    expect(loaded.issues).toEqual(expect.arrayContaining(['aggregate-invalid', 'legacy-history-missing']));
    expect(localStorage.getItem(EXPIRY_AGGREGATE_KEY)).toBe(raw);
  });

  it('T15: a future aggregate version forces read-only behavior without rewriting v1 or v8', () => {
    seedLegacy();
    localStorage.setItem('lineops.expiry.aggregate.v2', JSON.stringify({ schemaVersion: 2, future: true }));
    const before = Array.from({ length: localStorage.length }, (_, index) => {
      const key = localStorage.key(index)!;
      return [key, localStorage.getItem(key)];
    }).sort();

    const loaded = loadExpiryWorkspace([], []);
    expect(loaded.status).toBe('readonly');
    expect(loaded.issues).toContain('future-version');
    expect(Array.from({ length: localStorage.length }, (_, index) => {
      const key = localStorage.key(index)!;
      return [key, localStorage.getItem(key)];
    }).sort()).toEqual(before);
  });

  it('T13/T21: uncertain verification can be retried idempotently without duplicating history', () => {
    const base = aggregate([]);
    const next = aggregate([event]);
    const originalGet = Storage.prototype.getItem;
    let aggregateReads = 0;
    const read = vi.spyOn(Storage.prototype, 'getItem');
    read.mockImplementation(function (this: Storage, key: string) {
      if (key === EXPIRY_AGGREGATE_KEY) {
        aggregateReads += 1;
        if (aggregateReads === 2) throw new DOMException('Blocked after write', 'SecurityError');
      }
      return originalGet.call(this, key);
    });

    expect(persistExpiryTransition(null, base, next)).toMatchObject({
      status: 'degraded', reason: 'verify',
    });
    read.mockRestore();

    expect(persistExpiryTransition(null, base, next)).toMatchObject({
      status: 'persisted', idempotent: true,
    });
    const stored = JSON.parse(localStorage.getItem(EXPIRY_AGGREGATE_KEY)!) as ExpiryAggregateV1;
    expect(stored.history).toEqual([event]);
  });

  it('T13: a failed aggregate write leaves the previous state and history together', () => {
    const base = aggregate([]);
    localStorage.setItem(EXPIRY_AGGREGATE_KEY, serializeExpiryAggregate(base));
    const before = localStorage.getItem(EXPIRY_AGGREGATE_KEY);
    const next = aggregate([event]);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });

    expect(persistExpiryTransition(before, base, next)).toMatchObject({ status: 'degraded', reason: 'quota' });
    expect(localStorage.getItem(EXPIRY_AGGREGATE_KEY)).toBe(before);
  });
});
