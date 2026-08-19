import { isShiftGuideData } from '../types/shiftGuide';
import type { ShiftGuideData } from '../types/shiftGuide';

interface ShiftGuideUnlockResponse extends ShiftGuideData {
  token: string;
}

const SESSION_KEY = 'shiftguide_auth_token';
const DATA_KEY = 'shiftguide_data';

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

export async function unlockShiftGuide(code: string): Promise<{ ok: boolean; error?: string }> {
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
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(DATA_KEY);
}
