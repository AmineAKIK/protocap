import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestCelineResponse } from './celineClient';

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe('requestCelineResponse', () => {
  it('consumes the Protocap DTO without knowing the provider response shape', async () => {
    sessionStorage.setItem('shiftguide_auth_token', 'token');
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

    const result = await requestCelineResponse(
      [{ role: 'user', content: 'bonjour' }],
      new AbortController().signal
    );

    expect(result.message).toBe('Action suivante.');
    expect(result.checklist[0].actionId).toBe('a1');
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer token');
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
      [{ role: 'user', content: 'bonjour' }],
      new AbortController().signal
    )).rejects.toThrow('Session ShiftGuide expirée');

    expect(sessionStorage.getItem('shiftguide_auth_token')).toBeNull();
    expect(sessionStorage.getItem('shiftguide_data')).toBeNull();
  });
});
