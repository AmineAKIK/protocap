import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShiftGuideAuthProvider, useShiftGuideAuth } from './ShiftGuideAuthContext';
import { shiftGuideFixture } from '../test/shiftGuideFixture';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function storeSession(expiresAt: number) {
  sessionStorage.setItem('shiftguide_auth_token', 'session-token');
  sessionStorage.setItem('shiftguide_data', JSON.stringify(shiftGuideFixture));
  sessionStorage.setItem('shiftguide_session_expires_at', String(expiresAt));
}

function AuthProbe() {
  const { status, logout } = useShiftGuideAuth();
  return (
    <div>
      <output data-testid="status">{status}</output>
      <button type="button" onClick={() => void logout()}>
        Logout
      </button>
    </div>
  );
}

async function flushAsyncState() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ShiftGuideAuthProvider session lifecycle', () => {
  it('locks the UI exactly when the authoritative browser expiry is reached', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-23T12:00:00.000Z'));
    const expiresAt = Date.now() + 1_000;
    storeSession(expiresAt);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ok: true, expiresAt })));

    render(
      <ShiftGuideAuthProvider>
        <AuthProbe />
      </ShiftGuideAuthProvider>
    );
    await flushAsyncState();

    expect(screen.getByTestId('status').textContent).toBe('unlocked');

    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });

    expect(screen.getByTestId('status').textContent).toBe('locked');
    expect(sessionStorage.getItem('shiftguide_auth_token')).toBeNull();
    expect(sessionStorage.getItem('shiftguide_session_expires_at')).toBeNull();
  });

  it('revalidates immediately on focus and locks when the server revoked the session', async () => {
    const expiresAt = Date.now() + 60_000;
    storeSession(expiresAt);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true, expiresAt }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ShiftGuideAuthProvider>
        <AuthProbe />
      </ShiftGuideAuthProvider>
    );
    await flushAsyncState();
    expect(screen.getByTestId('status').textContent).toBe('unlocked');

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('status').textContent).toBe('locked');
    expect(sessionStorage.getItem('shiftguide_auth_token')).toBeNull();
  });

  it('never lets a stale validation unlock the UI after logout has started', async () => {
    const expiresAt = Date.now() + 60_000;
    storeSession(expiresAt);

    let resolveValidation: ((response: Response) => void) | undefined;
    const validationResponse = new Promise<Response>((resolve) => {
      resolveValidation = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => validationResponse)
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ShiftGuideAuthProvider>
        <AuthProbe />
      </ShiftGuideAuthProvider>
    );
    expect(screen.getByTestId('status').textContent).toBe('checking');

    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    await flushAsyncState();
    expect(screen.getByTestId('status').textContent).toBe('locked');

    await act(async () => {
      resolveValidation?.(jsonResponse({ ok: true, expiresAt }));
      await validationResponse;
      await Promise.resolve();
    });

    expect(screen.getByTestId('status').textContent).toBe('locked');
    expect(sessionStorage.getItem('shiftguide_auth_token')).toBeNull();
  });
});
