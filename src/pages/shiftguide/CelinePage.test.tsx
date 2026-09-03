import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestCelineResponseMock } = vi.hoisted(() => ({
  requestCelineResponseMock: vi.fn(),
}));

vi.mock('../../features/shiftguide/celineClient', () => ({
  requestCelineResponse: requestCelineResponseMock,
}));

import { CelinePage } from './CelinePage';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

function response(message: string) {
  return {
    message,
    checklist: [],
    followUp: null,
    presentation: 'answer' as const,
  };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  requestCelineResponseMock.mockReset();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('CelinePage conversation request lifecycle', () => {
  it('ignores a stale response and stale finally after starting a new conversation', async () => {
    const user = userEvent.setup();
    const first = deferred<ReturnType<typeof response>>();
    const second = deferred<ReturnType<typeof response>>();
    requestCelineResponseMock
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    render(
      <MemoryRouter>
        <CelinePage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Je lance un OC' }));
    expect(requestCelineResponseMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Nouvelle conversation' }));
    const input = screen.getByPlaceholderText('Décris ta situation…');
    await user.type(input, 'Deuxième demande');
    await user.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(requestCelineResponseMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      first.resolve(response('Réponse obsolète'));
      await first.promise;
      await Promise.resolve();
    });

    expect(screen.queryByText('Réponse obsolète')).toBeNull();
    await user.type(input, ' encore');
    expect((screen.getByRole('button', { name: 'Envoyer' }) as HTMLButtonElement).disabled).toBe(true);

    await act(async () => {
      second.resolve(response('Réponse actuelle'));
      await second.promise;
      await Promise.resolve();
    });

    expect(screen.getByText('Réponse actuelle')).toBeTruthy();
    expect(screen.queryByText('Réponse obsolète')).toBeNull();
    expect((screen.getByRole('button', { name: 'Envoyer' }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('CelinePage persisted history validation', () => {
  it('drops a malformed persisted checklist instead of rendering invalid items', () => {
    localStorage.setItem(
      'shiftguide_celine_history',
      JSON.stringify([
        {
          id: 'assistant-corrupt',
          role: 'assistant',
          content: 'Réponse persistée',
          checklist: [null],
          followUp: null,
        },
      ])
    );

    render(
      <MemoryRouter>
        <CelinePage />
      </MemoryRouter>
    );

    expect(screen.queryByText('Réponse persistée')).toBeNull();
    expect(screen.getByText('Que se passe-t-il sur la ligne ?')).toBeTruthy();
  });

  it('rejects a persisted checklist above the shared response bound', () => {
    localStorage.setItem(
      'shiftguide_celine_history',
      JSON.stringify([
        {
          id: 'assistant-oversized-checklist',
          role: 'assistant',
          content: 'Réponse avec checklist surdimensionnée',
          checklist: Array.from({ length: 101 }, (_, index) => ({
            id: `item-${index}`,
            actionId: `action-${index}`,
            text: `Action ${index}`,
            note: null,
            module: null,
            done: false,
            na: false,
          })),
          followUp: null,
          presentation: 'answer',
        },
      ])
    );

    render(
      <MemoryRouter>
        <CelinePage />
      </MemoryRouter>
    );

    expect(screen.queryByText('Réponse avec checklist surdimensionnée')).toBeNull();
    expect(screen.getByText('Que se passe-t-il sur la ligne ?')).toBeTruthy();
  });

  it('rejects persisted user content above the local history bound', () => {
    localStorage.setItem(
      'shiftguide_celine_history',
      JSON.stringify([
        {
          id: 'user-oversized',
          role: 'user',
          content: 'x'.repeat(20_001),
          checklist: [],
          followUp: null,
        },
      ])
    );

    render(
      <MemoryRouter>
        <CelinePage />
      </MemoryRouter>
    );

    expect(screen.getByText('Que se passe-t-il sur la ligne ?')).toBeTruthy();
  });

  it('restores only the 100 most recent persisted messages', () => {
    localStorage.setItem(
      'shiftguide_celine_history',
      JSON.stringify(
        Array.from({ length: 101 }, (_, index) => ({
          id: `user-${index}`,
          role: 'user',
          content: `Message ${index}`,
          checklist: [],
          followUp: null,
        }))
      )
    );

    render(
      <MemoryRouter>
        <CelinePage />
      </MemoryRouter>
    );

    expect(screen.queryByText('Message 0')).toBeNull();
    expect(screen.getByText('Message 1')).toBeTruthy();
    expect(screen.getByText('Message 100')).toBeTruthy();
  });

  it('restores a structurally valid persisted assistant response', () => {
    localStorage.setItem(
      'shiftguide_celine_history',
      JSON.stringify([
        {
          id: 'assistant-valid',
          role: 'assistant',
          content: 'Réponse persistée valide',
          checklist: [],
          followUp: null,
          presentation: 'answer',
        },
      ])
    );

    render(
      <MemoryRouter>
        <CelinePage />
      </MemoryRouter>
    );

    expect(screen.getByText('Réponse persistée valide')).toBeTruthy();
  });
});
