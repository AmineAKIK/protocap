import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PackingCalculatorPage } from './PackingCalculatorPage';

const formStorageKey = 'lineops.packing.form.inputs.v8';
const activeRunStorageKey = 'lineops.packing.active-run.v1';

function storePackingForm(overrides: Record<string, string> = {}) {
  localStorage.setItem(
    formStorageKey,
    JSON.stringify({
      quantity: '30880',
      unitsPerCarton: '128',
      cartonsPerPalette: '40',
      productionStartTime: '07:30',
      referenceCadence: '60',
      ...overrides,
    }),
  );
}

async function chooseStrategy(user: ReturnType<typeof userEvent.setup>, name: RegExp = /Carton complet/i) {
  const group = screen.getByRole('radiogroup', { name: 'Stratégie de conditionnement' });
  await user.click(within(group).getByRole('radio', { name }));
}

async function launchRun(user: ReturnType<typeof userEvent.setup>, strategy: RegExp = /Carton complet/i) {
  await chooseStrategy(user, strategy);
  await user.click(screen.getByRole('button', { name: /Lancer le suivi de production/i }));
  expect(await screen.findByRole('heading', { name: 'Conduite de production' })).toBeTruthy();
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PackingCalculatorPage V3 operator workflow', () => {
  it('keeps preparation active until all source inputs and a strategy are explicit', async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      formStorageKey,
      JSON.stringify({ quantity: '30880', unitsPerCarton: '128', cartonsPerPalette: '40' }),
    );

    render(<PackingCalculatorPage />);

    expect(screen.getByRole('heading', { name: 'Préparer l’ordre de conditionnement' })).toBeTruthy();
    expect(screen.getByText('Conduite de production')).toBeTruthy();
    const launch = screen.getByRole('button', { name: /Lancer le suivi de production/i }) as HTMLButtonElement;
    expect(launch.disabled).toBe(true);

    await chooseStrategy(user);
    expect(launch.disabled).toBe(true);

    await user.type(screen.getByLabelText(/Début OC/i), '0730');
    await user.type(screen.getByLabelText(/Cadence réf/i), '60');
    expect(launch.disabled).toBe(false);
  });

  it('launches an immutable run snapshot and turns preparation into a frozen reference', async () => {
    const user = userEvent.setup();
    storePackingForm();
    render(<PackingCalculatorPage />);

    await launchRun(user);

    expect(screen.getByLabelText('Préparation figée')).toBeTruthy();
    expect(screen.getByText(/30\s?976/)).toBeTruthy();
    expect(screen.getByText(/15/)).toBeTruthy();

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(activeRunStorageKey) ?? 'null') as {
        schemaVersion?: number;
        activeRun?: { productionStartedAt?: string; selectedPolicy?: string };
      };
      expect(stored.schemaVersion).toBe(2);
      expect(stored.activeRun?.productionStartedAt).toBeTruthy();
      expect(stored.activeRun?.selectedPolicy).toBe('round-carton');
    });
  });

  it('declares a complete pallet in one click and restores it after reload', async () => {
    const user = userEvent.setup();
    storePackingForm();
    const view = render(<PackingCalculatorPage />);
    await launchRun(user);

    await user.click(screen.getByRole('button', { name: /Déclarer une palette complète/i }));
    expect(screen.getByRole('status').textContent).toMatch(/5\s?120 unités déclarées/);

    const history = screen.getByLabelText('Historique des déclarations');
    const completePallet = within(history).getByText('Palette complète').closest('.packing-v3-history-row');
    expect(completePallet).toBeTruthy();
    expect(within(completePallet as HTMLElement).getByText(/5\s?120 unités/)).toBeTruthy();

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(activeRunStorageKey) ?? 'null') as { activeRun?: { declarations?: unknown[] } };
      expect(stored.activeRun?.declarations).toHaveLength(1);
    });

    view.unmount();
    render(<PackingCalculatorPage />);
    expect(screen.getByRole('heading', { name: 'Conduite de production' })).toBeTruthy();
    expect(within(screen.getByLabelText('Historique des déclarations')).getByText('Palette complète')).toBeTruthy();
  });

  it('previews and records cartons plus units in the incomplete carton', async () => {
    const user = userEvent.setup();
    storePackingForm({ quantity: '400000', unitsPerCarton: '480', cartonsPerPalette: '50' });
    render(<PackingCalculatorPage />);
    await launchRun(user);

    await user.type(screen.getByLabelText('Cartons complets'), '10');
    await user.type(screen.getByLabelText('Unités dans le carton incomplet'), '120');
    expect(screen.getByText(/4\s?920 unités/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Enregistrer la palette partielle/i }));
    expect(screen.getByRole('status').textContent).toMatch(/4\s?920 unités déclarées/);
    expect(within(screen.getByLabelText('Historique des déclarations')).getByText('Palette partielle')).toBeTruthy();
  });

  it('rejects over-declaration and supports correction then removal by identity', async () => {
    const user = userEvent.setup();
    storePackingForm({ quantity: '100', unitsPerCarton: '10', cartonsPerPalette: '10' });
    render(<PackingCalculatorPage />);
    await launchRun(user, /Sans dépassement/i);

    await user.type(screen.getByLabelText('Cartons complets'), '11');
    await user.click(screen.getByRole('button', { name: /Enregistrer la palette partielle/i }));
    expect(screen.getByRole('alert').textContent).toContain('dépasse le volume restant');

    await user.clear(screen.getByLabelText('Cartons complets'));
    await user.type(screen.getByLabelText('Cartons complets'), '5');
    await user.click(screen.getByRole('button', { name: /Enregistrer la palette partielle/i }));

    await user.click(screen.getByRole('button', { name: /Corriger la déclaration/i }));
    const cartons = screen.getByLabelText('Cartons complets');
    await user.clear(cartons);
    await user.type(cartons, '4');
    await user.click(screen.getByRole('button', { name: /Enregistrer la correction/i }));
    expect(screen.getByRole('status').textContent).toBe('Déclaration corrigée.');

    await user.click(screen.getByRole('button', { name: /Supprimer la déclaration/i }));
    expect(screen.getByRole('status').textContent).toBe('Déclaration supprimée et progression recalculée.');
    expect(screen.getByText('Aucune production déclarée pour le moment.')).toBeTruthy();
  });

  it('requires confirmation before returning to preparation when declarations exist', async () => {
    const user = userEvent.setup();
    storePackingForm();
    render(<PackingCalculatorPage />);
    await launchRun(user);
    await user.click(screen.getByRole('button', { name: /Déclarer une palette complète/i }));

    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await user.click(screen.getByRole('button', { name: 'Modifier la préparation' }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(screen.getByRole('heading', { name: 'Conduite de production' })).toBeTruthy();

    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Modifier la préparation' }));
    expect(await screen.findByRole('heading', { name: 'Préparer l’ordre de conditionnement' })).toBeTruthy();
    expect((screen.getByLabelText(/Quantité demandée/i) as HTMLInputElement).value).toBe('30880');
  });
});
