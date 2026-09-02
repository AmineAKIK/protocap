import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCelineAuthorityRevision,
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
const CELINE_AUTHORITY_REVISION = 'decision-v1';
const CELINE_HISTORY_KEY = 'shiftguide_celine_history';
const PROGRESS_KEY = 'shiftguide_progress_v3';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function storeValidSession(
  expiresAt: number,
  configRevision = CONFIG_REVISION,
  celineAuthorityRevision = CELINE_AUTHORITY_REVISION
) {
  sessionStorage.setItem('shiftguide_auth_token', 'session-token');
  sessionStorage.setItem('shiftguide_data', JSON.stringify(shiftGuideFixture));
  sessionStorage.setItem('shiftguide_session_expires_at', String(expiresAt));
  sessionStorage.setItem('shiftguide_session_config_revision', configRevision);
  sessionStorage.setItem('shiftguide_session_celine_authority_revision', celineAuthorityRevision);
}

function unlockPayload(expiresAt = Date.now() + 60_000) {
  return {
    token: 'session-token',
    expiresAt,
    configRevision: CONFIG_REVISION,
    celineAuthorityRevision: CELINE_AUTHORITY_REVISION,
    ...shiftGuideFixture,
  };
}

function storeProgress() {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify({
    version: 3,
    configRevision: CONFIG_REVISION,
    actions: { action_1: 'validated' },
    activeChoices: {},
    updatedAt: 1,
  }));
}

function storeCelineMemory(storage: Storage = localStorage) {
  storage.setItem(CELINE_HISTORY_KEY, JSON.stringify([{ id: 'previous-session-message' }]));
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe('ShiftGuide browser auth boundary', () => {
  it('stores validated config and Celine authority revisions on unlock', async () => {
    const expiresAt = Date.now() + 60_000;
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(unlockPayload(expiresAt)));
    vi.stubGlobal('fetch', fetchMock);

    await expect(unlockShiftGuide(' 1234 ')).resolves.toEqual({ ok: true });
    expect(getShiftGuideToken()).toBe('session-token');
    expect(getShiftGuideData()).toEqual(shiftGuideFixture);
    expect(getShiftGuideConfigRevision()).toBe(CONFIG_REVISION);
    expect(getCelineAuthorityRevision()).toBe(CELINE_AUTHORITY_REVISION);
    expect(localStorage.getItem('shiftguide_config_revision')).toBe(CONFIG_REVISION);
    expect(localStorage.getItem('shiftguide_celine_authority_revision')).toBe(CELINE_AUTHORITY_REVISION);
    expect(isShiftGuideUnlocked()).toBe(true);
  });

  it('starts every successful authentication with fresh Celine memory while preserving same-revision progress', async () => {
    localStorage.setItem('shiftguide_config_revision', CONFIG_REVISION);
    localStorage.setItem('shiftguide_celine_authority_revision', CELINE_AUTHORITY_REVISION);
    storeProgress();
    storeCelineMemory(localStorage);
    storeCelineMemory(sessionStorage);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(unlockPayload())));
    await expect(unlockShiftGuide('1234')).resolves.toEqual({ ok: true });

    expect(localStorage.getItem(CELINE_HISTORY_KEY)).toBeNull();
    expect(sessionStorage.getItem(CELINE_HISTORY_KEY)).toBeNull();
    expect(localStorage.getItem(PROGRESS_KEY)).not.toBeNull();
  });

  it('does not erase the current Celine memory when an unlock attempt fails', async () => {
    storeCelineMemory(localStorage);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'Code incorrect.' }, 401)));

    await expect(unlockShiftGuide('wrong')).resolves.toEqual({ ok: false, error: 'Code incorrect.' });
    expect(localStorage.getItem(CELINE_HISTORY_KEY)).not.toBeNull();
  });

  it('clears all revision-bound state when the server config revision changes', async () => {
    localStorage.setItem('shiftguide_config_revision', 'sha256:old');
    localStorage.setItem('shiftguide_celine_authority_revision', CELINE_AUTHORITY_REVISION);
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ version: 3, configRevision: 'sha256:old' }));
    storeCelineMemory(localStorage);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(unlockPayload())));
    await expect(unlockShiftGuide('1234')).resolves.toEqual({ ok: true });

    expect(localStorage.getItem('shiftguide_config_revision')).toBe(CONFIG_REVISION);
    expect(localStorage.getItem(PROGRESS_KEY)).toBeNull();
    expect(localStorage.getItem(CELINE_HISTORY_KEY)).toBeNull();
  });

  it('clears only Celine memory when the authority protocol changes', async () => {
    localStorage.setItem('shiftguide_config_revision', CONFIG_REVISION);
    localStorage.setItem('shiftguide_celine_authority_revision', 'decision-v0');
    storeProgress();
    storeCelineMemory(localStorage);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(unlockPayload())));
    await expect(unlockShiftGuide('1234')).resolves.toEqual({ ok: true });

    expect(localStorage.getItem(PROGRESS_KEY)).not.toBeNull();
    expect(localStorage.getItem(CELINE_HISTORY_KEY)).toBeNull();
    expect(localStorage.getItem('shiftguide_celine_authority_revision')).toBe(CELINE_AUTHORITY_REVISION);
  });

  it('rejects malformed protected data without persisting credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      token: 'session-token',
      expiresAt: Date.now() + 60_000,
      configRevision: CONFIG_REVISION,
      celineAuthorityRevision: CELINE_AUTHORITY_REVISION,
      modules: [],
    })));

    await expect(unlockShiftGuide('1234')).resolves.toEqual({
      ok: false,
      error: 'Données ShiftGuide invalides.',
    });
    expect(getShiftGuideToken()).toBeNull();
    expect(getCelineAuthorityRevision()).toBeNull();
  });

  it('clears Celine memory with browser credentials when their expiry has passed', () => {
    storeValidSession(Date.now() - 1);
    storeCelineMemory(localStorage);
    storeCelineMemory(sessionStorage);
    storeProgress();

    expect(isShiftGuideUnlocked()).toBe(false);
    expect(getShiftGuideToken()).toBeNull();
    expect(getCelineAuthorityRevision()).toBeNull();
    expect(localStorage.getItem(CELINE_HISTORY_KEY)).toBeNull();
    expect(sessionStorage.getItem(CELINE_HISTORY_KEY)).toBeNull();
    expect(localStorage.getItem(PROGRESS_KEY)).not.toBeNull();
  });

  it('refreshes expiry only when config and authority revisions both match', async () => {
    const expiresAt = Date.now() + 120_000;
    storeValidSession(Date.now() + 60_000);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      ok: true,
      expiresAt,
      configRevision: CONFIG_REVISION,
      celineAuthorityRevision: CELINE_AUTHORITY_REVISION,
    })));

    await expect(validateShiftGuideSession()).resolves.toBe(true);
    expect(sessionStorage.getItem('shiftguide_session_expires_at')).toBe(String(expiresAt));
  });

  it('fails closed and clears Celine memory when validation reports another config or authority revision', async () => {
    for (const body of [
      {
        ok: true,
        expiresAt: Date.now() + 120_000,
        configRevision: 'sha256:new',
        celineAuthorityRevision: CELINE_AUTHORITY_REVISION,
      },
      {
        ok: true,
        expiresAt: Date.now() + 120_000,
        configRevision: CONFIG_REVISION,
        celineAuthorityRevision: 'decision-v2',
      },
    ]) {
      sessionStorage.clear();
      localStorage.clear();
      storeValidSession(Date.now() + 60_000);
      storeCelineMemory(localStorage);
      storeCelineMemory(sessionStorage);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(body)));

      await expect(validateShiftGuideSession()).resolves.toBe(false);
      expect(getShiftGuideToken()).toBeNull();
      expect(localStorage.getItem(CELINE_HISTORY_KEY)).toBeNull();
      expect(sessionStorage.getItem(CELINE_HISTORY_KEY)).toBeNull();
    }
  });

  it('clears Celine memory on server 401 session invalidation', async () => {
    storeValidSession(Date.now() + 60_000);
    storeCelineMemory(localStorage);
    storeCelineMemory(sessionStorage);
    storeProgress();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'expired' }, 401)));

    await expect(validateShiftGuideSession()).resolves.toBe(false);
    expect(getShiftGuideToken()).toBeNull();
    expect(localStorage.getItem(CELINE_HISTORY_KEY)).toBeNull();
    expect(sessionStorage.getItem(CELINE_HISTORY_KEY)).toBeNull();
    expect(localStorage.getItem(PROGRESS_KEY)).not.toBeNull();
  });

  it('completes local logout while server revocation is still pending', async () => {
    storeValidSession(Date.now() + 60_000);
    storeCelineMemory(localStorage);
    storeCelineMemory(sessionStorage);
    storeProgress();

    let resolveRevocation!: () => void;
    const pendingRevocation = new Promise<void>((resolve) => {
      resolveRevocation = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pendingRevocation);
    vi.stubGlobal('fetch', fetchMock);

    const logoutPromise = logoutShiftGuide();

    expect(getShiftGuideToken()).toBeNull();
    expect(getCelineAuthorityRevision()).toBeNull();
    expect(localStorage.getItem(CELINE_HISTORY_KEY)).toBeNull();
    expect(sessionStorage.getItem(CELINE_HISTORY_KEY)).toBeNull();
    expect(localStorage.getItem(PROGRESS_KEY)).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/shiftguide/session', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer session-token' },
    });
    await expect(logoutPromise).resolves.toBeUndefined();

    resolveRevocation();
    await pendingRevocation;
  });

  it('logs out locally and clears Celine memory even when server revocation cannot be reached', async () => {
    storeValidSession(Date.now() + 60_000);
    storeCelineMemory(localStorage);
    storeCelineMemory(sessionStorage);
    storeProgress();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const invalidated = vi.fn();
    window.addEventListener(SHIFTGUIDE_SESSION_INVALIDATED_EVENT, invalidated, { once: true });

    await expect(logoutShiftGuide()).resolves.toBeUndefined();
    expect(getShiftGuideToken()).toBeNull();
    expect(getCelineAuthorityRevision()).toBeNull();
    expect(localStorage.getItem(CELINE_HISTORY_KEY)).toBeNull();
    expect(sessionStorage.getItem(CELINE_HISTORY_KEY)).toBeNull();
    expect(localStorage.getItem(PROGRESS_KEY)).not.toBeNull();
    expect(invalidated).toHaveBeenCalledTimes(1);
  });
});
