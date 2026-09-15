import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PackingCalculatorPage } from './PackingCalculatorPage';

const formStorageKey = 'lineops.packing.form.inputs.v8';

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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Packing preparation persistence hardening', () => {
  it('requires explicit consent before starting when persistence becomes unavailable', async () => {
    installDialogPolyfill();
    const user = userEvent.setup();
    localStorage.setItem(formStorageKey, JSON.stringify({
      quantity: '30880',
      unitsPerCarton: '128',
      cartonsPerPalette: '40',
      productionStartTime: '2026-09-15T07:30',
      referenceCadence: '60',
    }));

    render(<PackingCalculatorPage />);
    const group = screen.getByRole('radiogroup', { name: 'Stratégie de conditionnement' });
    await user.click(within(group).getByRole('radio', { name: /Carton complet/i }));

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
});
