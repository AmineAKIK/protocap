import { describe, expect, it } from 'vitest';
import type { ConditioningLine, ContactElement } from '../types/expiry';
import { formatDate, formatDateTime, hoursUntil } from './date';
import { getElementStatus, getLineStatus } from './expiry';

const now = new Date('2026-08-24T12:00:00.000Z');

function element(expiresAt: string): ContactElement {
  return {
    type: 'fillingBlock',
    label: 'Bloc',
    lastChangedAt: '2026-08-20T12:00:00.000Z',
    expiresAt,
    validityDays: 5,
    operator: 'Test',
  };
}

function line(expiresAt: string): ConditioningLine {
  return {
    id: 'line-1',
    name: 'Ligne 1',
    product: 'Produit',
    vat: 'Cuve 1',
    conditioningStartedAt: '2026-08-20T12:00:00.000Z',
    elements: [element(expiresAt)],
  };
}

describe('expiry fail-safe semantics', () => {
  it('classifies an invalid expiry as expired instead of OK', () => {
    expect(getElementStatus(element('not-a-date'), now)).toBe('expired');
    expect(getLineStatus(line('not-a-date'), now)).toBe('nonConform');
  });

  it('preserves expiration and 48-hour warning boundaries', () => {
    expect(getElementStatus(element('2026-08-24T12:00:00.000Z'), now)).toBe('expired');
    expect(getElementStatus(element('2026-08-26T12:00:00.000Z'), now)).toBe('warning');
    expect(getElementStatus(element('2026-08-26T12:00:00.001Z'), now)).toBe('ok');
  });

  it('makes invalid dates explicit in shared display helpers', () => {
    expect(hoursUntil('not-a-date', now)).toBe(Number.NEGATIVE_INFINITY);
    expect(formatDate('not-a-date')).toBe('Date invalide');
    expect(formatDateTime('not-a-date')).toBe('Date invalide');
  });
});
