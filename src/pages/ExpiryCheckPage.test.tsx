import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { ConditioningLine } from '../types/expiry';
import { browserTimeZone, formatLocalMinute } from '../features/expiry/time';
import { ExpiryCheckPage } from './ExpiryCheckPage';

const linesKey = 'lineops.expiry.lines.v8';
const historyKey = 'lineops.expiry.history.v8';
const now = new Date('2026-09-17T12:00:30.000Z');
function fixture(): ConditioningLine {
  return { id: 'a', name: 'Ligne de conditionnement A', vat: 'Cuve 1', product: 'Produit fictif', conditioningStartedAt: '2026-09-15T12:00:00.000Z', elements: [{ type: 'fillingBlock', label: 'Bloc', lastChangedAt: '2026-09-15T12:00:00.000Z', expiresAt: '2026-09-20T12:00:00.000Z', validityDays: 5, operator: 'Fixture' }] };
}
function seed(lines: ConditioningLine[] = [fixture()]) {
  localStorage.setItem(linesKey, JSON.stringify(lines));
  localStorage.setItem(historyKey, '[]');
}
function snapshot() { return [localStorage.getItem(linesKey), localStorage.getItem(historyKey)]; }
function open(kind: 'replacement' | 'refill') {
  fireEvent.click(screen.getByRole('button', { name: kind === 'replacement' ? 'Déclarer un remplacement' : 'Ajouter une recharge de cuve' }));
}
function submit(kind: 'replacement' | 'refill') {
  fireEvent.click(screen.getByRole('button', { name: kind === 'replacement' ? 'Valider le remplacement' : 'Tracer la recharge' }));
}
function dateInput(kind: 'replacement' | 'refill') {
  return screen.getByLabelText(kind === 'replacement' ? 'Date / heure du remplacement' : 'Date / heure');
}

beforeEach(() => { localStorage.clear(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now); seed(); });
afterEach(() => { vi.useRealTimers(); });

for (const kind of ['replacement', 'refill'] as const) describe(`real page ${kind} integration`, () => {
  it('T04: refuses future input without a storage write and preserves the complete draft', async () => {
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    render(<ExpiryCheckPage />);
    open(kind);
    writes.mockClear();
    const before = snapshot();
    const future = formatLocalMinute(new Date(now.getTime() + 3600000), browserTimeZone());
    fireEvent.change(dateInput(kind), { target: { value: future } });
    fireEvent.change(screen.getByLabelText('Opérateur'), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByLabelText('Commentaire'), { target: { value: 'Brouillon conservé' } });
    if (kind === 'refill') fireEvent.change(screen.getByLabelText('Cuve rechargée'), { target: { value: 'Cuve 2' } });
    submit(kind);
    expect(screen.getByRole('alert').textContent).toContain('future');
    expect(writes).not.toHaveBeenCalled();
    expect(snapshot()).toEqual(before);
    expect((dateInput(kind) as HTMLInputElement).value).toBe(future);
    expect((screen.getByLabelText('Commentaire') as HTMLTextAreaElement).value).toBe('Brouillon conservé');
    await waitFor(() => expect(document.activeElement).toBe(dateInput(kind)));
  });
  it('T03: refuses empty dates and whitespace-only operators through the real handler', () => {
    render(<ExpiryCheckPage />); open(kind);
    const before = snapshot();
    fireEvent.change(dateInput(kind), { target: { value: '' } }); submit(kind);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(snapshot()).toEqual(before);
    fireEvent.change(dateInput(kind), { target: { value: formatLocalMinute(now, browserTimeZone()) } });
    fireEvent.change(screen.getByLabelText('Opérateur'), { target: { value: '   ' } }); submit(kind);
    expect(screen.getByLabelText('Opérateur').getAttribute('aria-invalid')).toBe('true');
    expect(snapshot()).toEqual(before);
  });
  it('T01: persists matching UTC state/event and retains it across remount', () => {
    const view = render(<ExpiryCheckPage />); open(kind);
    fireEvent.change(screen.getByLabelText('Opérateur'), { target: { value: 'Alice' } });
    if (kind === 'refill') fireEvent.change(screen.getByLabelText('Cuve rechargée'), { target: { value: 'Cuve 2' } });
    submit(kind);
    expect(screen.queryByRole('dialog')).toBeNull();
    const storedLines = JSON.parse(localStorage.getItem(linesKey)!) as ConditioningLine[];
    const events = JSON.parse(localStorage.getItem(historyKey)!) as { changedAt: string; newExpiresAt: string; timeZone: string }[];
    expect(events).toHaveLength(1);
    expect(events[0].changedAt).toBe('2026-09-17T12:00:00.000Z');
    expect(events[0].timeZone).toBe(browserTimeZone());
    if (kind === 'replacement') {
      expect(storedLines[0].elements[0].lastChangedAt).toBe(events[0].changedAt);
      expect(storedLines[0].elements[0].expiresAt).toBe(events[0].newExpiresAt);
    } else {
      expect(storedLines[0].vat).toBe('Cuve 2');
      expect(storedLines[0].elements).toEqual(fixture().elements);
    }
    const before = snapshot(); view.unmount(); render(<ExpiryCheckPage />);
    expect(snapshot()).toEqual(before);
  });
});

describe('T05/T16: readable suspicious data is never normalized into a green demo', () => {
  it.each(['future', 'invalid', 'missing'] as const)('renders a %s block without crashing or rewriting dates', (scenario) => {
    const line = fixture();
    if (scenario === 'future') line.elements[0].lastChangedAt = '2026-09-18T12:00:00.000Z';
    if (scenario === 'invalid') line.elements[0].expiresAt = '2026-02-30T12:00:00.000Z';
    if (scenario === 'missing') line.elements = [];
    seed([line]); const before = snapshot(); render(<ExpiryCheckPage />);
    expect(screen.getAllByText('État à vérifier').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Démarrage de la ligne autorisé/)).toBeNull();
    expect(snapshot()).toEqual(before);
    expect((screen.getByRole('button', { name: 'Déclarer un remplacement' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('keeps an empty dataset empty instead of inserting demonstration lines', () => {
    seed([]); render(<ExpiryCheckPage />);
    expect(screen.getByRole('heading', { name: 'Expiry Check' })).toBeTruthy();
    expect(screen.getByText(/Aucune ligne exploitable/)).toBeTruthy();
    expect(localStorage.getItem(linesKey)).toBe('[]');
  });
  it('displays ungroupable legacy history without changing it or fabricating a date', () => {
    const entry = { id: 'orphan', lineId: 'a', lineName: 'A', elementLabel: 'Recharge de cuve', changedAt: 'date-inconnue', newExpiresAt: 'invalid', operator: 'Fixture', comment: 'Trace à préserver' };
    localStorage.setItem(historyKey, JSON.stringify([entry]));
    const before = snapshot(); render(<ExpiryCheckPage />);
    expect(screen.getByText(/Traces non rattachables/)).toBeTruthy();
    expect(screen.getByText('date-inconnue')).toBeTruthy();
    expect(snapshot()).toEqual(before);
  });
});
