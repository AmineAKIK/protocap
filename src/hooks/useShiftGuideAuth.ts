import { isShiftGuideData } from '../types/shiftGuide';
import type { ShiftGuideData } from '../types/shiftGuide';

interface ShiftGuideUnlockResponse extends ShiftGuideData {
  token: string;
}

export interface ShiftGuideAuthResult {
  ok: boolean;
  error?: string;
}

export const SHIFTGUIDE_SESSION_INVALIDATED_EVENT = 'shiftguide:session-invalidated';

const SESSION_KEY = 'shiftguide_auth_token';
const DATA_KEY = 'shiftguide_data';

function clearStoredShiftGuideAuth() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(DATA_KEY);
}

function notifySessionInvalidated() {
  window.dispatchEvent(new Event(SHIFTGUIDE_SESSION_INVALIDATED_EVENT));
}

export function getShiftGuideToken(): string | null {
  return sessionStorage.getItem(SESSION_KEY);
}

export function getShiftGuideData(): ShiftGuideData | null {
  const raw = sessionStorage.getItem(DATA_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isShiftGuideData(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function isShiftGuideUnlocked(): boolean {
  return !!getShiftGuideToken() && !!getShiftGuideData();
}

export async function validateShiftGuideSession(): Promise<boolean> {
  const token = getShiftGuideToken();
  const data = getShiftGuideData();
  if (!token || !data) {
    clearStoredShiftGuideAuth();
    return false;
  }

  try {
    const res = await fetch('/api/shiftguide/session', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) return true;

    if (res.status === 401) {
      clearStoredShiftGuideAuth();
    }
    return false;
  } catch {
    // Protected data is sensitive: fail closed when the server cannot confirm the session.
    return false;
  }
}

export async function unlockShiftGuide(code: string): Promise<ShiftGuideAuthResult> {
  try {
    const res = await fetch('/api/shiftguide/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error ?? 'Code incorrect.' };
    }

    const response: unknown = await res.json();
    if (!response || typeof response !== 'object' || !('token' in response)) {
      return { ok: false, error: 'Session invalide.' };
    }

    const { token, ...data } = response as Record<string, unknown>;
    if (typeof token !== 'string' || token.length === 0 || !isShiftGuideData(data)) {
      return { ok: false, error: 'Données ShiftGuide invalides.' };
    }

    const validatedResponse: ShiftGuideUnlockResponse = { token, ...data };
    sessionStorage.setItem(SESSION_KEY, validatedResponse.token);
    sessionStorage.setItem(DATA_KEY, JSON.stringify(data));
    return { ok: true };
  } catch {
    return { ok: false, error: 'Erreur réseau.' };
  }
}

export function lockShiftGuide() {
  clearStoredShiftGuideAuth();
  notifySessionInvalidated();
}

export async function logoutShiftGuide(): Promise<void> {
  const token = getShiftGuideToken();

  try {
    if (token) {
      await fetch('/api/shiftguide/session', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } catch {
    // Logout remains local-first: a network failure must never keep credentials in the browser.
  } finally {
    lockShiftGuide();
  }
}
