import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getShiftGuideData,
  getShiftGuideToken,
  isShiftGuideUnlocked,
  logoutShiftGuide,
  SHIFTGUIDE_SESSION_INVALIDATED_EVENT,
  unlockShiftGuide,
  validateShiftGuideSession,
} from './useShiftGuideAuth';
import { shiftGuideFixture } from '../test/shiftGuideFixture';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe('ShiftGuide browser auth boundary', () => {
  it('stores only a validated unlock payload with a future expiry', async () => {
    const expiresAt = Date.now() + 60_000;
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ token: 'session-token', expiresAt, ...shiftGuideFixture })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(unlockShiftGuide(' 1234 ')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/shiftguide/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: ' 1234 ' }),
    });
    expect(getShiftGuideToken()).toBe('session-token');
    expect(getShiftGuideData()).toEqual(shiftGuideFixture);
    expect(isShiftGuideUnlocked()).toBe(true);
  });

  it('rejects malformed protected data without persisting credentials', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({
        token: 'session-token',
        expiresAt: Date.now() + 60_000,
        modules: [],
      }))
    );

    await expect(unlockShiftGuide('1234')).resolves.toEqual({
      ok: false,
      error: 'Données ShiftGuide invalides.',
    });
    expect(getShiftGuideToken()).toBeNull();
    expect(getShiftGuideData()).toBeNull();
  });

  it('clears browser credentials locally when their expiry has passed', () => {
    sessionStorage.setItem('shiftguide_auth_token', 'expired-token');
    sessionStorage.setItem('shiftguide_data', JSON.stringify(shiftGuideFixture));
    sessionStorage.setItem('shiftguide_session_expires_at', String(Date.now() - 1));

    expect(isShiftGuideUnlocked()).toBe(false);
    expect(getShiftGuideToken()).toBeNull();
    expect(getShiftGuideData()).toBeNull();
  });

  it('clears stale browser credentials when the server rejects the session', async () => {
    sessionStorage.setItem('shiftguide_auth_token', 'stale-token');
    sessionStorage.setItem('shiftguide_data', JSON.stringify(shiftGuideFixture));
    sessionStorage.setItem('shiftguide_session_expires_at', String(Date.now() + 60_000));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));

    await expect(validateShiftGuideSession()).resolves.toBe(false);
    expect(getShiftGuideToken()).toBeNull();
    expect(getShiftGuideData()).toBeNull();
  });

  it('refreshes the authoritative server expiry for valid sessions', async () => {
    const expiresAt = Date.now() + 120_000;
    sessionStorage.setItem('shiftguide_auth_token', 'session-token');
    sessionStorage.setItem('shiftguide_data', JSON.stringify(shiftGuideFixture));
    sessionStorage.setItem('shiftguide_session_expires_at', String(Date.now() + 60_000));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ok: true, expiresAt })));

    await expect(validateShiftGuideSession()).resolves.toBe(true);
    expect(sessionStorage.getItem('shiftguide_session_expires_at')).toBe(String(expiresAt));
  });

  it('logs out locally even when server revocation cannot be reached', async () => {
    sessionStorage.setItem('shiftguide_auth_token', 'session-token');
    sessionStorage.setItem('shiftguide_data', JSON.stringify(shiftGuideFixture));
    sessionStorage.setItem('shiftguide_session_expires_at', String(Date.now() + 60_000));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const invalidated = vi.fn();
    window.addEventListener(SHIFTGUIDE_SESSION_INVALIDATED_EVENT, invalidated, { once: true });

    await expect(logoutShiftGuide()).resolves.toBeUndefined();
    expect(getShiftGuideToken()).toBeNull();
    expect(getShiftGuideData()).toBeNull();
    expect(sessionStorage.getItem('shiftguide_session_expires_at')).toBeNull();
    expect(invalidated).toHaveBeenCalledTimes(1);
  });
});
