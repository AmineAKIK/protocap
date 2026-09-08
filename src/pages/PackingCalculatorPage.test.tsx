import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PackingCalculatorPage } from './PackingCalculatorPage';

const formStorageKey = 'lineops.packing.form.inputs.v8';
const trackingStorageKey = 'lineops.packing.shipment.progress.v8';

function storePackingForm(quantity = '30880', policy = 'round-carton') {
  localStorage.setItem(
    formStorageKey,
    JSON.stringify({
      quantity,
      unitsPerCarton: '128',
      cartonsPerPalette: '40',
      policy,
    }),
  );
}

describe('PackingCalculatorPage premium workshop flow', () => {
  it('keeps reference theory separate from the active operational plan', () => {
    storePackingForm();
    render(<PackingCalculatorPage />);

    const referenceColumn = screen.getByRole('region', { name: 'Référence et résultat exact' });
    expect(within(referenceColumn).getByRole('heading', { name: 'Paramètres de référence' })).toBeTruthy();
    expect(within(referenceColumn).getByRole('heading', { name: 'Résultat exact' })).toBeTruthy();

    const operationsColumn = screen.getByRole('region', { name: 'Découpage final et suivi manuel' });
    expect(within(operationsColumn).getByRole('heading', { name: 'Découpage final sélectionné' })).toBeTruthy();
    expect(within(operationsColumn).getByRole('heading', { name: 'Palettes à expédier' })).toBeTruthy();
    expect(within(operationsColumn).queryByRole('heading', { name: 'Résultat exact' })).toBeNull();
    expect(within(operationsColumn).getByText('2 cartons · 256 unités')).toBeTruthy();
  });

  it('shows the three strategies as a real radio decision with their consequences', async () => {
    const user = userEvent.setup();
    storePackingForm();
    render(<PackingCalculatorPage />);

    const strategyGroup = screen.getByRole('radiogroup', { name: 'Politique opérationnelle' });
    const exact = within(strategyGroup).getByRole('radio', { name: /Exact/i });
    const carton = within(strategyGroup).getByRole('radio', { name: /Carton/i });
    const pallet = within(strategyGroup).getByRole('radio', { name: /Palette/i });

    expect(carton.getAttribute('aria-checked')).toBe('true');
    expect(within(strategyGroup).getByText('30 976')).toBeTruthy();
    expect(within(strategyGroup).getByText('+96 unités')).toBeTruthy();

    await user.click(exact);
    expect(exact.getAttribute('aria-checked')).toBe('true');
    expect(carton.getAttribute('aria-checked')).toBe('false');

    await user.click(pallet);
    expect(pallet.getAttribute('aria-checked')).toBe('true');
  });

  it('persists sequential shipment progress and exposes exact load and volume progress', async () => {
    const user = userEvent.setup();
    storePackingForm();
    const view = render(<PackingCalculatorPage />);

    const shipment = screen.getByRole('region', { name: 'Palettes à expédier' });
    expect(within(shipment).getByLabelText('7 palettes restantes')).toBeTruthy();
    expect(within(shipment).getByText('0 / 7 charges expédiées')).toBeTruthy();

    const increment = within(shipment).getByRole('button', { name: 'Déclarer une palette envoyée' });
    const decrement = within(shipment).getByRole('button', { name: 'Retirer une palette envoyée' });
    await user.click(increment);
    await user.click(increment);
    await user.click(decrement);

    expect(within(shipment).getByLabelText('6 palettes restantes')).toBeTruthy();
    expect(within(shipment).getByText('1 / 7 charges expédiées')).toBeTruthy();
    await waitFor(() => expect(localStorage.getItem(trackingStorageKey)).toContain('"30880:128:40:round-carton":1'));

    view.unmount();
    render(<PackingCalculatorPage />);
    expect(screen.getByText('1 / 7 charges expédiées')).toBeTruthy();
  });

  it('distinguishes load completion from shipped volume when the last load is a small remainder', async () => {
    const user = userEvent.setup();
    storePackingForm();
    render(<PackingCalculatorPage />);

    const shipment = screen.getByRole('region', { name: 'Palettes à expédier' });
    const increment = within(shipment).getByRole('button', { name: 'Déclarer une palette envoyée' });

    for (let load = 0; load < 6; load += 1) await user.click(increment);

    expect(within(shipment).getByText('6 / 7 charges expédiées')).toBeTruthy();
    expect(within(shipment).getByText('30 720 / 30 976')).toBeTruthy();
    expect(within(shipment).getByText('99,2 %')).toBeTruthy();
    expect(within(shipment).getByText('Charge reliquat')).toBeTruthy();
    expect(within(shipment).getByText('2 cartons · 256 unités')).toBeTruthy();
  });

  it('keeps the counter within bounds, completes cleanly and offers an explicit reset', async () => {
    const user = userEvent.setup();
    storePackingForm('30720');
    render(<PackingCalculatorPage />);

    const shipment = screen.getByRole('region', { name: 'Palettes à expédier' });
    const decrement = within(shipment).getByRole('button', { name: 'Retirer une palette envoyée' });
    const increment = within(shipment).getByRole('button', { name: 'Déclarer une palette envoyée' });
    expect((decrement as HTMLButtonElement).disabled).toBe(true);

    for (let load = 0; load < 6; load += 1) await user.click(increment);

    expect(within(shipment).getByLabelText('0 palettes restantes')).toBeTruthy();
    expect((increment as HTMLButtonElement).disabled).toBe(true);
    expect(within(shipment).getByText('Toutes les palettes prévues ont été déclarées comme envoyées.')).toBeTruthy();

    await user.click(within(shipment).getByRole('button', { name: 'Réinitialiser le suivi' }));
    expect(screen.getByText('0 / 6 charges expédiées')).toBeTruthy();
    expect((decrement as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps independent persisted progress for each calculation', async () => {
    const user = userEvent.setup();
    storePackingForm('30720');
    render(<PackingCalculatorPage />);

    await user.click(screen.getByRole('button', { name: 'Déclarer une palette envoyée' }));
    const quantity = screen.getByLabelText('Quantité demandée en unités');
    await user.clear(quantity);
    await user.type(quantity, '30880');
    await user.click(screen.getByRole('button', { name: 'Déclarer une palette envoyée' }));
    await user.click(screen.getByRole('button', { name: 'Déclarer une palette envoyée' }));

    await user.clear(quantity);
    await user.type(quantity, '30720');
    expect(screen.getByText('1 / 6 charges expédiées')).toBeTruthy();

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
