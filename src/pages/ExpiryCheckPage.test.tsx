import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { ConditioningLine } from '../types/expiry';
import { browserTimeZone, formatLocalMinute } from '../features/expiry/time';
import { ExpiryCheckPage } from './ExpiryCheckPage';

const linesKey = 'lineops.expiry.lines.v8';
const historyKey = 'lineops.expiry.history.v8';
const aggregateKey = 'lineops.expiry.aggregate.v2';
const now = new Date('2026-09-17T12:00:30.000Z');
function fixture(): ConditioningLine {
  return { id: 'a', name: 'Ligne de conditionnement A', vat: 'Cuve 1', product: 'Produit fictif', conditioningStartedAt: '2026-09-15T12:00:00.000Z', elements: [{ type: 'fillingBlock', label: 'Bloc', lastChangedAt: '2026-09-15T12:00:00.000Z', expiresAt: '2026-09-20T12:00:00.000Z', validityDays: 5, operator: 'Fixture' }] };
}
function seed(lines: ConditioningLine[] = [fixture()], history: unknown[] = []) {
  localStorage.setItem(linesKey, JSON.stringify(lines));
  localStorage.setItem(historyKey, JSON.stringify(history));
  localStorage.setItem(aggregateKey, JSON.stringify({
    schemaVersion: 2,
    revision: 1,
    lines,
    history,
  }));
}
function snapshot() { return [localStorage.getItem(linesKey), localStorage.getItem(historyKey)]; }
function aggregate() {
  return JSON.parse(localStorage.getItem(aggregateKey) ?? 'null') as {
    schemaVersion: 2;
    revision: number;
    lines: ConditioningLine[];
    history: { id: string; changedAt: string; newExpiresAt: string; timeZone?: string; operator: string }[];
  } | null;
}
function open(kind: 'replacement' | 'refill') {
  fireEvent.click(screen.getByRole('button', { name: kind === 'replacement' ? 'Déclarer un remplacement' : 'Ajouter une recharge de cuve' }));
}
async function submit(kind: 'replacement' | 'refill') {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: kind === 'replacement' ? 'Valider le remplacement' : 'Tracer la recharge' }));
  });
}
function dateInput(kind: 'replacement' | 'refill') {
  return screen.getByLabelText(kind === 'replacement' ? 'Date / heure du remplacement' : 'Date / heure');
}

beforeEach(() => { localStorage.clear(); vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] }); vi.setSystemTime(now); seed(); });
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
    await submit(kind);
    expect(screen.getByRole('alert').textContent).toContain('future');
    expect(writes).not.toHaveBeenCalled();
    expect(snapshot()).toEqual(before);
    expect((dateInput(kind) as HTMLInputElement).value).toBe(future);
    expect((screen.getByLabelText('Commentaire') as HTMLTextAreaElement).value).toBe('Brouillon conservé');
    await waitFor(() => expect(document.activeElement).toBe(dateInput(kind)));
  });
  it('T03: refuses empty dates and whitespace-only operators through the real handler', async () => {
    render(<ExpiryCheckPage />); open(kind);
    const before = snapshot();
    fireEvent.change(dateInput(kind), { target: { value: '' } }); await submit(kind);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(snapshot()).toEqual(before);
    fireEvent.change(dateInput(kind), { target: { value: formatLocalMinute(now, browserTimeZone()) } });
    fireEvent.change(screen.getByLabelText('Opérateur'), { target: { value: '   ' } }); await submit(kind);
    expect(screen.getByLabelText('Opérateur').getAttribute('aria-invalid')).toBe('true');
    expect(snapshot()).toEqual(before);
  });
  it('T01: persists matching UTC state/event and retains it across remount', async () => {
    const view = render(<ExpiryCheckPage />); open(kind);
    fireEvent.change(screen.getByLabelText('Opérateur'), { target: { value: 'Alice' } });
    if (kind === 'refill') fireEvent.change(screen.getByLabelText('Cuve rechargée'), { target: { value: 'Cuve 2' } });
    await submit(kind);
    expect(screen.queryByRole('dialog')).toBeNull();
    const stored = aggregate();
    expect(stored?.schemaVersion).toBe(2);
    const storedLines = stored!.lines;
    const events = stored!.history;
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
    const sourceBefore = snapshot();
    const aggregateBefore = localStorage.getItem(aggregateKey);
    view.unmount(); render(<ExpiryCheckPage />);
    expect(snapshot()).toEqual(sourceBefore);
    expect(localStorage.getItem(aggregateKey)).toBe(aggregateBefore);
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
    seed([fixture()], [entry]);
    const before = snapshot(); render(<ExpiryCheckPage />);
    expect(screen.getByText(/Traces non rattachables/)).toBeTruthy();
    expect(screen.getByText('date-inconnue')).toBeTruthy();
    expect(snapshot()).toEqual(before);
  });
});


describe('PR-04 live clock coherence', () => {
  function statValue(label: string) {
    const labelNode = screen.getByText(label, { exact: true, selector: 'p' });
    return within(labelNode.parentElement as HTMLElement);
  }

  it('T06: crosses the 48-hour warning and expiry boundaries without interaction or storage mutation', () => {
    const line = fixture();
    line.elements[0].expiresAt = '2026-09-19T13:00:30.000Z'; // 49 h from the test clock.
    seed([line]);
    const before = snapshot();
    render(<ExpiryCheckPage />);

    expect(screen.getByText(/Démarrage de la ligne autorisé/)).toBeTruthy();
    expect(statValue('OK').getByText('1')).toBeTruthy();
    expect(statValue('Vigilance').getByText('0')).toBeTruthy();
    expect(statValue('Bloqués').getByText('0')).toBeTruthy();

    act(() => {
      vi.setSystemTime(new Date('2026-09-17T13:00:30.000Z'));
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText(/Vigilance — bloc de remplissage/)).toBeTruthy();
    expect(statValue('OK').getByText('0')).toBeTruthy();
    expect(statValue('Vigilance').getByText('1')).toBeTruthy();
    expect(screen.getAllByText('Bientôt expiré').length).toBeGreaterThan(0);

    act(() => {
      vi.setSystemTime(new Date('2026-09-19T13:00:30.000Z'));
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText(/démarrage non conforme/i)).toBeTruthy();
    expect(statValue('Vigilance').getByText('0')).toBeTruthy();
    expect(statValue('Bloqués').getByText('1')).toBeTruthy();
    expect(screen.getAllByText('Expiré').length).toBeGreaterThan(0);
    expect((screen.getByRole('button', { name: 'Ajouter une recharge de cuve' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Calcul local · validité estimée/)).toBeTruthy();
    expect(snapshot()).toEqual(before);
  });

  it('T08: an already-open refill form revalidates against the current clock before any write', async () => {
    const line = fixture();
    line.elements[0].expiresAt = '2026-09-17T12:30:30.000Z';
    seed([line]);
    render(<ExpiryCheckPage />);
    open('refill');
    fireEvent.change(screen.getByLabelText('Opérateur'), { target: { value: 'Alice' } });
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    writes.mockClear();
    const before = snapshot();

    // Do not tick useNow: the form is intentionally stale while wall time advances.
    vi.setSystemTime(new Date('2026-09-17T12:31:30.000Z'));
    await submit('refill');

    expect(screen.getByRole('alert').textContent).toContain('expiré');
    expect(writes).not.toHaveBeenCalled();
    expect(snapshot()).toEqual(before);
  });
});

describe('PR-06 aggregate persistence and recovery', () => {
  it('T14: migrates both v8 keys into one aggregate and preserves source bytes across remount', async () => {
    localStorage.removeItem(aggregateKey);
    const sourceBefore = snapshot();
    const view = render(<ExpiryCheckPage />);
    await waitFor(() => expect(localStorage.getItem(aggregateKey)).not.toBeNull());
    const firstAggregate = localStorage.getItem(aggregateKey);
    expect(aggregate()?.lines).toEqual([fixture()]);
    expect(aggregate()?.history).toEqual([]);
    expect(snapshot()).toEqual(sourceBefore);

    view.unmount();
    render(<ExpiryCheckPage />);
    expect(localStorage.getItem(aggregateKey)).toBe(firstAggregate);
    expect(snapshot()).toEqual(sourceBefore);
  });

  it('T13/T21/T42: failed aggregate write keeps state and trace together, draft visible, then retry commits once', async () => {
    render(<ExpiryCheckPage />);
    await waitFor(() => expect(localStorage.getItem(aggregateKey)).not.toBeNull());
    const sourceBefore = snapshot();
    const aggregateBefore = localStorage.getItem(aggregateKey);
    open('replacement');
    fireEvent.change(screen.getByLabelText('Opérateur'), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByLabelText('Commentaire'), { target: { value: 'Retry stable' } });

    const original = Storage.prototype.setItem;
    let fail = true;
    const set = vi.spyOn(Storage.prototype, 'setItem');
    set.mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === aggregateKey && fail) {
        fail = false;
        throw new DOMException('Full', 'QuotaExceededError');
      }
      return original.call(this, key, value);
    });

    await submit('replacement');
    expect(screen.getByRole('alert').textContent).toMatch(/quota/i);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect((screen.getByLabelText('Commentaire') as HTMLTextAreaElement).value).toBe('Retry stable');
    expect(localStorage.getItem(aggregateKey)).toBe(aggregateBefore);
    expect(snapshot()).toEqual(sourceBefore);

    await submit('replacement');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const stored = aggregate()!;
    expect(stored.history.filter((entry) => entry.operator === 'Alice')).toHaveLength(1);
    expect(stored.lines[0].elements[0].operator).toBe('Alice');
    expect(snapshot()).toEqual(sourceBefore);
  });

  it('T15/T42: a future aggregate version makes current evidence read-only without rewriting it', () => {
    localStorage.setItem('lineops.expiry.aggregate.v3', JSON.stringify({ schemaVersion: 3, future: true }));
    const before = snapshot();
    const current = localStorage.getItem(aggregateKey);
    render(<ExpiryCheckPage />);

    expect(screen.getByRole('alert').textContent).toMatch(/lecture seule/i);
    expect((screen.getByRole('button', { name: 'Déclarer un remplacement' }) as HTMLButtonElement).disabled).toBe(true);
    expect(localStorage.getItem(aggregateKey)).toBe(current);
    expect(snapshot()).toEqual(before);
  });

  it('T16: orphan history remains visible with its raw suspicious timestamp and no global time shift', async () => {
    const orphan = {
      id: 'orphan-global', lineId: 'missing-line', lineName: 'Ligne disparue', elementLabel: 'Bloc de remplissage',
      changedAt: 'date-inconnue', newExpiresAt: 'date-inconnue', operator: 'Archive',
    };
    localStorage.setItem(historyKey, JSON.stringify([orphan]));
    localStorage.removeItem(aggregateKey);
    const sourceBefore = snapshot();
    render(<ExpiryCheckPage />);
    await waitFor(() => expect(localStorage.getItem(aggregateKey)).not.toBeNull());

    expect(screen.getByText(/Traces orphelines/)).toBeTruthy();
    expect(screen.getByText('date-inconnue')).toBeTruthy();
    expect(screen.getByText(/Ligne disparue/)).toBeTruthy();
    expect(snapshot()).toEqual(sourceBefore);
    expect(aggregate()?.history[0].changedAt).toBe('date-inconnue');
  });
});
