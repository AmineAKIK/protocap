import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PackingCalculatorPage } from './PackingCalculatorPage';

const formStorageKey = 'lineops.packing.form.inputs.v8';

describe('PackingCalculatorPage persisted-state recovery', () => {
  it('renders the safe default instead of crashing on syntactically valid wrong-schema JSON', async () => {
    localStorage.setItem(formStorageKey, JSON.stringify({ quantity: 30880 }));

    render(<PackingCalculatorPage />);

    expect((screen.getByLabelText('Quantité demandée en unités') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Unités par carton') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Cartons par palette') as HTMLInputElement).value).toBe('');

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(formStorageKey) ?? 'null')).toEqual({
        quantity: '',
        unitsPerCarton: '',
        cartonsPerPalette: '',
        policy: 'no-overrun',
      });
    });
  });
});
