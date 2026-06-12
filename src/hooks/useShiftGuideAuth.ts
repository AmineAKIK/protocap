export interface ShiftGuideData {
  modules: unknown;
  lexique: unknown;
  systemPromptExtra: string | null;
  urgences: unknown;
}

const SESSION_KEY = 'shiftguide_auth_token';
const DATA_KEY = 'shiftguide_data';

export function isShiftGuideUnlocked(): boolean {
  return !!sessionStorage.getItem(SESSION_KEY);
}

export function getShiftGuideData(): ShiftGuideData | null {
  const raw = sessionStorage.getItem(DATA_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
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

    const data: ShiftGuideData = await res.json();
    sessionStorage.setItem(SESSION_KEY, '1');
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
