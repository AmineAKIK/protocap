import {
  AlertTriangle,
  BookOpen,
  Bot,
  FileSearch,
  Grid2x2,
  Home,
  LogOut,
  RadioTower,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useShiftGuideAuth } from '../context/ShiftGuideAuthContext';

const navigation = [
  { to: '/shiftguide', label: 'Accueil', icon: Home, end: true },
  { to: '/shiftguide/celine', label: 'Céline', icon: Bot },
  { to: '/shiftguide/linepulse', label: 'Pulse', icon: RadioTower },
  { to: '/shiftguide/analyse-ligne', label: 'Analyse', icon: FileSearch },
  { to: '/shiftguide/lexique', label: 'Lexique', icon: BookOpen },
  { to: '/shiftguide/urgences', label: 'Urgences', icon: AlertTriangle },
] as const;

function navClass(isActive: boolean, danger = false) {
  if (danger) {
    return 'text-red-300 hover:bg-red-500/10 hover:text-red-200';
  }
  return isActive
    ? 'bg-teal-400/15 text-teal-200 ring-1 ring-teal-300/20'
    : 'text-zinc-400 hover:bg-white/10 hover:text-white';
}

function resetShiftGuideScroll() {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  document.querySelectorAll<HTMLElement>('.shiftguide-shell *').forEach((element) => {
    const { overflowY } = window.getComputedStyle(element);
    if ((overflowY === 'auto' || overflowY === 'scroll') && element.scrollTop !== 0) {
      element.scrollTop = 0;
    }
  });
}

export function ShiftGuideLayout() {
  const { logout } = useShiftGuideAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loggingOut, setLoggingOut] = useState(false);
  const [celineViewportHeight, setCelineViewportHeight] = useState<number | null>(null);
  const isCelineRoute = location.pathname === '/shiftguide/celine';
  const isMobileViewport = window.matchMedia('(max-width: 1023px)').matches;

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  useEffect(() => {
    resetShiftGuideScroll();

    const frame = window.requestAnimationFrame(() => {
      resetShiftGuideScroll();

      if (isCelineRoute && window.matchMedia('(min-width: 1024px)').matches) {
        const input = document.querySelector<HTMLInputElement>(
          '.shiftguide-shell input[type="text"]'
        );
        input?.focus({ preventScroll: true });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isCelineRoute, location.pathname]);

  useEffect(() => {
    if (!isCelineRoute) return;

    const media = window.matchMedia('(max-width: 1023px)');
    const viewport = window.visualViewport;

    const updateViewportHeight = () => {
      if (!media.matches) {
        setCelineViewportHeight(null);
        return;
      }

      const visibleHeight = viewport?.height ?? window.innerHeight;
      const visibleOffsetTop = viewport?.offsetTop ?? 0;
      const obscuredHeight = Math.max(
        0,
        window.innerHeight - visibleHeight - visibleOffsetTop
      );
      const keyboardOpen = obscuredHeight > 120;
      const mobileNavReserve = keyboardOpen ? 0 : 80;

      setCelineViewportHeight(
        Math.max(320, Math.floor(visibleHeight - mobileNavReserve))
      );
    };

    const initialFrame = window.requestAnimationFrame(updateViewportHeight);
    window.addEventListener('resize', updateViewportHeight);
    viewport?.addEventListener('resize', updateViewportHeight);
    viewport?.addEventListener('scroll', updateViewportHeight);
    media.addEventListener('change', updateViewportHeight);

    return () => {
      window.cancelAnimationFrame(initialFrame);
      window.removeEventListener('resize', updateViewportHeight);
      viewport?.removeEventListener('resize', updateViewportHeight);
      viewport?.removeEventListener('scroll', updateViewportHeight);
      media.removeEventListener('change', updateViewportHeight);
    };
  }, [isCelineRoute]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="shiftguide-shell min-h-screen bg-[#f3f5f7]">
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-24 border-r border-zinc-800 bg-zinc-950 lg:flex lg:flex-col">
        <div className="flex h-20 items-center justify-center border-b border-white/10">
          <NavLink
            to="/shiftguide"
            end
            className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-400 text-zinc-950 shadow-lg shadow-teal-950/20"
            aria-label="Accueil ShiftGuide"
          >
            <Grid2x2 size={20} />
          </NavLink>
        </div>

        <nav className="flex flex-1 flex-col gap-1.5 px-2 py-4" aria-label="Navigation ShiftGuide">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={'end' in item ? item.end : false}
                className={({ isActive }) =>
                  `flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-black transition ${navClass(isActive)}`
                }
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-2">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className={`flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-black transition disabled:opacity-50 ${navClass(false, true)}`}
          >
            <LogOut size={18} />
            <span>{loggingOut ? 'Sortie…' : 'Quitter'}</span>
          </button>
        </div>
      </aside>

      <div
        className={
          isCelineRoute
            ? 'h-[calc(100dvh_-_5rem_-_env(safe-area-inset-bottom))] overflow-hidden lg:h-auto lg:overflow-visible lg:pl-24 [&>div]:h-full lg:[&>div]:h-[100dvh]'
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

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-800 bg-zinc-950 pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Navigation ShiftGuide"
      >
        <div className="flex overflow-x-auto px-1 py-1.5" style={{ scrollbarWidth: 'none' }}>
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={'end' in item ? item.end : false}
                className={({ isActive }) =>
                  `flex min-h-14 min-w-16 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[10px] font-black transition ${navClass(isActive)}`
                }
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className={`flex min-h-14 min-w-16 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[10px] font-black transition disabled:opacity-50 ${navClass(false, true)}`}
          >
            <LogOut size={18} />
            <span>{loggingOut ? 'Sortie…' : 'Quitter'}</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
