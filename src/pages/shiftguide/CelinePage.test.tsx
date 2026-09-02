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
