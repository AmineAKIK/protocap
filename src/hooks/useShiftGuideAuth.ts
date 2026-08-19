export interface ShiftGuideData {
  modules: unknown;
  lexique: unknown;
  systemPromptExtra: string | null;
  urgences: unknown;
}

interface ShiftGuideUnlockResponse extends ShiftGuideData {
  token: string;
}

const SESSION_KEY = 'shiftguide_auth_token';
const DATA_KEY = 'shiftguide_data';

export function getShiftGuideToken(): string | null {
  return sessionStorage.getItem(SESSION_KEY);
}

export function isShiftGuideUnlocked(): boolean {
  return !!getShiftGuideToken() && !!sessionStorage.getItem(DATA_KEY);
}

export function getShiftGuideData(): ShiftGuideData | null {
  const raw = sessionStorage.getItem(DATA_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
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

    const response: ShiftGuideUnlockResponse = await res.json();
    if (!response.token) return { ok: false, error: 'Session invalide.' };

    const { token, ...data } = response;
    sessionStorage.setItem(SESSION_KEY, token);
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
