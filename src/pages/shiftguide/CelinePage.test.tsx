import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

function focusedWorkflowMessage({ done = false }: { done?: boolean } = {}) {
  return {
    id: 'assistant-focus',
    role: 'assistant',
    content: 'Début de poste — ligne en production — étape 7/7.',
    checklist: [{
      id: 'pzd_1',
      actionId: 'pzd',
      text: 'Vérifier les PZD',
      note: null,
      module: 'Début de poste',
      done,
      na: false,
    }],
    followUp: null,
    presentation: 'focus',
    workflow: {
      runId: 'debut_poste_production_123',
      routeId: 'debut_poste_production',
      label: 'Début de poste — ligne en production',
      currentIndex: 6,
      totalActions: 7,
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  requestCelineResponseMock.mockReset();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
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

  it('never auto-advances a completed checklist restored from history, including under StrictMode', async () => {
    vi.useFakeTimers();
    localStorage.setItem(
      'shiftguide_celine_history',
      JSON.stringify([focusedWorkflowMessage({ done: true })])
    );

    render(
      <StrictMode>
        <MemoryRouter>
          <CelinePage />
        </MemoryRouter>
      </StrictMode>
    );

    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });

    expect(screen.getByText('Début de poste — ligne en production — étape 7/7.')).toBeTruthy();
    expect(requestCelineResponseMock).not.toHaveBeenCalled();
  });

  it('does not resurrect a completed workflow hidden behind a later completion message', async () => {
    vi.useFakeTimers();
    localStorage.setItem(
      'shiftguide_celine_history',
      JSON.stringify([
        focusedWorkflowMessage({ done: true }),
        {
          id: 'assistant-completion',
          role: 'assistant',
          content: 'Début de poste — ligne en production terminée.',
          checklist: [],
          followUp: null,
          presentation: 'completion',
          completedWorkflow: {
            routeId: 'debut_poste_production',
            label: 'Début de poste — ligne en production',
          },
        },
      ])
    );

    render(
      <MemoryRouter>
        <CelinePage />
      </MemoryRouter>
    );

    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });

    expect(screen.getByText('Début de poste — ligne en production terminée.')).toBeTruthy();
    expect(requestCelineResponseMock).not.toHaveBeenCalled();
  });

  it('still auto-advances exactly once after the operator completes the current focused checklist', async () => {
    vi.useFakeTimers();
    localStorage.setItem(
      'shiftguide_celine_history',
      JSON.stringify([focusedWorkflowMessage()])
    );
    requestCelineResponseMock.mockResolvedValue(response('Étape suivante'));

    render(
      <StrictMode>
        <MemoryRouter>
          <CelinePage />
        </MemoryRouter>
      </StrictMode>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Valider : Vérifier les PZD' }));

    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(requestCelineResponseMock).toHaveBeenCalledTimes(1);
    expect(requestCelineResponseMock.mock.calls[0][0]).toBe("C'est fait.");
    expect(screen.getByText('Étape suivante')).toBeTruthy();
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