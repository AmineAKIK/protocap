import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PackingCalculatorPage } from './PackingCalculatorPage';

const formStorageKey = 'lineops.packing.form.inputs.v8';
const activeRunStorageKey = 'lineops.packing.active-run.v1';

describe('PackingCalculatorPage persisted-state recovery', () => {
  it('renders the safe default instead of crashing on syntactically valid wrong-schema JSON', async () => {
    localStorage.setItem(formStorageKey, JSON.stringify({ quantity: 30880 }));

    render(<PackingCalculatorPage />);

    expect((screen.getByLabelText('Quantité demandée') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Unités par carton') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Cartons par palette') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Début OC') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Cadence réf.') as HTMLInputElement).value).toBe('');
    expect(screen.getByText(/Une préparation locale invalide a été ignorée/)).toBeTruthy();

    expect(localStorage.getItem(formStorageKey)).toBe(JSON.stringify({ quantity: 30880 }));
  });

  it('keeps the recovery warning visible when an active run is restored at the same time', () => {
    localStorage.setItem(formStorageKey, '{not-json');
    localStorage.setItem(activeRunStorageKey, JSON.stringify({
      schemaVersion: 2,
      activeRun: {
        id: 'run-recovered-draft',
        createdAt: '2026-09-15T07:30:00.000Z',
        productionStartedAt: '2026-09-15T07:30:00.000Z',
        requestedUnits: 100,
        unitsPerCarton: 10,
        cartonsPerLoad: 10,
        selectedPolicy: 'no-overrun',
        plannedUnits: 100,
        referenceCadenceUnitsPerMinute: 60,
        declarations: [],
      },
    }));

    render(<PackingCalculatorPage />);

    expect(screen.getByRole('heading', { name: 'Conduite de production' })).toBeTruthy();
    expect(screen.getByLabelText('Préparation figée').textContent)
      .toContain('Une préparation locale invalide a été ignorée');
  });

  it('keeps legacy input values while removing the superseded persisted policy', async () => {
    localStorage.setItem(formStorageKey, JSON.stringify({
      quantity: '30880',
      unitsPerCarton: '128',
      cartonsPerPalette: '40',
      policy: 'round-carton',
    }));

    render(<PackingCalculatorPage />);

    expect((screen.getByLabelText('Quantité demandée') as HTMLInputElement).value).toBe('30880');
    expect((screen.getByLabelText('Unités par carton') as HTMLInputElement).value).toBe('128');
    expect((screen.getByLabelText('Cartons par palette') as HTMLInputElement).value).toBe('40');
    expect((screen.getByLabelText('Début OC') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Cadence réf.') as HTMLInputElement).value).toBe('');

    expect(JSON.parse(localStorage.getItem(formStorageKey) ?? 'null')).toEqual({
      quantity: '30880',
      unitsPerCarton: '128',
      cartonsPerPalette: '40',
      policy: 'round-carton',
    });
  });
});
