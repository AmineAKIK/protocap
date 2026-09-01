import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PackingCalculatorPage } from './PackingCalculatorPage';

const formStorageKey = 'lineops.packing.form.inputs.v8';
const trackingStorageKey = 'lineops.packing.shipment.progress.v8';

function storePackingForm(quantity = '30880') {
  localStorage.setItem(
    formStorageKey,
    JSON.stringify({
      quantity,
      unitsPerCarton: '128',
      cartonsPerPalette: '40',
      policy: 'round-carton',
    }),
  );
}

describe('PackingCalculatorPage shipment tracking', () => {
  it('groups the exact result under the reference parameters and keeps operations together', () => {
    storePackingForm();
    render(<PackingCalculatorPage />);

    const referenceColumn = screen.getByRole('region', { name: 'Référence et résultat exact' });
    expect(within(referenceColumn).getByRole('heading', { name: 'Paramètres de référence' })).toBeTruthy();
    expect(within(referenceColumn).getByRole('heading', { name: 'Résultat exact' })).toBeTruthy();

    const operationsColumn = screen.getByRole('region', { name: 'Découpage final et suivi manuel' });
    expect(within(operationsColumn).getByText('Découpage final sélectionné')).toBeTruthy();
    expect(within(operationsColumn).getByRole('heading', { name: 'Palettes à expédier' })).toBeTruthy();
    expect(within(operationsColumn).queryByRole('heading', { name: 'Résultat exact' })).toBeNull();
  });

  it('counts the remainder load as a pallet and persists manual dispatch progress', async () => {
    const user = userEvent.setup();
    storePackingForm();

    const view = render(<PackingCalculatorPage />);

    expect(screen.getByLabelText('7 palettes restantes')).toBeTruthy();
    expect(screen.getByLabelText('0 palettes envoyées sur 7')).toBeTruthy();

    const increment = screen.getByRole('button', { name: 'Déclarer une palette envoyée' });
    const decrement = screen.getByRole('button', { name: 'Retirer une palette envoyée' });
    await user.click(increment);
    await user.click(increment);
    await user.click(decrement);

    expect(screen.getByLabelText('6 palettes restantes')).toBeTruthy();
    expect(screen.getByLabelText('1 palette envoyée sur 7')).toBeTruthy();
    await waitFor(() =>
      expect(localStorage.getItem(trackingStorageKey)).toContain('"30880:128:40:round-carton":1'),
    );

    view.unmount();
    render(<PackingCalculatorPage />);

    expect(screen.getByLabelText('6 palettes restantes')).toBeTruthy();
    expect(screen.getByLabelText('1 palette envoyée sur 7')).toBeTruthy();
  });

  it('keeps the counter within bounds and offers an explicit reset', async () => {
    const user = userEvent.setup();
    storePackingForm('30720');
    render(<PackingCalculatorPage />);

    const decrement = screen.getByRole('button', { name: 'Retirer une palette envoyée' });
    const increment = screen.getByRole('button', { name: 'Déclarer une palette envoyée' });
    expect((decrement as HTMLButtonElement).disabled).toBe(true);

    for (let pallet = 0; pallet < 6; pallet += 1) {
      await user.click(increment);
    }

    expect(screen.getByLabelText('0 palettes restantes')).toBeTruthy();
    expect((increment as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Toutes les palettes prévues ont été déclarées comme envoyées.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Réinitialiser le suivi' }));

    expect(screen.getByLabelText('6 palettes restantes')).toBeTruthy();
    expect(screen.getByLabelText('0 palettes envoyées sur 6')).toBeTruthy();
    expect((decrement as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps a distinct counter for each calculation and restores previous progress', async () => {
    const user = userEvent.setup();
    storePackingForm('30720');
    render(<PackingCalculatorPage />);

    await user.click(screen.getByRole('button', { name: 'Déclarer une palette envoyée' }));
    expect(screen.getByLabelText('1 palette envoyée sur 6')).toBeTruthy();

    const quantity = screen.getByLabelText('Quantité demandée en unités');
    await user.clear(quantity);
    await user.type(quantity, '30880');

    expect(screen.getByLabelText('7 palettes restantes')).toBeTruthy();
    expect(screen.getByLabelText('0 palettes envoyées sur 7')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Déclarer une palette envoyée' }));
    await user.click(screen.getByRole('button', { name: 'Déclarer une palette envoyée' }));
    expect(screen.getByLabelText('2 palettes envoyées sur 7')).toBeTruthy();

    await user.clear(quantity);
    await user.type(quantity, '30720');

    expect(screen.getByLabelText('5 palettes restantes')).toBeTruthy();
    expect(screen.getByLabelText('1 palette envoyée sur 6')).toBeTruthy();
    await waitFor(() => {
      const storedProgress = JSON.parse(localStorage.getItem(trackingStorageKey) ?? '{}') as {
        progressByCalculation?: Record<string, number>;
      };
      expect(storedProgress.progressByCalculation).toEqual({
        '30720:128:40:round-carton': 1,
        '30880:128:40:round-carton': 2,
      });
    });
  });
});
