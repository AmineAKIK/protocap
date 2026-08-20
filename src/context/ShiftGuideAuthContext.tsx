import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import {
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

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      const valid = await validateShiftGuideSession();
      if (!cancelled) setStatus(valid ? 'unlocked' : 'locked');
    };

    const handleInvalidated = () => setStatus('locked');

    void checkSession();
    window.addEventListener(SHIFTGUIDE_SESSION_INVALIDATED_EVENT, handleInvalidated);

    return () => {
      cancelled = true;
      window.removeEventListener(SHIFTGUIDE_SESSION_INVALIDATED_EVENT, handleInvalidated);
    };
  }, []);

  const unlock = useCallback(async (code: string) => {
    const result = await unlockShiftGuide(code);
    if (result.ok) setStatus('unlocked');
    return result;
  }, []);

  const logout = useCallback(async () => {
    await logoutShiftGuide();
    setStatus('locked');
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
