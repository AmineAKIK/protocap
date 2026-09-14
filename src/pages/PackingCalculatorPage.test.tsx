import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PackingCalculatorPage } from './PackingCalculatorPage';

const formStorageKey = 'lineops.packing.form.inputs.v8';
const activeRunStorageKey = 'lineops.packing.active-run.v1';

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

async function chooseCartonStrategy(user: ReturnType<typeof userEvent.setup>) {
  const strategyGroup = screen.getByRole('radiogroup', { name: 'Politique opérationnelle' });
  await user.click(within(strategyGroup).getByRole('radio', { name: /Carton/i }));
}

async function activateRun(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Cadence de référence en unités par minute'), '60');
  await user.click(screen.getByRole('button', { name: 'Activer ce run' }));
}

describe('PackingCalculatorPage operator run flow', () => {
  it('keeps calculation draft separate from an explicitly activated run', async () => {
    const user = userEvent.setup();
    storePackingForm();
    render(<PackingCalculatorPage />);
    await chooseCartonStrategy(user);

    expect(screen.getByRole('heading', { name: 'Activer le run' })).toBeTruthy();
    await activateRun(user);

    expect(screen.getByRole('heading', { name: 'Déclarations de production' })).toBeTruthy();
    expect(screen.getByText('Run actif')).toBeTruthy();

    const quantity = screen.getByLabelText('Quantité demandée en unités');
    await user.clear(quantity);
    await user.type(quantity, '40000');

    const operations = screen.getByRole('region', { name: 'Plan actif et déclarations de production' });
    expect(within(operations).getByText(/30\s976/)).toBeTruthy();
    expect(within(operations).queryByText(/40\s064/)).toBeNull();
  });

  it('requires an explicit operator strategy and cadence before run activation', async () => {
    const user = userEvent.setup();
    storePackingForm();
    render(<PackingCalculatorPage />);

    expect(screen.getByRole('heading', { name: 'Plan en attente' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Activer le run' })).toBeNull();

    await chooseCartonStrategy(user);
    const activate = screen.getByRole('button', { name: 'Activer ce run' }) as HTMLButtonElement;
    expect(activate.disabled).toBe(true);

    await user.type(screen.getByLabelText('Cadence de référence en unités par minute'), '60');
    expect(activate.disabled).toBe(false);
  });

  it('declares a complete load in one click and reloads it from the active-run history', async () => {
    const user = userEvent.setup();
    storePackingForm();
    const view = render(<PackingCalculatorPage />);
    await chooseCartonStrategy(user);
    await activateRun(user);

    await user.click(screen.getByRole('button', { name: 'Déclarer une charge' }));
    expect(screen.getByText(/5\s120 unités déclarées produites/)).toBeTruthy();
    expect(screen.getByText(/5\s120/)).toBeTruthy();
    expect(screen.getByText('1 déclaration')).toBeTruthy();

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(activeRunStorageKey) ?? 'null') as { activeRun?: { declarations?: unknown[] } };
      expect(stored.activeRun?.declarations).toHaveLength(1);
    });

    view.unmount();
    render(<PackingCalculatorPage />);
    expect(screen.getByRole('heading', { name: 'Déclarations de production' })).toBeTruthy();
    expect(screen.getByText('1 déclaration')).toBeTruthy();
  });

  it('accepts partial cartons and units with an exact preview', async () => {
    const user = userEvent.setup();
    storePackingForm('400000');
    localStorage.setItem(formStorageKey, JSON.stringify({
      quantity: '400000',
      unitsPerCarton: '480',
      cartonsPerPalette: '50',
      policy: 'round-carton',
    }));
    render(<PackingCalculatorPage />);
    await chooseCartonStrategy(user);
    await activateRun(user);

    await user.type(screen.getByLabelText('Cartons complets à déclarer'), '10');
    await user.type(screen.getByLabelText('Unités du carton partiel à déclarer'), '120');
    expect(screen.getByText(/Aperçu :/).parentElement?.textContent).toContain('4 920 unités');

    await user.click(screen.getByRole('button', { name: 'Déclarer ce volume' }));
    expect(screen.getByText(/4\s920 unités déclarées produites/)).toBeTruthy();
    expect(screen.getByText(/10 cartons \+ 120 unités partielles/)).toBeTruthy();
  });

  it('visibly rejects a declaration above the remaining run volume', async () => {
    const user = userEvent.setup();
    storePackingForm('100');
    localStorage.setItem(formStorageKey, JSON.stringify({
      quantity: '100',
      unitsPerCarton: '10',
      cartonsPerPalette: '10',
      policy: 'no-overrun',
    }));
    render(<PackingCalculatorPage />);

    const strategyGroup = screen.getByRole('radiogroup', { name: 'Politique opérationnelle' });
    await user.click(within(strategyGroup).getByRole('radio', { name: /Exact/i }));
    await activateRun(user);

    await user.type(screen.getByLabelText('Cartons complets à déclarer'), '11');
    await user.click(screen.getByRole('button', { name: 'Déclarer ce volume' }));
    expect(screen.getByRole('alert').textContent).toContain('dépasse le volume restant');
    expect(screen.getByText('0 déclaration')).toBeTruthy();
  });

  it('corrects and removes declarations by identity while restoring exact progress', async () => {
    const user = userEvent.setup();
    storePackingForm();
    render(<PackingCalculatorPage />);
    await chooseCartonStrategy(user);
    await activateRun(user);
    await user.click(screen.getByRole('button', { name: 'Déclarer une charge' }));

    await user.click(screen.getByRole('button', { name: 'Corriger la déclaration 1' }));
    const cartons = screen.getByLabelText('Cartons complets à déclarer');
    await user.clear(cartons);
    await user.type(cartons, '10');
    await user.click(screen.getByRole('button', { name: 'Enregistrer la correction' }));

    expect(screen.getByText(/1\s280 unités/)).toBeTruthy();
    expect(screen.getByText('Déclaration corrigée.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Supprimer la déclaration 1' }));
    expect(screen.getByText('0 déclaration')).toBeTruthy();
    expect(screen.getByText('Aucune production déclarée pour ce run.')).toBeTruthy();
  });

  it('starts a fresh same-parameter run without inheriting prior declarations', async () => {
    const user = userEvent.setup();
    storePackingForm();
    render(<PackingCalculatorPage />);
    await chooseCartonStrategy(user);
    await activateRun(user);
    await user.click(screen.getByRole('button', { name: 'Déclarer une charge' }));
    expect(screen.getByText('1 déclaration')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Nouveau run' }));
    expect(screen.getByRole('heading', { name: 'Activer le run' })).toBeTruthy();
    await activateRun(user);
    expect(screen.getByText('0 déclaration')).toBeTruthy();
  });
});
