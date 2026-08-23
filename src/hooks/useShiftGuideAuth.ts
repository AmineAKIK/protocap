import {
  clearCelineHistory,
  reconcileCelineAuthorityRevision,
  reconcileShiftGuideConfigRevision,
} from '../../shared/shiftGuidePersistence.js';
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

function clearStoredShiftGuideAuth() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(DATA_KEY);
  sessionStorage.removeItem(EXPIRY_KEY);
  sessionStorage.removeItem(REVISION_KEY);
  sessionStorage.removeItem(CELINE_AUTHORITY_REVISION_KEY);
  clearCelineHistory(sessionStorage);
  // Migration cleanup: old builds stored Celine history persistently on the workstation.
  clearCelineHistory(localStorage);
}

function notifySessionInvalidated() {
  window.dispatchEvent(new Event(SHIFTGUIDE_SESSION_INVALIDATED_EVENT));
}

export function getShiftGuideSessionExpiry(): number | null {
  const raw = sessionStorage.getItem(EXPIRY_KEY);
  if (!raw) return null;
  const expiresAt = Number(raw);
  return Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt : null;
}

export function getShiftGuideConfigRevision(): string | null {
  const revision = sessionStorage.getItem(REVISION_KEY);
  return revision && revision.length > 0 ? revision : null;
}

export function getCelineAuthorityRevision(): string | null {
  const revision = sessionStorage.getItem(CELINE_AUTHORITY_REVISION_KEY);
  return revision && revision.length > 0 ? revision : null;
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
      sessionStorage.setItem(EXPIRY_KEY, String(body.expiresAt));
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

    // Every successful unlock starts a fresh conversational memory scope.
    clearCelineHistory(sessionStorage);
    // Remove legacy persistent conversation data from pre-session-scoped builds.
    clearCelineHistory(localStorage);
    reconcileShiftGuideConfigRevision(localStorage, validatedResponse.configRevision);
    reconcileCelineAuthorityRevision(localStorage, validatedResponse.celineAuthorityRevision);
    sessionStorage.setItem(SESSION_KEY, validatedResponse.token);
    sessionStorage.setItem(EXPIRY_KEY, String(validatedResponse.expiresAt));
    sessionStorage.setItem(REVISION_KEY, validatedResponse.configRevision);
    sessionStorage.setItem(
      CELINE_AUTHORITY_REVISION_KEY,
      validatedResponse.celineAuthorityRevision
    );
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
