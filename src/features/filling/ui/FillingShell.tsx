import {
  Archive,
  CloudOff,
  Database,
  Gauge,
  LockKeyhole,
  Settings2,
  Wifi,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

const links = [
  { to: '/shiftguide/remplissage', label: 'Réglage', icon: Gauge, end: true },
  { to: '/shiftguide/remplissage/profils', label: 'Profils', icon: Settings2 },
  { to: '/shiftguide/remplissage/historique', label: 'Historique', icon: Archive },
  { to: '/shiftguide/remplissage/sauvegarde', label: 'Sauvegarde', icon: Database },
];

export function FillingShell({
  children,
  onLock,
}: {
  children: ReactNode;
  onLock?: () => void;
}) {
  const online = typeof navigator === 'undefined' ? true : navigator.onLine;
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950 text-white shadow-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-3 sm:px-6">
          <Link
            to="/shiftguide/modules"
            className="grid min-h-12 min-w-12 place-items-center rounded-xl bg-teal-400 text-slate-950"
            aria-label="Retour à ShiftGuide"
          >
            <Gauge size={22} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-black sm:text-lg">Assistant remplissage</p>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-teal-200">
              <span>Gold personnelle</span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1 normal-case tracking-normal">
                {online ? <Wifi size={12} /> : <CloudOff size={12} />}
                {online ? 'connecté' : 'hors ligne'}
              </span>
            </div>
          </div>
          {onLock ? (
            <button
              type="button"
              onClick={onLock}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/15 px-3 text-sm font-black text-white transition hover:bg-white/10"
            >
              <LockKeyhole size={17} />
              <span className="hidden sm:inline">Verrouiller</span>
            </button>
          ) : null}
        </div>
        <nav className="mx-auto grid max-w-7xl grid-cols-4 border-t border-white/10 px-1 sm:flex sm:px-6">
          {links.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex min-h-12 items-center justify-center gap-1.5 border-b-2 px-2 text-[11px] font-black sm:text-sm ${
                  isActive
                    ? 'border-teal-300 text-teal-200'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`
              }
              aria-current={location.pathname === item.to ? 'page' : undefined}
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}

