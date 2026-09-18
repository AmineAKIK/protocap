import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LogisticsRequest } from '../types/logistics';
import { LogisticsCallPage } from './LogisticsCallPage';

const key = 'lineops.logistics.requests.v8';
const historicClosed: LogisticsRequest = {
  id: 'LOG-250', line: 'Ligne de conditionnement A', zone: 'Sortie', palletCount: 1,
  priority: 'normal', nature: 'Palette pleine à évacuer', createdAt: '2026-09-18T08:00:00.000Z',
  status: 'pickedUp',
};

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(new Date('2026-09-18T09:00:00.000Z'));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

function submitForm() {
  fireEvent.submit(screen.getByRole('button', { name: /Enregistrer l'appel logistique/ }).closest('form')!);
}

describe('Logistics reliable persistence', () => {
  it('T11/T42: failed creation keeps every field, shows an accessible error, and never shows success', async () => {
    render(<LogisticsCallPage />);
    fireEvent.change(screen.getByLabelText('Zone de ligne'), { target: { value: 'Zone retry' } });
    fireEvent.change(screen.getByLabelText('Palettes'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Commentaire'), { target: { value: 'Brouillon conservé' } });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });

    submitForm();

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('quota');
    await waitFor(() => expect(document.activeElement).toBe(alert));
    expect((screen.getByLabelText('Zone de ligne') as HTMLInputElement).value).toBe('Zone retry');
    expect((screen.getByLabelText('Palettes') as HTMLInputElement).value).toBe('3');
    expect((screen.getByLabelText('Commentaire') as HTMLTextAreaElement).value).toBe('Brouillon conservé');
    expect(screen.queryByText(/enregistré localement/)).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('T12/T21: retry after one failed write persists one stable request and resets only after success', () => {
    render(<LogisticsCallPage />);
    fireEvent.change(screen.getByLabelText('Zone de ligne'), { target: { value: 'Zone retry' } });
    fireEvent.change(screen.getByLabelText('Commentaire'), { target: { value: 'Même opération' } });
    const original = Storage.prototype.setItem;
    let fail = true;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(this: Storage, storedKey: string, value: string) {
      if (storedKey === key && fail) { fail = false; throw new DOMException('Full', 'QuotaExceededError'); }
      return original.call(this, storedKey, value);
    });

    submitForm();
    submitForm();

    const stored = JSON.parse(localStorage.getItem(key) ?? '[]') as LogisticsRequest[];
    expect(stored.filter((request) => request.zone === 'Zone retry')).toHaveLength(1);
    expect(stored.filter((request) => request.comment === 'Même opération')).toHaveLength(1);
    expect(screen.getByText(/enregistré localement/)).toBeTruthy();
    expect((screen.getByLabelText('Zone de ligne') as HTMLInputElement).value).toBe('Sortie conditionnement');
  });

  it('T20: terminal legacy data without completedAt stays unknown and is never rewritten', () => {
    localStorage.setItem(key, JSON.stringify([historicClosed]));
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    writes.mockClear();

    render(<LogisticsCallPage />);
    fireEvent.click(screen.getByText(/Terminées \/ Annulées/));

    expect(screen.getByText('Clôture : heure inconnue')).toBeTruthy();
    expect(screen.getByText('Durée inconnue')).toBeTruthy();
    expect(writes).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(key) ?? 'null')).toEqual([historicClosed]);
  });

  it('T22/T42: cancellation requires explicit confirmation and becomes terminal', () => {
    const active = { ...historicClosed, status: 'waiting' as const, completedAt: undefined };
    localStorage.setItem(key, JSON.stringify([active]));
    render(<LogisticsCallPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.getByRole('dialog', { name: 'Confirmer l’annulation' })).toBeTruthy();
    expect((JSON.parse(localStorage.getItem(key) ?? '[]') as LogisticsRequest[])[0].status).toBe('waiting');

    fireEvent.click(screen.getByRole('button', { name: 'Confirmer l’annulation' }));
    const stored = JSON.parse(localStorage.getItem(key) ?? '[]') as LogisticsRequest[];
    expect(stored[0].status).toBe('cancelled');
    expect(stored[0].completedAt).toBe('2026-09-18T09:00:00.000Z');
    fireEvent.click(screen.getByText(/Terminées \/ Annulées/));
    expect(screen.queryByRole('button', { name: 'Annuler' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Récupéré' })).toBeNull();
  });
});
