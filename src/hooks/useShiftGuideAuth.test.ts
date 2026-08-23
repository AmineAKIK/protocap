import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getShiftGuideConfigRevision,
  getShiftGuideData,
  getShiftGuideToken,
  isShiftGuideUnlocked,
  logoutShiftGuide,
  SHIFTGUIDE_SESSION_INVALIDATED_EVENT,
  unlockShiftGuide,
  validateShiftGuideSession,
} from './useShiftGuideAuth';
import { shiftGuideFixture } from '../test/shiftGuideFixture';

const CONFIG_REVISION = 'sha256:test-config-revision';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function storeValidSession(expiresAt: number, configRevision = CONFIG_REVISION) {
  sessionStorage.setItem('shiftguide_auth_token', 'session-token');
  sessionStorage.setItem('shiftguide_data', JSON.stringify(shiftGuideFixture));
  sessionStorage.setItem('shiftguide_session_expires_at', String(expiresAt));
  sessionStorage.setItem('shiftguide_session_config_revision', configRevision);
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe('ShiftGuide browser auth boundary', () => {
  it('stores only a validated unlock payload with a future expiry and config revision', async () => {
    const expiresAt = Date.now() + 60_000;
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ token: 'session-token', expiresAt, configRevision: CONFIG_REVISION, ...shiftGuideFixture })
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
    expect(getShiftGuideConfigRevision()).toBe(CONFIG_REVISION);
    expect(localStorage.getItem('shiftguide_config_revision')).toBe(CONFIG_REVISION);
    expect(isShiftGuideUnlocked()).toBe(true);
  });

  it('clears revision-bound local state when the server config revision changes', async () => {
    localStorage.setItem('shiftguide_config_revision', 'sha256:old');
    localStorage.setItem('shiftguide_progress_v2', JSON.stringify({ actions: { action_1: 'validated' } }));
    localStorage.setItem('shiftguide_progress_v3', JSON.stringify({ version: 3, configRevision: 'sha256:old' }));
    localStorage.setItem('shiftguide_celine_history', JSON.stringify([{ id: 'old-message' }]));
    localStorage.setItem('shiftguide_prompt_version', 'v11');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({
        token: 'session-token',
        expiresAt: Date.now() + 60_000,
        configRevision: CONFIG_REVISION,
        ...shiftGuideFixture,
      }))
    );

    await expect(unlockShiftGuide('1234')).resolves.toEqual({ ok: true });
    expect(localStorage.getItem('shiftguide_config_revision')).toBe(CONFIG_REVISION);
    expect(localStorage.getItem('shiftguide_progress_v2')).toBeNull();
    expect(localStorage.getItem('shiftguide_progress_v3')).toBeNull();
    expect(localStorage.getItem('shiftguide_celine_history')).toBeNull();
    expect(localStorage.getItem('shiftguide_prompt_version')).toBeNull();
  });

  it('treats pre-revision persisted state as untrusted on the first upgraded unlock', async () => {
    localStorage.setItem('shiftguide_progress_v2', JSON.stringify({ actions: { action_1: 'validated' } }));
    localStorage.setItem('shiftguide_celine_history', JSON.stringify([{ id: 'legacy-message' }]));

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({
        token: 'session-token',
        expiresAt: Date.now() + 60_000,
        configRevision: CONFIG_REVISION,
        ...shiftGuideFixture,
      }))
    );

    await expect(unlockShiftGuide('1234')).resolves.toEqual({ ok: true });
    expect(localStorage.getItem('shiftguide_progress_v2')).toBeNull();
    expect(localStorage.getItem('shiftguide_celine_history')).toBeNull();
  });

  it('rejects malformed protected data without persisting credentials', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({
        token: 'session-token',
        expiresAt: Date.now() + 60_000,
        configRevision: CONFIG_REVISION,
        modules: [],
      }))
    );

    await expect(unlockShiftGuide('1234')).resolves.toEqual({
      ok: false,
      error: 'Données ShiftGuide invalides.',
    });
    expect(getShiftGuideToken()).toBeNull();
    expect(getShiftGuideData()).toBeNull();
    expect(getShiftGuideConfigRevision()).toBeNull();
  });

  it('clears browser credentials locally when their expiry has passed', () => {
    storeValidSession(Date.now() - 1);

    expect(isShiftGuideUnlocked()).toBe(false);
    expect(getShiftGuideToken()).toBeNull();
    expect(getShiftGuideData()).toBeNull();
    expect(getShiftGuideConfigRevision()).toBeNull();
  });

  it('clears stale browser credentials when the server rejects the session', async () => {
    storeValidSession(Date.now() + 60_000);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));

    await expect(validateShiftGuideSession()).resolves.toBe(false);
    expect(getShiftGuideToken()).toBeNull();
    expect(getShiftGuideData()).toBeNull();
  });

  it('refreshes the authoritative server expiry only for the same config revision', async () => {
    const expiresAt = Date.now() + 120_000;
    storeValidSession(Date.now() + 60_000);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ ok: true, expiresAt, configRevision: CONFIG_REVISION }))
    );

    await expect(validateShiftGuideSession()).resolves.toBe(true);
    expect(sessionStorage.getItem('shiftguide_session_expires_at')).toBe(String(expiresAt));
  });

  it('fails closed when session validation reports a different config revision', async () => {
    const expiresAt = Date.now() + 120_000;
    storeValidSession(Date.now() + 60_000);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ ok: true, expiresAt, configRevision: 'sha256:new' }))
    );

    await expect(validateShiftGuideSession()).resolves.toBe(false);
    expect(getShiftGuideToken()).toBeNull();
    expect(getShiftGuideConfigRevision()).toBeNull();
  });

  it('logs out locally even when server revocation cannot be reached', async () => {
    storeValidSession(Date.now() + 60_000);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const invalidated = vi.fn();
    window.addEventListener(SHIFTGUIDE_SESSION_INVALIDATED_EVENT, invalidated, { once: true });

    await expect(logoutShiftGuide()).resolves.toBeUndefined();
    expect(getShiftGuideToken()).toBeNull();
    expect(getShiftGuideData()).toBeNull();
    expect(getShiftGuideConfigRevision()).toBeNull();
    expect(sessionStorage.getItem('shiftguide_session_expires_at')).toBeNull();
    expect(invalidated).toHaveBeenCalledTimes(1);
  });
});
