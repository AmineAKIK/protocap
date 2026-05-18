import { ArrowLeft, Boxes, ClipboardCheck, Home, Library, RadioTower } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Accueil', icon: Home },
  { to: '/expiry-check', label: 'Expiry Check', icon: ClipboardCheck },
  { to: '/logistics-call', label: 'Logistics Call', icon: RadioTower },
  { to: '/knowledge-base', label: 'Knowledge Base', icon: Library }
];

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-2 sm:gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-teal-700 text-white sm:h-10 sm:w-10">
              <Boxes size={22} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-slate-950">LineOps Toolkit</span>
              <span className="hidden text-xs text-slate-500 sm:block">Prototypes terrain génériques</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    isActive ? 'bg-teal-50 text-teal-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                  }`
                }
              >
                <item.icon size={17} />
                {item.label}
              </NavLink>
            ))}
          </nav>
          {!isHome ? (
            <Link className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:px-3" to="/">
              <ArrowLeft size={17} />
              <span className="hidden min-[380px]:inline">Accueil</span>
            </Link>
          ) : null}
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3 py-2 md:hidden">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  isActive ? 'bg-teal-50 text-teal-800' : 'text-slate-600'
                }`
              }
            >
              <item.icon size={17} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
