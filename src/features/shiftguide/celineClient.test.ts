import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestCelineResponse } from './celineClient';

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe('requestCelineResponse', () => {
  it('sends exactly one current operator turn plus a bounded ShiftGuide context hint', async () => {
    sessionStorage.setItem('shiftguide_auth_token', 'token');
    localStorage.setItem('shiftguide_context', 'production');
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      message: 'Action suivante.',
      checklist: [
        { actionId: 'a1', text: 'Contrôle', note: null, module: 'Module' },
      ],
      followUp: null,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await requestCelineResponse('bonjour', controller.signal);

    expect(result.message).toBe('Action suivante.');
    expect(result.checklist[0].actionId).toBe('a1');
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer token');
    expect(options.signal).toBe(controller.signal);
    expect(JSON.parse(options.body)).toEqual({
      messages: [{ role: 'user', content: 'bonjour' }],
      contextHint: 'production',
    });
  });

  it('drops an unknown browser context rather than forwarding arbitrary state', async () => {
    sessionStorage.setItem('shiftguide_auth_token', 'token');
    localStorage.setItem('shiftguide_context', 'invented_context');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      message: 'OK',
      checklist: [],
      followUp: null,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await requestCelineResponse('bonjour', new AbortController().signal);
    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body).contextHint).toBeNull();
  });

  it('propagates an AbortError when the caller cancels the in-flight browser request', async () => {
    sessionStorage.setItem('shiftguide_auth_token', 'token');
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, options: RequestInit) =>
      new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        }, { once: true });
      })
    ));

    const request = requestCelineResponse('bonjour', controller.signal);
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects blank operator turns before network access', async () => {
    sessionStorage.setItem('shiftguide_auth_token', 'token');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestCelineResponse(
      '   ',
      new AbortController().signal
    )).rejects.toThrow('Requête IA invalide.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed on a 401 and clears the local ShiftGuide session', async () => {
    sessionStorage.setItem('shiftguide_auth_token', 'expired');
    sessionStorage.setItem('shiftguide_data', '{}');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: 'Session ShiftGuide invalide ou expirée.',
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })));

    await expect(requestCelineResponse(
      'bonjour',
      new AbortController().signal
    )).rejects.toThrow('Session ShiftGuide expirée');

    expect(sessionStorage.getItem('shiftguide_auth_token')).toBeNull();
    expect(sessionStorage.getItem('shiftguide_data')).toBeNull();
  });
});
