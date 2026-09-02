import {
  clearCelineHistory,
  reconcileCelineAuthorityRevision,
  reconcileShiftGuideConfigRevision,
} from '../../shared/shiftGuidePersistence.js';
import {
  bestEffortSessionStorage,
  getShiftGuidePersistentStorage,
  readShiftGuideSessionItem,
  removeShiftGuideSessionItems,
  writeShiftGuideSession,
} from '../features/shiftguide/shiftGuideStorage';
import { isShiftGuideData } from '../types/shiftGuide';
import type { ShiftGuideData } from '../types/shiftGuide';

interface ShiftGuideUnlockResponse extends ShiftGuideData {
  token: string;
  expiresAt: number;
  configRevision: string;
  celineAuthorityRevision: string;
}

export interface ShiftGuideAuthResult {
  ok: boolean;
  error?: string;
}

export const SHIFTGUIDE_SESSION_INVALIDATED_EVENT = 'shiftguide:session-invalidated';

const SESSION_KEY = 'shiftguide_auth_token';
const DATA_KEY = 'shiftguide_data';
const EXPIRY_KEY = 'shiftguide_session_expires_at';
const REVISION_KEY = 'shiftguide_session_config_revision';
const CELINE_AUTHORITY_REVISION_KEY = 'shiftguide_session_celine_authority_revision';
const AUTH_STORAGE_KEYS = [
  SESSION_KEY,
  DATA_KEY,
  EXPIRY_KEY,
  REVISION_KEY,
  CELINE_AUTHORITY_REVISION_KEY,
];

function clearStoredShiftGuideAuth() {
  removeShiftGuideSessionItems(AUTH_STORAGE_KEYS);
  clearCelineHistory(bestEffortSessionStorage());
  // Migration cleanup: old builds stored Celine history persistently on the workstation.
  clearCelineHistory(getShiftGuidePersistentStorage());
}

function notifySessionInvalidated() {
  window.dispatchEvent(new Event(SHIFTGUIDE_SESSION_INVALIDATED_EVENT));
}

export function getShiftGuideSessionExpiry(): number | null {
  const raw = readShiftGuideSessionItem(EXPIRY_KEY);
  if (!raw) return null;
  const expiresAt = Number(raw);
  return Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt : null;
}

export function getShiftGuideConfigRevision(): string | null {
  const revision = readShiftGuideSessionItem(REVISION_KEY);
  return revision && revision.length > 0 ? revision : null;
}

export function getCelineAuthorityRevision(): string | null {
  const revision = readShiftGuideSessionItem(CELINE_AUTHORITY_REVISION_KEY);
  return revision && revision.length > 0 ? revision : null;
}

export function getShiftGuideToken(): string | null {
  return readShiftGuideSessionItem(SESSION_KEY);
}

export function getShiftGuideData(): ShiftGuideData | null {
  const raw = readShiftGuideSessionItem(DATA_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isShiftGuideData(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function isShiftGuideUnlocked(): boolean {
  const expiresAt = getShiftGuideSessionExpiry();
  const configRevision = getShiftGuideConfigRevision();
  const celineAuthorityRevision = getCelineAuthorityRevision();
  if (!expiresAt || expiresAt <= Date.now() || !configRevision || !celineAuthorityRevision) {
    clearStoredShiftGuideAuth();
    return false;
  }
  return !!getShiftGuideToken() && !!getShiftGuideData();
}

export async function validateShiftGuideSession(): Promise<boolean> {
  const token = getShiftGuideToken();
  const data = getShiftGuideData();
  const expiresAt = getShiftGuideSessionExpiry();
  const configRevision = getShiftGuideConfigRevision();
  const celineAuthorityRevision = getCelineAuthorityRevision();
  if (
    !token ||
    !data ||
    !expiresAt ||
    expiresAt <= Date.now() ||
    !configRevision ||
    !celineAuthorityRevision
  ) {
    clearStoredShiftGuideAuth();
    return false;
  }

  try {
    const res = await fetch('/api/shiftguide/session', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const body: unknown = await res.json().catch(() => null);
      if (
        !body ||
        typeof body !== 'object' ||
        !('expiresAt' in body) ||
        typeof body.expiresAt !== 'number' ||
        !Number.isFinite(body.expiresAt) ||
        body.expiresAt <= Date.now() ||
        !('configRevision' in body) ||
        typeof body.configRevision !== 'string' ||
        body.configRevision.length === 0 ||
        body.configRevision !== configRevision ||
        !('celineAuthorityRevision' in body) ||
        typeof body.celineAuthorityRevision !== 'string' ||
        body.celineAuthorityRevision.length === 0 ||
        body.celineAuthorityRevision !== celineAuthorityRevision
      ) {
        clearStoredShiftGuideAuth();
        return false;
      }
      if (!writeShiftGuideSession([[EXPIRY_KEY, String(body.expiresAt)]])) {
        clearStoredShiftGuideAuth();
        return false;
      }
      return true;
    }

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
    if (
      !response ||
      typeof response !== 'object' ||
      !('token' in response) ||
      !('expiresAt' in response) ||
      !('configRevision' in response) ||
      !('celineAuthorityRevision' in response)
    ) {
      return { ok: false, error: 'Session invalide.' };
    }

    const {
      token,
      expiresAt,
      configRevision,
      celineAuthorityRevision,
      ...data
    } = response as Record<string, unknown>;
    if (
      typeof token !== 'string' ||
      token.length === 0 ||
      typeof expiresAt !== 'number' ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now() ||
      typeof configRevision !== 'string' ||
      configRevision.length === 0 ||
      typeof celineAuthorityRevision !== 'string' ||
      celineAuthorityRevision.length === 0 ||
      !isShiftGuideData(data)
    ) {
      return { ok: false, error: 'Données ShiftGuide invalides.' };
    }

    const validatedResponse: ShiftGuideUnlockResponse = {
      token,
      expiresAt,
      configRevision,
      celineAuthorityRevision,
      ...data,
    };

    const persisted = writeShiftGuideSession([
      [SESSION_KEY, validatedResponse.token],
      [EXPIRY_KEY, String(validatedResponse.expiresAt)],
      [REVISION_KEY, validatedResponse.configRevision],
      [CELINE_AUTHORITY_REVISION_KEY, validatedResponse.celineAuthorityRevision],
      [DATA_KEY, JSON.stringify(data)],
    ]);
    if (!persisted) {
      clearStoredShiftGuideAuth();
      return { ok: false, error: 'Stockage de session indisponible.' };
    }

    const persistentStorage = getShiftGuidePersistentStorage();
    // Every successful unlock starts a fresh conversational memory scope.
    clearCelineHistory(bestEffortSessionStorage());
    // Remove legacy persistent conversation data from pre-session-scoped builds.
    clearCelineHistory(persistentStorage);
    reconcileShiftGuideConfigRevision(persistentStorage, validatedResponse.configRevision);
    reconcileCelineAuthorityRevision(persistentStorage, validatedResponse.celineAuthorityRevision);
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

  // Logout is local-first: credentials and protected conversational memory must
  // disappear before any best-effort network revocation can block or fail.
  lockShiftGuide();

  if (!token) return;

  void fetch('/api/shiftguide/session', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {
    // Server revocation is best-effort once the browser session is already locked.
  });
}
