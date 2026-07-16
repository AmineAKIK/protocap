export interface ShiftGuideData {
  modules: unknown;
  lexique: unknown;
  systemPromptExtra: string | null;
  urgences: unknown;
}

export interface ShiftGuideSessionMeta {
  expiresAt: number;
  idleExpiresAt: number;
  idleTimeoutMs: number;
}

interface StoredSessionMeta extends ShiftGuideSessionMeta {
  lastVerifiedAt: number;
}

interface UnlockPayload extends ShiftGuideData {
  session: ShiftGuideSessionMeta;
}

const SESSION_KEY = 'shiftguide_auth_token';
const DATA_KEY = 'shiftguide_data';
const SESSION_CHECK_INTERVAL_MS = 15_000;
const SESSION_REFRESH_THROTTLE_MS = 45_000;

let monitorStarted = false;
let lastLocalActivityAt = 0;
let verificationInFlight: Promise<'valid' | 'invalid' | 'unreachable'> | null = null;

function isSessionMeta(value: unknown): value is ShiftGuideSessionMeta {
  if (!value || typeof value !== 'object') return false;
  const session = value as Record<string, unknown>;
  return (
    typeof session.expiresAt === 'number' &&
    Number.isFinite(session.expiresAt) &&
    typeof session.idleExpiresAt === 'number' &&
    Number.isFinite(session.idleExpiresAt) &&
    typeof session.idleTimeoutMs === 'number' &&
    Number.isFinite(session.idleTimeoutMs) &&
    session.idleTimeoutMs > 0
  );
}

function readStoredSession(): StoredSessionMeta | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isSessionMeta(parsed)) {
      clearLocalSession();
      return null;
    }
    const stored = parsed as StoredSessionMeta;
    if (!Number.isFinite(stored.lastVerifiedAt)) {
      clearLocalSession();
      return null;
    }
    const now = Date.now();
    if (now >= stored.expiresAt || now >= stored.idleExpiresAt) {
      clearLocalSession();
      return null;
    }
    return stored;
  } catch {
    clearLocalSession();
    return null;
  }
}

function storeSession(session: ShiftGuideSessionMeta) {
  const stored: StoredSessionMeta = {
    ...session,
    lastVerifiedAt: Date.now(),
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(stored));
}

function clearLocalSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(DATA_KEY);
  } catch {
    // Storage can be unavailable in hardened/private browser contexts.
  }
}

function forceRelock() {
  clearLocalSession();
  window.dispatchEvent(new CustomEvent('shiftguide:locked'));
  window.location.reload();
}

async function verifyServerSession(): Promise<'valid' | 'invalid' | 'unreachable'> {
  if (verificationInFlight) return verificationInFlight;

  verificationInFlight = (async () => {
    try {
      const response = await fetch('/api/shiftguide/session', {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          clearLocalSession();
          return 'invalid';
        }
        return 'unreachable';
      }

      const payload = (await response.json()) as { session?: unknown };
      if (!isSessionMeta(payload.session)) {
        clearLocalSession();
        return 'invalid';
      }

      storeSession(payload.session);
      return 'valid';
    } catch {
      return 'unreachable';
    } finally {
      verificationInFlight = null;
    }
  })();

  return verificationInFlight;
}

function ensureSessionMonitor() {
  if (monitorStarted || typeof window === 'undefined' || typeof document === 'undefined') return;
  monitorStarted = true;
  lastLocalActivityAt = Date.now();

  const noteActivity = () => {
    lastLocalActivityAt = Date.now();
    const session = readStoredSession();
    if (
      session &&
      navigator.onLine &&
      lastLocalActivityAt - session.lastVerifiedAt >= SESSION_REFRESH_THROTTLE_MS
    ) {
      void verifyServerSession().then((result) => {
        if (result === 'invalid') forceRelock();
      });
    }
  };

  window.addEventListener('pointerdown', noteActivity, { passive: true });
  window.addEventListener('touchstart', noteActivity, { passive: true });
  window.addEventListener('keydown', noteActivity);
  window.addEventListener('online', noteActivity);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') noteActivity();
  });

  if (navigator.onLine) {
    void verifyServerSession().then((result) => {
      if (result === 'invalid') forceRelock();
    });
  }

  window.setInterval(() => {
    const hadSessionMarker = Boolean(sessionStorage.getItem(SESSION_KEY));
    const session = readStoredSession();
    if (!session) {
      if (hadSessionMarker) forceRelock();
      return;
    }

    const now = Date.now();
    const activityNeedsRefresh = lastLocalActivityAt > session.lastVerifiedAt;
    if (
      activityNeedsRefresh &&
      navigator.onLine &&
      now - session.lastVerifiedAt >= SESSION_REFRESH_THROTTLE_MS
    ) {
      void verifyServerSession().then((result) => {
        if (result === 'invalid') forceRelock();
      });
    }
  }, SESSION_CHECK_INTERVAL_MS);
}

export function isShiftGuideUnlocked(): boolean {
  if (typeof window === 'undefined') return false;
  const session = readStoredSession();
  if (!session) return false;
  ensureSessionMonitor();
  return true;
}

export function getShiftGuideData(): ShiftGuideData | null {
  try {
    const raw = sessionStorage.getItem(DATA_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ShiftGuideData;
  } catch {
    return null;
  }
}

export async function refreshShiftGuideSession(): Promise<boolean> {
  const result = await verifyServerSession();
  return result === 'valid';
}

export async function unlockShiftGuide(code: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch('/api/shiftguide/unlock', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
      const message = typeof body?.error === 'string' ? body.error : 'Code incorrect.';
      return { ok: false, error: message };
    }

    const payload = (await response.json()) as UnlockPayload;
    if (!isSessionMeta(payload.session)) {
      return { ok: false, error: 'Réponse de session invalide.' };
    }

    const { session, ...data } = payload;
    storeSession(session);
    sessionStorage.setItem(DATA_KEY, JSON.stringify(data));
    ensureSessionMonitor();
    return { ok: true };
  } catch {
    return { ok: false, error: 'Erreur réseau.' };
  }
}

export function lockShiftGuide() {
  clearLocalSession();
  void fetch('/api/shiftguide/logout', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    keepalive: true,
  }).catch(() => undefined);
}
