import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AccessibleDialog } from './AccessibleDialog';

describe('dialog scroll region keyboard access', () => {
  it('offers a named keyboard stop between the header and content controls', async () => {
    const user = userEvent.setup();
    render(<AccessibleDialog title="Déclaration" onClose={vi.fn()}><input aria-label="Opérateur" /></AccessibleDialog>);
    const close = screen.getByRole('button', { name: 'Fermer' });
    const region = screen.getByRole('region', { name: 'Déclaration' });
    expect(region.getAttribute('tabindex')).toBe('0');
    expect(region.className).toContain('overflow-y-auto');
    expect(region.className).toContain('focus-visible:outline-2');
    await waitFor(() => expect(document.activeElement).toBe(close));
    await user.tab();
    expect(document.activeElement).toBe(region);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Opérateur' }));
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(region);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(close);
  });

  it('keeps text-only content focusable when the close button is intentionally absent', async () => {
    render(<AccessibleDialog title="Informations" onClose={vi.fn()} hideCloseButton><p>Contenu à parcourir au clavier.</p></AccessibleDialog>);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Informations' })));
  });

  it('preserves the explicit initial-focus contract', async () => {
    const initialFocusRef = createRef<HTMLInputElement>();
    render(<AccessibleDialog title="Saisie" onClose={vi.fn()} initialFocusRef={initialFocusRef}><input ref={initialFocusRef} aria-label="Référence" /></AccessibleDialog>);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Référence' })));
  });
});
