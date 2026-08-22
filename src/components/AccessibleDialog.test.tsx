import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { AccessibleDialog } from './AccessibleDialog';

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

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Ouvrir</button>
      {open ? (
        <AccessibleDialog
          title="Confirmation"
          description="Décision explicite requise."
          onClose={() => setOpen(false)}
        >
          <button type="button" onClick={() => setOpen(false)}>Continuer</button>
        </AccessibleDialog>
      ) : null}
    </>
  );
}

describe('AccessibleDialog', () => {
  it('exposes a named modal dialog and restores focus after close', async () => {
    installDialogPolyfill();
    const user = userEvent.setup();
    render(<Harness />);

    const trigger = screen.getByRole('button', { name: 'Ouvrir' }) as HTMLButtonElement;
    await user.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Confirmation' }) as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(screen.getByText('Décision explicite requise.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('maps the native cancel event to the application close contract', async () => {
    installDialogPolyfill();
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Ouvrir' }));
    const dialog = screen.getByRole('dialog', { name: 'Confirmation' });
    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
