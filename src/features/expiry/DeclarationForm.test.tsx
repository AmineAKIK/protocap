import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeclarationForm } from './DeclarationForm';
import type { ConditioningLine } from '../../types/expiry';

const line: ConditioningLine = { id: 'a', name: 'Ligne A', vat: 'Cuve 1', product: 'Produit', conditioningStartedAt: '2026-01-01T00:00:00Z', elements: [] };

describe('T42: declaration errors preserve the draft and accessible context', () => {
  it('connects error, field and focus without clearing other fields', async () => {
    const onDeclare = vi.fn(() => ({ field: 'operator' as const, message: 'Opérateur requis' }));
    render(<DeclarationForm kind="replacement" line={line} onCancel={vi.fn()} onDeclare={onDeclare} />);
    const operator = screen.getByLabelText('Opérateur');
    const comment = screen.getByLabelText('Commentaire');
    fireEvent.change(operator, { target: { value: '   ' } });
    fireEvent.change(comment, { target: { value: 'Brouillon conservé' } });
    fireEvent.click(screen.getByRole('button', { name: 'Valider le remplacement' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Opérateur requis');
    expect(operator.getAttribute('aria-invalid')).toBe('true');
    expect(operator.getAttribute('aria-describedby')).toBe(alert.id);
    await waitFor(() => expect(document.activeElement).toBe(operator));
    expect((comment as HTMLTextAreaElement).value).toBe('Brouillon conservé');
    expect(onDeclare).toHaveBeenCalledTimes(1);
    fireEvent.change(operator, { target: { value: 'Test' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('shows and resets the explicit overlap choice when the date changes', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({ timeZone: 'Europe/Paris' } as Intl.ResolvedDateTimeFormatOptions);
    render(<DeclarationForm kind="refill" line={line} onCancel={vi.fn()} onDeclare={vi.fn(() => null)} />);
    fireEvent.change(screen.getByLabelText('Date / heure'), { target: { value: '2026-10-25T02:30' } });
    const choice = screen.getByLabelText('Occurrence de l’heure répétée');
    fireEvent.change(choice, { target: { value: 'later' } });
    expect((choice as HTMLSelectElement).value).toBe('later');
    fireEvent.change(screen.getByLabelText('Date / heure'), { target: { value: '2026-10-25T02:31' } });
    expect((screen.getByLabelText('Occurrence de l’heure répétée') as HTMLSelectElement).value).toBe('');
  });
  it('focuses form-level errors and delegates cancel without a submission', async () => {
    const cancel = vi.fn();
    render(<DeclarationForm kind="replacement" line={line} onCancel={cancel} onDeclare={() => ({ field: 'form', message: 'Contexte à vérifier' })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Valider le remplacement' }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('alert')));
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it.each(['replacement', 'refill'] as const)('keeps the %s comment label independent of the entered textarea content', async (kind) => {
    render(<DeclarationForm kind={kind} line={line} onCancel={vi.fn()} onDeclare={() => ({ field: 'comment', message: 'Commentaire à vérifier' })} />);
    const comment = screen.getByLabelText('Commentaire', { exact: true }) as HTMLTextAreaElement;
    expect(comment.id).not.toBe('');
    expect(comment.labels?.length).toBe(1);
    const label = comment.labels![0];
    expect(label.htmlFor).toBe(comment.id);
    expect(label.contains(comment)).toBe(false);
    fireEvent.change(comment, { target: { value: 'Brouillon conservé\nDeuxième ligne' } });
    fireEvent.click(screen.getByRole('button', { name: kind === 'replacement' ? 'Valider le remplacement' : 'Tracer la recharge' }));
    const alert = await screen.findByRole('alert');
    expect(label.textContent).toBe('Commentaire');
    expect(screen.getByLabelText('Commentaire', { exact: true })).toBe(comment);
    expect(screen.getByRole('textbox', { name: 'Commentaire' })).toBe(comment);
    expect(comment.value).toBe('Brouillon conservé\nDeuxième ligne');
    expect(comment.getAttribute('aria-invalid')).toBe('true');
    expect(comment.getAttribute('aria-describedby')).toBe(alert.id);
    await waitFor(() => expect(document.activeElement).toBe(comment));
  });
});
