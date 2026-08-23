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

  it('clears all revision-bound state when the server config revision changes', async () => {
    localStorage.setItem('shiftguide_config_revision', 'sha256:old');
    localStorage.setItem('shiftguide_celine_authority_revision', CELINE_AUTHORITY_REVISION);
    localStorage.setItem('shiftguide_progress_v3', JSON.stringify({ version: 3, configRevision: 'sha256:old' }));
    localStorage.setItem('shiftguide_celine_history', JSON.stringify([{ id: 'old-message' }]));

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(unlockPayload())));
    await expect(unlockShiftGuide('1234')).resolves.toEqual({ ok: true });

    expect(localStorage.getItem('shiftguide_config_revision')).toBe(CONFIG_REVISION);
    expect(localStorage.getItem('shiftguide_progress_v3')).toBeNull();
    expect(localStorage.getItem('shiftguide_celine_history')).toBeNull();
  });

  it('clears only Celine memory when the authority protocol changes', async () => {
    localStorage.setItem('shiftguide_config_revision', CONFIG_REVISION);
    localStorage.setItem('shiftguide_celine_authority_revision', 'decision-v0');
    localStorage.setItem('shiftguide_progress_v3', JSON.stringify({
      version: 3,
      configRevision: CONFIG_REVISION,
      actions: { action_1: 'validated' },
      activeChoices: {},
      updatedAt: 1,
    }));
    localStorage.setItem('shiftguide_celine_history', JSON.stringify([{ id: 'old-message' }]));
    localStorage.setItem('shiftguide_prompt_version', 'v12');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(unlockPayload())));
    await expect(unlockShiftGuide('1234')).resolves.toEqual({ ok: true });

    expect(localStorage.getItem('shiftguide_progress_v3')).not.toBeNull();
    expect(localStorage.getItem('shiftguide_celine_history')).toBeNull();
    expect(localStorage.getItem('shiftguide_prompt_version')).toBeNull();
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

  it('clears browser credentials locally when their expiry has passed', () => {
    storeValidSession(Date.now() - 1);
    expect(isShiftGuideUnlocked()).toBe(false);
    expect(getShiftGuideToken()).toBeNull();
    expect(getCelineAuthorityRevision()).toBeNull();
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

  it('fails closed when session validation reports another config or authority revision', async () => {
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
      storeValidSession(Date.now() + 60_000);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(body)));
      await expect(validateShiftGuideSession()).resolves.toBe(false);
      expect(getShiftGuideToken()).toBeNull();
    }
  });

  it('logs out locally even when server revocation cannot be reached', async () => {
    storeValidSession(Date.now() + 60_000);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const invalidated = vi.fn();
    window.addEventListener(SHIFTGUIDE_SESSION_INVALIDATED_EVENT, invalidated, { once: true });

    await expect(logoutShiftGuide()).resolves.toBeUndefined();
    expect(getShiftGuideToken()).toBeNull();
    expect(getCelineAuthorityRevision()).toBeNull();
    expect(invalidated).toHaveBeenCalledTimes(1);
  });
});
