import { afterEach, describe, expect, it, vi } from 'vitest';
import { getShiftGuideToken, unlockShiftGuide } from './useShiftGuideAuth';
import { shiftGuideFixture } from '../test/shiftGuideFixture';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ShiftGuide auth storage failure policy', () => {
  it('refuses unlock when the protected session cannot be persisted atomically', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      token: 'session-token',
      expiresAt: Date.now() + 60_000,
      configRevision: 'sha256:test-config',
      celineAuthorityRevision: 'sha256:test-authority',
      ...shiftGuideFixture,
    })));

    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (this === sessionStorage && key === 'shiftguide_session_expires_at') {
        throw new DOMException('quota', 'QuotaExceededError');
      }
      return originalSetItem.call(this, key, value);
    });

    await expect(unlockShiftGuide('1234')).resolves.toEqual({
      ok: false,
      error: 'Stockage de session indisponible.',
    });
    expect(getShiftGuideToken()).toBeNull();
    expect(sessionStorage.getItem('shiftguide_data')).toBeNull();
  });
});
