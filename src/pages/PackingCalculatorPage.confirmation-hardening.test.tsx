import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
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

function storeValidPreparation() {
  localStorage.setItem(formStorageKey, JSON.stringify({
    quantity: '30880',
    unitsPerCarton: '128',
    cartonsPerPalette: '40',
    productionStartTime: '2026-09-15T07:30',
    referenceCadence: '60',
  }));
}

describe('Packing confirmation hardening', () => {
  it('moves focus to the reset form after destructive confirmation', async () => {
    installDialogPolyfill();
    storeValidPreparation();
    const user = userEvent.setup();
    render(<PackingCalculatorPage />);

    await user.click(screen.getByRole('button', { name: /Réinitialiser la préparation/i }));
    await user.click(screen.getByRole('button', { name: /^Réinitialiser$/ }));

    const quantity = screen.getByLabelText('Quantité demandée');
    await waitFor(() => expect(document.activeElement).toBe(quantity));
  });

  it('releases the launch lock after a successful run and return to preparation', async () => {
    installDialogPolyfill();
    storeValidPreparation();
    const user = userEvent.setup();
    render(<PackingCalculatorPage />);

    const group = screen.getByRole('radiogroup', { name: 'Stratégie de conditionnement' });
    await user.click(within(group).getByRole('radio', { name: /Carton complet/i }));
    await user.click(screen.getByRole('button', { name: 'Lancer le suivi de production' }));
    await screen.findByRole('heading', { name: 'Conduite de production' });
    await user.click(screen.getByRole('button', { name: /Déclarer une palette complète/i }));

    await user.click(screen.getByRole('button', { name: 'Modifier la préparation' }));
    await user.click(screen.getByRole('button', { name: 'Modifier et supprimer' }));

    const quantity = await screen.findByLabelText('Quantité demandée');
    await waitFor(() => expect(document.activeElement).toBe(quantity));
    expect((screen.getByRole('button', { name: 'Lancer le suivi de production' }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: /Réinitialiser la préparation/i }) as HTMLButtonElement).disabled).toBe(false);
  });
});
