import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ShiftGuideLock } from './ShiftGuideLock';

function renderLock(onUnlock: (code: string) => Promise<{ ok: boolean; error?: string }>) {
  return render(
    <MemoryRouter>
      <ShiftGuideLock onUnlock={onUnlock} />
    </MemoryRouter>
  );
}

describe('ShiftGuideLock', () => {
  it('keeps submission disabled until a non-empty code is entered and trims it before unlock', async () => {
    const user = userEvent.setup();
    const onUnlock = vi.fn().mockResolvedValue({ ok: true });
    renderLock(onUnlock);

    const input = screen.getByLabelText("Code d'accès") as HTMLInputElement;
    const submit = screen.getByRole('button', { name: 'Déverrouiller' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    await user.type(input, '  1234  ');
    expect(submit.disabled).toBe(false);
    await user.click(submit);

    expect(onUnlock).toHaveBeenCalledTimes(1);
    expect(onUnlock).toHaveBeenCalledWith('1234');
  });

  it('surfaces an unlock error and clears the rejected code', async () => {
    const user = userEvent.setup();
    const onUnlock = vi.fn().mockResolvedValue({ ok: false, error: 'Code incorrect.' });
    renderLock(onUnlock);

    const input = screen.getByLabelText("Code d'accès") as HTMLInputElement;
    await user.type(input, 'wrong');
    await user.click(screen.getByRole('button', { name: 'Déverrouiller' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Code incorrect.');
    await waitFor(() => expect(input.value).toBe(''));
  });
});
