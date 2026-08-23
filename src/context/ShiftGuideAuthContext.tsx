import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import {
  getShiftGuideSessionExpiry,
  lockShiftGuide,
  logoutShiftGuide,
  SHIFTGUIDE_SESSION_INVALIDATED_EVENT,
  unlockShiftGuide,
  validateShiftGuideSession,
} from '../hooks/useShiftGuideAuth';
import type { ShiftGuideAuthResult } from '../hooks/useShiftGuideAuth';

type ShiftGuideAuthStatus = 'checking' | 'locked' | 'unlocked';

interface ShiftGuideAuthContextValue {
  status: ShiftGuideAuthStatus;
  unlock: (code: string) => Promise<ShiftGuideAuthResult>;
  logout: () => Promise<void>;
}

const ShiftGuideAuthContext = createContext<ShiftGuideAuthContextValue | null>(null);

export function ShiftGuideAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ShiftGuideAuthStatus>('checking');
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const authGenerationRef = useRef(0);
  const validationPromiseRef = useRef<Promise<boolean> | null>(null);

  const applyValidationResult = useCallback((valid: boolean) => {
    if (!valid) {
      setSessionExpiresAt(null);
      setStatus('locked');
      return;
    }

    const expiresAt = getShiftGuideSessionExpiry();
    if (!expiresAt || expiresAt <= Date.now()) {
      lockShiftGuide();
      return;
    }

    setSessionExpiresAt(expiresAt);
    setStatus('unlocked');
  }, []);

  const validateSession = useCallback(() => {
    if (!validationPromiseRef.current) {
      validationPromiseRef.current = validateShiftGuideSession().finally(() => {
        validationPromiseRef.current = null;
      });
    }
    return validationPromiseRef.current;
  }, []);

  const reconcileSession = useCallback(async () => {
    const generation = authGenerationRef.current;
    const valid = await validateSession();
    if (authGenerationRef.current === generation) {
      applyValidationResult(valid);
    }
    return valid;
  }, [applyValidationResult, validateSession]);

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      const generation = authGenerationRef.current;
      const valid = await validateSession();
      if (!cancelled && authGenerationRef.current === generation) {
        applyValidationResult(valid);
      }
    };

    const handleInvalidated = () => {
      authGenerationRef.current += 1;
      setSessionExpiresAt(null);
      setStatus('locked');
    };

    const handleFocus = () => {
      void reconcileSession();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void reconcileSession();
      }
    };

    void checkSession();
    window.addEventListener(SHIFTGUIDE_SESSION_INVALIDATED_EVENT, handleInvalidated);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.removeEventListener(SHIFTGUIDE_SESSION_INVALIDATED_EVENT, handleInvalidated);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [applyValidationResult, reconcileSession, validateSession]);

  useEffect(() => {
    if (status !== 'unlocked' || !sessionExpiresAt) return;

    const remainingMs = sessionExpiresAt - Date.now();
    if (remainingMs <= 0) {
      lockShiftGuide();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      lockShiftGuide();
    }, remainingMs);

    return () => window.clearTimeout(timeoutId);
  }, [sessionExpiresAt, status]);

  const unlock = useCallback(async (code: string) => {
    const result = await unlockShiftGuide(code);
    if (result.ok) {
      authGenerationRef.current += 1;
      const expiresAt = getShiftGuideSessionExpiry();
      if (!expiresAt || expiresAt <= Date.now()) {
        lockShiftGuide();
        return { ok: false, error: 'Session invalide.' };
      }
      setSessionExpiresAt(expiresAt);
      setStatus('unlocked');
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    authGenerationRef.current += 1;
    setSessionExpiresAt(null);
    setStatus('locked');
    await logoutShiftGuide();
  }, []);

  const value = useMemo(() => ({ status, unlock, logout }), [status, unlock, logout]);

  return (
    <ShiftGuideAuthContext.Provider value={value}>
      {children}
    </ShiftGuideAuthContext.Provider>
  );
}

export function useShiftGuideAuth() {
  const context = useContext(ShiftGuideAuthContext);
  if (!context) {
    throw new Error('useShiftGuideAuth must be used within ShiftGuideAuthProvider.');
  }
  return context;
}
