import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpiryCheckPage } from './ExpiryCheckPage';

// Deliberately imports no PR-03-only helper: the same tests run unchanged on the PR-02 parent.
// Native local getters provide an independent expected value, not the implementation under test.
const now = new Date('2026-09-17T12:00:30.000Z');
const linesKey = 'lineops.expiry.lines.v8';
const historyKey = 'lineops.expiry.history.v8';
function localMinute(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
  localStorage.clear();
  localStorage.setItem(linesKey, JSON.stringify([{
    id: 'a', name: 'Ligne de conditionnement A', product: 'Produit fictif', vat: 'Cuve 1',
    conditioningStartedAt: '2026-09-15T12:00:00.000Z',
    elements: [{ type: 'fillingBlock', label: 'Bloc', lastChangedAt: '2026-09-15T12:00:00.000Z',
      expiresAt: '2026-09-20T12:00:00.000Z', validityDays: 5, operator: 'Fixture' }],
  }]));
  localStorage.setItem(historyKey, '[]');
});
afterEach(() => { vi.useRealTimers(); });

describe('portable parent-to-candidate temporal regressions', () => {
  it('T01: replacement prefill is the actual local minute', () => {
    render(<ExpiryCheckPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Déclarer un remplacement' }));
    expect((screen.getByLabelText('Date / heure du remplacement') as HTMLInputElement).value).toBe(localMinute(now));
  });
  for (const kind of ['replacement', 'refill'] as const) {
    it(`T04: future ${kind} does not mutate either store`, () => {
      render(<ExpiryCheckPage />);
      fireEvent.click(screen.getByRole('button', {
        name: kind === 'replacement' ? 'Déclarer un remplacement' : 'Ajouter une recharge de cuve',
      }));
      const writes = vi.spyOn(Storage.prototype, 'setItem');
      const snapshot = () => [localStorage.getItem(linesKey), localStorage.getItem(historyKey)];
      const before = snapshot();
      const input = screen.getByLabelText(kind === 'replacement' ? 'Date / heure du remplacement' : 'Date / heure');
      const future = localMinute(new Date(now.getTime() + 7_200_000));
      fireEvent.change(input, { target: { value: future } });
      fireEvent.change(screen.getByLabelText('Opérateur'), { target: { value: 'Fixture' } });
      fireEvent.change(screen.getByLabelText('Commentaire'), { target: { value: 'Brouillon conservé' } });
      fireEvent.click(screen.getByRole('button', {
        name: kind === 'replacement' ? 'Valider le remplacement' : 'Tracer la recharge',
      }));
      expect(writes).not.toHaveBeenCalled();
      expect(snapshot()).toEqual(before);
      expect(screen.getByRole('alert').textContent).toContain('future');
      expect((input as HTMLInputElement).value).toBe(future);
      expect((screen.getByLabelText('Commentaire') as HTMLTextAreaElement).value).toBe('Brouillon conservé');
    });
  }
});
