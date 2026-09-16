import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PackingCalculatorPage } from './PackingCalculatorPage';

const formStorageKey = 'lineops.packing.form.inputs.v8';
const activeRunStorageKey = 'lineops.packing.active-run.v1';
const productionStart = '2026-09-15T07:30';

function installDialogPolyfill() {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '');
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute('open');
    };
  }
}

function storePackingForm(overrides: Record<string, string> = {}) {
  localStorage.setItem(
    formStorageKey,
    JSON.stringify({
      quantity: '30880',
      unitsPerCarton: '128',
      cartonsPerPalette: '40',
      productionStartTime: productionStart,
      referenceCadence: '60',
      ...overrides,
    }),
  );
}

function getProductionStartInput(): HTMLInputElement {
  return screen.getByLabelText('Début OC', { selector: 'input' }) as HTMLInputElement;
}

function getProductionStartControl(): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>('#packing-production-start')!;
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

beforeEach(() => {
  installDialogPolyfill();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PackingCalculatorPage V3 operator workflow', () => {
  it('reveals missing preparation only when launch is attempted', async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      formStorageKey,
      JSON.stringify({ quantity: '30880', unitsPerCarton: '128', cartonsPerPalette: '40' }),
    );

    render(<PackingCalculatorPage />);

    expect(screen.getByRole('heading', { name: 'Préparer l’ordre de conditionnement' })).toBeTruthy();
    expect(screen.getByText('Conduite de production')).toBeTruthy();
    const launch = screen.getByRole('button', { name: /Lancer le suivi de production/i }) as HTMLButtonElement;
    expect(launch.disabled).toBe(false);
    expect(screen.queryByText(/À compléter :/)).toBeNull();
    expect(screen.queryByText('Valeur obligatoire.')).toBeNull();

    await user.click(launch);

    expect(screen.getByText(/À compléter : Début OC · Cadence réf\./)).toBeTruthy();
    expect(getProductionStartInput().getAttribute('aria-invalid')).toBe('true');
    expect(getProductionStartControl().getAttribute('aria-invalid')).toBe('true');
    await waitFor(() => expect(document.activeElement).toBe(getProductionStartControl()));

    await chooseStrategy(user);
    fireEvent.change(getProductionStartInput(), { target: { value: productionStart } });
    await user.type(screen.getByLabelText(/Cadence réf/i), '60');
    expect(screen.queryByText(/À compléter :/)).toBeNull();
    expect(launch.disabled).toBe(false);
  });

  it('preserves invalid numeric input but waits for launch before surfacing the error', async () => {
    const user = userEvent.setup();
    render(<PackingCalculatorPage />);

    const quantity = screen.getByLabelText('Quantité demandée') as HTMLInputElement;
    await user.type(quantity, '12.5');
    await user.tab();

    expect(quantity.value).toBe('12.5');
    expect(quantity.getAttribute('aria-invalid')).toBe('false');
    expect(screen.queryByText('Saisissez un entier supérieur à 0.')).toBeNull();

    await user.click(screen.getByRole('button', { name: /Lancer le suivi de production/i }));

    expect(quantity.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Saisissez un entier supérieur à 0.')).toBeTruthy();
    expect(screen.getByText(/Corrigez : Quantité demandée/)).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(quantity));
  });

  it('does not show required feedback on focus and blur alone', async () => {
    const user = userEvent.setup();
    render(<PackingCalculatorPage />);

    const quantity = screen.getByLabelText('Quantité demandée');
    await user.click(quantity);
    await user.tab();
    expect(screen.queryByText('Valeur obligatoire.')).toBeNull();

    await user.click(screen.getByRole('button', { name: /Lancer le suivi de production/i }));
    expect(screen.getAllByText('Valeur obligatoire.')).toHaveLength(5);
    await waitFor(() => expect(document.activeElement).toBe(quantity));
  });

  it('protects reset with an accessible confirmation and restores focus when cancelled', async () => {
    const user = userEvent.setup();
    storePackingForm();
    render(<PackingCalculatorPage />);

    await chooseStrategy(user);
    const reset = screen.getByRole('button', { name: /Réinitialiser la préparation/i });
    await user.click(reset);

    const dialog = screen.getByRole('dialog', { name: 'Réinitialiser la préparation ?' });
    expect(dialog).toBeTruthy();
    const cancel = screen.getByRole('button', { name: 'Annuler' });
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    await user.click(cancel);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(reset);
    expect((screen.getByLabelText('Quantité demandée') as HTMLInputElement).value).toBe('30880');

    await user.click(reset);
    await user.click(screen.getByRole('button', { name: /^Réinitialiser$/ }));

    expect((screen.getByLabelText(/Quantité demandée/i) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(/Unités par carton/i) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(/Cartons par palette/i) as HTMLInputElement).value).toBe('');
    expect(getProductionStartInput().value).toBe('');
    expect((screen.getByLabelText(/Cadence réf/i) as HTMLInputElement).value).toBe('');
    expect((screen.getByRole('button', { name: /Réinitialiser la préparation/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('supports arrow-key navigation inside the strategy radio group', () => {
    storePackingForm();
    render(<PackingCalculatorPage />);

    const group = screen.getByRole('radiogroup', { name: 'Stratégie de conditionnement' });
    const exact = within(group).getByRole('radio', { name: /Sans dépassement/i });
    exact.focus();
    fireEvent.keyDown(exact, { key: 'ArrowRight' });

    const carton = within(group).getByRole('radio', { name: /Carton complet/i });
    expect(carton.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(carton);
  });

  it('preserves a legacy time-only start until the operator chooses a date', async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      formStorageKey,
      JSON.stringify({
        quantity: '30880',
        unitsPerCarton: '128',
        cartonsPerPalette: '40',
        productionStartTime: '07:30',
        referenceCadence: '60',
      }),
    );

    render(<PackingCalculatorPage />);

    const start = getProductionStartInput();
    expect(start.value).toBe('');
    expect(screen.getByText(/Heure enregistrée : 07:30 · choisissez sa date\./)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Lancer le suivi de production/i }));
    expect(screen.getByText('Valeur obligatoire.')).toBeTruthy();
    expect(screen.getByText(/Heure enregistrée : 07:30 · choisissez sa date\./)).toBeTruthy();

    fireEvent.change(start, { target: { value: productionStart } });
    expect(screen.queryByText(/Heure enregistrée :/)).toBeNull();
  });

  it('rejects impossible calendar dates only after a launch attempt', async () => {
    const user = userEvent.setup();
    storePackingForm({ productionStartTime: '2026-02-31T07:30' });
    render(<PackingCalculatorPage />);

    await chooseStrategy(user);
    const start = getProductionStartInput();
    fireEvent.blur(start);
    const launch = screen.getByRole('button', { name: /Lancer le suivi de production/i }) as HTMLButtonElement;

    expect(start.getAttribute('aria-invalid')).toBe('false');
    expect(screen.queryByText('Choisissez une date et une heure valides.')).toBeNull();
    expect(launch.disabled).toBe(false);

    await user.click(launch);
    expect(start.getAttribute('aria-invalid')).toBe('true');
    expect(getProductionStartControl().getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Choisissez une date et une heure valides.')).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(getProductionStartControl()));
  });

  it('launches an immutable run snapshot and turns preparation into a frozen reference', async () => {
    const user = userEvent.setup();
    storePackingForm();
    render(<PackingCalculatorPage />);

    await launchRun(user);

    const frozenPreparation = screen.getByLabelText('Préparation figée');
    expect(within(frozenPreparation).getByText(/30\s?976 unités/)).toBeTruthy();
    expect(within(frozenPreparation).getByText(/60 u\/min/)).toBeTruthy();

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(activeRunStorageKey) ?? 'null') as {
        schemaVersion?: number;
        activeRun?: { productionStartedAt?: string; selectedPolicy?: string };
      };
      expect(stored.schemaVersion).toBe(3);
      expect(stored.activeRun?.productionStartedAt).toBe(new Date(productionStart).toISOString());
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

  it('preserves the live draft after reload and rejects malformed numeric input without rewriting it', async () => {
    const user = userEvent.setup();
    storePackingForm({ quantity: '400000', unitsPerCarton: '480', cartonsPerPalette: '50' });
    const view = render(<PackingCalculatorPage />);
    await launchRun(user);

    await user.type(screen.getByLabelText('Cartons complets'), '12');
    await user.type(screen.getByLabelText('Unités dans le carton incomplet'), '30');
    view.unmount();
    render(<PackingCalculatorPage />);

    expect((screen.getByLabelText('Cartons complets') as HTMLInputElement).value).toBe('12');
    expect((screen.getByLabelText('Unités dans le carton incomplet') as HTMLInputElement).value).toBe('30');

    const cartons = screen.getByLabelText('Cartons complets');
    await user.clear(cartons);
    await user.type(cartons, '1.5');
    expect((cartons as HTMLInputElement).value).toBe('1.5');
    expect(screen.getByText('Saisissez uniquement des nombres entiers positifs ou zéro.')).toBeTruthy();
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
    await user.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(screen.getByRole('status').textContent).toBe('Déclaration supprimée et progression recalculée.');
    expect(screen.getByText('Aucune production déclarée pour le moment.')).toBeTruthy();
  });

  it('protects destructive return to preparation and preserves the full OC start date', async () => {
    const user = userEvent.setup();
    storePackingForm();
    render(<PackingCalculatorPage />);
    await launchRun(user);
    await user.click(screen.getByRole('button', { name: /Déclarer une palette complète/i }));

    await user.click(screen.getByRole('button', { name: 'Modifier la préparation' }));
    expect(screen.getByRole('dialog', { name: 'Modifier la préparation ?' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Modifier et supprimer' }));

    expect(await screen.findByRole('heading', { name: 'Préparer l’ordre de conditionnement' })).toBeTruthy();
    expect((screen.getByLabelText(/Quantité demandée/i) as HTMLInputElement).value).toBe('30880');
    expect(getProductionStartInput().value).toBe(productionStart);
  });
});
