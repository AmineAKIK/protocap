import { describe, expect, it } from 'vitest';
import type { ConditioningLine } from '../../types/expiry';
import { getBlockStatus, getElementStatus, getLineStatus, remainingValidityPercent } from '../../utils/expiry';
import { isValidPublicStorageValue } from '../../utils/publicStorageValidation';
import { prepareDeclaration, type DeclarationDraft, type DeclarationKind } from './declaration';
import { addCalendarDays, CALENDAR_DAYS_RULE } from './time';

const now = new Date('2026-09-17T12:00:30.000Z');
function fixture(): ConditioningLine {
  return { id: 'a', name: 'Ligne A', product: 'Produit fictif', vat: 'Cuve 1', conditioningStartedAt: '2026-09-15T12:00:00.000Z',
    elements: [{ type: 'fillingBlock', label: 'Bloc', lastChangedAt: '2026-09-15T12:00:00.000Z', expiresAt: '2026-09-20T12:00:00.000Z', validityDays: 5, operator: 'Test' }] };
}
const draft: DeclarationDraft = { changedAt: '2026-09-17T14:00', timeZone: 'Europe/Paris', occurrence: '', operator: ' Test ', vat: ' Cuve 2 ', comment: ' Commentaire ' };

for (const kind of ['replacement', 'refill'] as const) describe(`T03/T04: ${kind} preflight is non-mutating`, () => {
  it.each([
    [{ changedAt: '' }, 'changedAt'],
    [{ changedAt: '2026-02-30T14:00' }, 'changedAt'],
    [{ changedAt: '2026-09-17T14:01' }, 'changedAt'],
    [{ changedAt: '2026-09-15T13:59' }, 'changedAt'],
    [{ operator: '   ' }, 'operator'],
    [{ operator: 'X'.repeat(121) }, 'operator'],
    [{ operator: '\u0000test' }, 'operator'],
    [{ comment: 'X'.repeat(1001) }, 'comment'],
    [{ timeZone: 'bad' }, 'changedAt'],
  ])('rejects %j before any state change', (change, field) => {
    const lines = [fixture()];
    const before = structuredClone(lines);
    const result = prepareDeclaration(lines, 'a', kind, { ...draft, ...change }, now, 'unique-id');
    expect(result).toMatchObject({ ok: false, error: { field } });
    expect(lines).toEqual(before);
  });
  it('prepares the complete event and state without modifying the input', () => {
    const lines = [fixture()];
    const before = structuredClone(lines);
    const result = prepareDeclaration(lines, 'a', kind, draft, now, 'unique-id');
    expect(result.ok).toBe(true);
    expect(lines).toEqual(before);
    if (!result.ok) return;
    expect(result.entry).toMatchObject({ id: 'unique-id', changedAt: '2026-09-17T12:00:00.000Z', operator: 'Test', comment: 'Commentaire', timeZone: 'Europe/Paris', previousExpiresAt: before[0].elements[0].expiresAt });
    if (kind === 'replacement') {
      expect(result.lines[0].elements[0]).toMatchObject({ lastChangedAt: result.entry.changedAt, expiresAt: result.entry.newExpiresAt, timeZone: 'Europe/Paris', validityRule: CALENDAR_DAYS_RULE });
    } else {
      expect(result.lines[0].vat).toBe('Cuve 2');
      expect(result.lines[0].elements).toEqual(before[0].elements);
      expect(result.entry.newExpiresAt).toBe(before[0].elements[0].expiresAt);
    }
  });
});

describe('T05/T16: suspicious legacy data stays explicit', () => {
  it.each([
    { lastChangedAt: '2026-09-18T12:00:00.000Z' },
    { lastChangedAt: 'invalid' },
    { expiresAt: '2026-02-30T12:00:00.000Z' },
    { expiresAt: '2026-09-15T12:00:00.000Z' },
    { validityDays: 0 },
    { validityDays: 1.5 },
    { operator: '   ' },
    { timeZone: 'not/a-zone', validityRule: CALENDAR_DAYS_RULE },
    { timeZone: 'Europe/Paris', validityRule: 'future-v9' },
    { timeZone: 'Europe/Paris', validityRule: CALENDAR_DAYS_RULE, expiresAt: '2026-09-25T12:00:00.000Z' },
  ])('does not label %j conform or expired', (change) => {
    const line = fixture();
    Object.assign(line.elements[0], change);
    const original = JSON.stringify(line);
    expect(getElementStatus(line.elements[0], now)).toBe('unknown');
    expect(getBlockStatus(line, now)).toBe('unknown');
    expect(getLineStatus(line, now)).toBe('unknown');
    expect(remainingValidityPercent(line, now)).toBeNull();
    expect(isValidPublicStorageValue('lineops.expiry.lines', [line])).toBe(true);
    expect(prepareDeclaration([line], 'a', 'replacement', draft, now, 'id').ok).toBe(false);
    expect(JSON.stringify(line)).toBe(original);
  });
  it('handles absent and duplicate blocks without a crash or green fallback', () => {
    expect(getElementStatus(undefined, now)).toBe('unknown');
    expect(getLineStatus(undefined, now)).toBe('unknown');
    for (const elements of [[], [fixture().elements[0], fixture().elements[0]]]) {
      expect(getLineStatus({ ...fixture(), elements }, now)).toBe('unknown');
    }
    expect(isValidPublicStorageValue('lineops.expiry.lines', [])).toBe(true);
  });
  it('preserves all legacy timestamps and missing provenance', () => {
    const line = fixture();
    const original = JSON.stringify(line);
    expect(isValidPublicStorageValue('lineops.expiry.lines', [line])).toBe(true);
    expect(getLineStatus(line, now)).toBe('conform');
    expect(line.elements[0].timeZone).toBeUndefined();
    expect(line.elements[0].validityRule).toBeUndefined();
    expect(JSON.stringify(line)).toBe(original);
  });
  it('keeps structurally readable invalid history dates for inspection', () => {
    expect(isValidPublicStorageValue('lineops.expiry.history', [{ id: 'orphan', lineId: 'a', lineName: 'A', elementLabel: 'Recharge de cuve', changedAt: 'invalid', newExpiresAt: 'invalid', operator: 'Test' }])).toBe(true);
  });
});

describe('chronology, references and calendar progress', () => {
  it('rejects an absent/duplicate line and an invalid clock', () => {
    expect(prepareDeclaration([], 'a', 'replacement', draft, now, 'id').ok).toBe(false);
    expect(prepareDeclaration([fixture(), fixture()], 'a', 'replacement', draft, now, 'id').ok).toBe(false);
    expect(prepareDeclaration([fixture()], 'a', 'replacement', draft, new Date('invalid'), 'id').ok).toBe(false);
  });
  it('rejects blank/long vat references and refills on an expired block', () => {
    for (const vat of ['  ', 'X'.repeat(121)]) expect(prepareDeclaration([fixture()], 'a', 'refill', { ...draft, vat }, now, 'id')).toMatchObject({ ok: false, error: { field: 'vat' } });
    expect(prepareDeclaration([fixture()], 'a', 'refill', { ...draft, changedAt: '2026-09-21T14:00' }, new Date('2026-09-21T12:00:30Z'), 'id')).toMatchObject({ ok: false, error: { field: 'changedAt' } });
  });
  it('checks the selected overlap occurrence against now, not the wall-clock string', () => {
    const line = fixture();
    line.elements[0].lastChangedAt = '2026-10-23T00:00:00Z';
    line.elements[0].expiresAt = '2026-10-28T00:00:00Z';
    const input = { ...draft, changedAt: '2026-10-25T02:30' };
    const clock = new Date('2026-10-25T00:45:00Z');
    expect(prepareDeclaration([line], 'a', 'replacement', input, clock, 'id')).toMatchObject({ ok: false, error: { field: 'occurrence' } });
    expect(prepareDeclaration([line], 'a', 'replacement', { ...input, occurrence: 'earlier' }, clock, 'id').ok).toBe(true);
    expect(prepareDeclaration([line], 'a', 'replacement', { ...input, occurrence: 'later' }, clock, 'id')).toMatchObject({ ok: false, error: { field: 'changedAt' } });
  });
  it.each(['2026-03-24T11:00:00.000Z', '2026-10-20T10:00:00.000Z'])('uses the actual %s validity interval for the bar', (start) => {
    const line = fixture();
    Object.assign(line.elements[0], { lastChangedAt: start, expiresAt: addCalendarDays(start, 5, 'Europe/Paris'), timeZone: 'Europe/Paris', validityRule: CALENDAR_DAYS_RULE });
    const end = Date.parse(line.elements[0].expiresAt);
    expect(remainingValidityPercent(line, new Date(start))).toBe(100);
    expect(remainingValidityPercent(line, new Date((Date.parse(start) + end) / 2))).toBe(50);
    expect(remainingValidityPercent(line, new Date(end))).toBe(0);
  });
  it('fails calculation outside the supported calendar before returning any new event', () => {
    const line = fixture();
    Object.assign(line.elements[0], { lastChangedAt: '9999-12-25T00:00:00Z', expiresAt: '9999-12-30T00:00:00Z' });
    expect(prepareDeclaration([line], 'a', 'replacement' as DeclarationKind, { ...draft, changedAt: '9999-12-31T00:00', timeZone: 'UTC' }, new Date('9999-12-31T01:00:00Z'), 'id')).toMatchObject({ ok: false, error: { field: 'changedAt' } });
  });
});
