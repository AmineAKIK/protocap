import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ShiftGuideDesktopNavigation,
  ShiftGuideMobileNavigation,
} from './shiftguide/ShiftGuideNavigation';
import { useShiftGuideAuth } from '../context/ShiftGuideAuthContext';
import { useShiftGuideStorageHealth } from '../features/shiftguide/useShiftGuideStorageHealth';
import { useShiftGuideShell } from '../hooks/useShiftGuideShell';

export function ShiftGuideLayout() {
  const { logout } = useShiftGuideAuth();
  const {
    persistentStorageDegraded,
    concurrencyProtectionDegraded,
  } = useShiftGuideStorageHealth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [loggingOut, setLoggingOut] = useState(false);
  const {
    isCelineRoute,
    isMobileViewport,
    celineViewportHeight,
  } = useShiftGuideShell(pathname);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    await logout();
    void navigate('/', { replace: true });
  };

  const shellClass = isCelineRoute && isMobileViewport
    ? 'shiftguide-shell h-[100dvh] overflow-hidden bg-[#f3f5f7]'
    : 'shiftguide-shell min-h-screen bg-[#f3f5f7]';

  const degradedMessage = persistentStorageDegraded
    ? 'Persistance locale indisponible. Le travail reste utilisable dans cette page, mais certains changements peuvent être perdus après rechargement.'
    : concurrencyProtectionDegraded
      ? 'Protection multi-onglets indisponible. Évite de modifier ShiftGuide dans plusieurs onglets en même temps.'
      : null;

  return (
    <div className={shellClass}>
      <ShiftGuideDesktopNavigation loggingOut={loggingOut} onLogout={handleLogout} />

      {degradedMessage && (
        <div
          role="status"
          className="fixed left-1/2 top-3 z-[70] w-[min(92vw,42rem)] -translate-x-1/2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950 shadow-lg"
        >
          {degradedMessage}
        </div>
      )}

      <div
        className={
          isCelineRoute
            ? 'h-[calc(100dvh_-_5rem_-_env(safe-area-inset-bottom))] overflow-hidden lg:h-auto lg:overflow-visible lg:pl-24 [&>div]:h-full [&>div]:min-h-0 [&>div]:overflow-hidden lg:[&>div]:h-[100dvh] lg:[&>div]:overflow-visible'
            : 'pb-[calc(5rem_+_env(safe-area-inset-bottom))] lg:pb-0 lg:pl-24'
        }
        style={
          isCelineRoute && isMobileViewport && celineViewportHeight !== null
            ? { height: `${celineViewportHeight}px` }
            : undefined
        }
      >
        <Outlet />
      </div>

      <ShiftGuideMobileNavigation loggingOut={loggingOut} onLogout={handleLogout} />
    </div>
  );
}
