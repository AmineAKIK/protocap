import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Button, ButtonLink } from './Button';

describe('Button primitives', () => {
  it('defaults buttons to type button while preserving explicit submit semantics', () => {
    render(
      <>
        <Button>Action</Button>
        <Button type="submit">Envoyer</Button>
      </>
    );

    expect((screen.getByRole('button', { name: 'Action' }) as HTMLButtonElement).type).toBe('button');
    expect((screen.getByRole('button', { name: 'Envoyer' }) as HTMLButtonElement).type).toBe('submit');
  });

  it('renders navigation actions as a single link control', () => {
    render(
      <MemoryRouter>
        <ButtonLink to="/rapport">Ouvrir le rapport</ButtonLink>
      </MemoryRouter>
    );

    const link = screen.getByRole('link', { name: 'Ouvrir le rapport' }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/rapport');
    expect(link.querySelector('button')).toBeNull();
  });
});
