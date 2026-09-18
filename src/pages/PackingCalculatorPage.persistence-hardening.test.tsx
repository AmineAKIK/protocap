import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PackingCalculatorPage } from './PackingCalculatorPage';

const formStorageKey = 'lineops.packing.form.inputs.v8';
const activeRunStorageKey = 'lineops.packing.active-run.v1';
const originalSetItem = Storage.prototype.setItem;

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

function storeValidPreparation() {
  localStorage.setItem(formStorageKey, JSON.stringify({
    quantity: '30880',
    unitsPerCarton: '128',
    cartonsPerPalette: '40',
    productionStartTime: '2026-09-15T07:30',
    referenceCadence: '60',
  }));
}

async function chooseCartonStrategy(user: ReturnType<typeof userEvent.setup>) {
  const group = screen.getByRole('radiogroup', { name: 'Stratégie de conditionnement' });
  await user.click(within(group).getByRole('radio', { name: /Carton complet/i }));
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('Packing preparation persistence hardening', () => {
  it('requires explicit consent before starting when persistence is already unavailable', async () => {
    installDialogPolyfill();
    const user = userEvent.setup();
    storeValidPreparation();

    render(<PackingCalculatorPage />);
    await chooseCartonStrategy(user);

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });

    await user.click(screen.getByRole('button', { name: 'Lancer le suivi de production' }));
    const dialog = screen.getByRole('dialog', { name: 'Sauvegarde locale indisponible' });
    expect(dialog).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Annuler' })));

    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.getByRole('heading', { name: 'Préparer l’ordre de conditionnement' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Lancer le suivi de production' }));
    await user.click(screen.getByRole('button', { name: 'Continuer sans sauvegarde' }));
    const productionHeading = await screen.findByRole('heading', { name: 'Conduite de production' });
    expect(screen.getByText(/sauvegarde locale n’est pas garantie/i)).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(productionHeading));
  });

  it('does not activate the run when the probe succeeds but the real run write fails', async () => {
    installDialogPolyfill();
    const user = userEvent.setup();
    storeValidPreparation();
    render(<PackingCalculatorPage />);
    await chooseCartonStrategy(user);

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function writeWithRunFailure(this: Storage, key: string, value: string) {
      if (key === activeRunStorageKey) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return originalSetItem.call(this, key, value);
    });

    await user.click(screen.getByRole('button', { name: 'Lancer le suivi de production' }));

    expect(screen.getByRole('dialog', { name: 'Sauvegarde locale indisponible' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Préparer l’ordre de conditionnement' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Conduite de production' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Continuer sans sauvegarde' }));
    expect(await screen.findByRole('heading', { name: 'Conduite de production' })).toBeTruthy();
  });

  it('keeps the active run until replacing preparation is persisted or explicitly accepted degraded', async () => {
    installDialogPolyfill();
    const user = userEvent.setup();
    storeValidPreparation();
    render(<PackingCalculatorPage />);
    await chooseCartonStrategy(user);
    await user.click(screen.getByRole('button', { name: 'Lancer le suivi de production' }));
    expect(await screen.findByRole('heading', { name: 'Conduite de production' })).toBeTruthy();

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function writeWithDraftFailure(this: Storage, key: string, value: string) {
      if (key === formStorageKey) throw new DOMException('Blocked', 'SecurityError');
      return originalSetItem.call(this, key, value);
    });

    await user.click(screen.getByRole('button', { name: 'Modifier la préparation' }));
    expect(screen.getByRole('dialog', { name: 'Préparation non sauvegardée' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Conduite de production' })).toBeTruthy();
    expect(localStorage.getItem(activeRunStorageKey)).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.getByRole('heading', { name: 'Conduite de production' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Modifier la préparation' }));
    await user.click(screen.getByRole('button', { name: 'Continuer sans sauvegarde' }));
    expect(await screen.findByRole('heading', { name: 'Préparer l’ordre de conditionnement' })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(activeRunStorageKey) ?? '{}')).toMatchObject({
      schemaVersion: 3,
      activeRun: null,
      draft: null,
    });
  });

  it('signals when a corrupt local preparation is ignored without overwriting its source bytes', () => {
    const raw = '{not-json';
    localStorage.setItem(formStorageKey, raw);
    render(<PackingCalculatorPage />);

    expect(screen.getByRole('status').textContent).toMatch(/préparation locale invalide a été ignorée/i);
    expect(localStorage.getItem(formStorageKey)).toBe(raw);
  });
});
