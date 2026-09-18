import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AccessibleDialog } from './AccessibleDialog';

function dimensions(element: HTMLElement, clientHeight = 100, scrollHeight = 450) {
  Object.defineProperties(element, {
    clientHeight: { value: clientHeight, configurable: true },
    scrollHeight: { value: scrollHeight, configurable: true },
  });
}
function setup(children: ReactNode = <button type="button">Action</button>) {
  render(<AccessibleDialog title="Déclaration" onClose={vi.fn()}>{children}</AccessibleDialog>);
  const region = screen.getByRole('region', { name: 'Déclaration' });
  dimensions(region);
  return region;
}

describe('dialog page keys preserve the focused control and its owner', () => {
  it.each(['region', 'button'] as const)('pages the %s without moving focus and clamps at both bounds', (owner) => {
    const region = setup();
    const target = owner === 'region' ? region : screen.getByRole('button', { name: 'Action' });
    target.focus();
    expect(fireEvent.keyDown(target, { key: 'PageDown' })).toBe(false);
    expect(region.scrollTop).toBe(100);
    expect(document.activeElement).toBe(target);
    expect(fireEvent.keyDown(target, { key: 'PageUp' })).toBe(false);
    expect(region.scrollTop).toBe(0);
    fireEvent.keyDown(target, { key: 'PageUp' });
    expect(region.scrollTop).toBe(0);
    region.scrollTop = 330;
    fireEvent.keyDown(target, { key: 'PageDown' });
    expect(region.scrollTop).toBe(350);
    expect(document.activeElement).toBe(target);
  });

  it('leaves editable controls and custom widgets untouched', () => {
    const region = setup(<>
      <input aria-label="Date" type="datetime-local" />
      <textarea aria-label="Commentaire" />
      <select aria-label="Choix"><option>Un</option></select>
      <div contentEditable suppressContentEditableWarning><button type="button">Édition</button></div>
      <div role="slider" aria-label="Widget" aria-valuenow={0} tabIndex={0} />
    </>);
    const controls = [screen.getByLabelText('Date'), screen.getByLabelText('Commentaire'),
      screen.getByLabelText('Choix'), screen.getByRole('button', { name: 'Édition' }), screen.getByRole('slider')];
    for (const control of controls) {
      expect(fireEvent.keyDown(control, { key: 'PageDown' })).toBe(true);
      expect(region.scrollTop).toBe(0);
    }
  });

  it('respects child cancellation, modifier shortcuts and unrelated keys', () => {
    const region = setup(<button type="button" onKeyDown={(event) => event.preventDefault()}>Action</button>);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Action' }), { key: 'PageDown' });
    expect(region.scrollTop).toBe(0);
    for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey']) {
      expect(fireEvent.keyDown(region, { key: 'PageDown', [modifier]: true })).toBe(true);
    }
    expect(fireEvent.keyDown(region, { key: 'ArrowDown' })).toBe(true);
    expect(region.scrollTop).toBe(0);
  });

  it('leaves an independently scrolling descendant in charge of its page keys', () => {
    const region = setup(<div data-testid="nested" style={{ overflowY: 'auto' }}><button type="button">Action</button></div>);
    dimensions(screen.getByTestId('nested'), 50, 200);
    expect(fireEvent.keyDown(screen.getByRole('button', { name: 'Action' }), { key: 'PageDown' })).toBe(true);
    expect(region.scrollTop).toBe(0);
  });

  it.each([[0, 450], [100, 100], [100, 50]])('does not intercept keys for a non-scrollable %i/%i region', (clientHeight, scrollHeight) => {
    const region = setup();
    dimensions(region, clientHeight, scrollHeight);
    expect(fireEvent.keyDown(region, { key: 'PageDown' })).toBe(true);
    expect(region.scrollTop).toBe(0);
  });
});
