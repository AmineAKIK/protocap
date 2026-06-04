import { Bot, Boxes, Calculator, ClipboardCheck, FileText, Home, Library, RadioTower } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Accueil', icon: Home },
  { to: '/rapport', label: 'Rapport', icon: FileText },
  { to: '/shiftguide', label: 'ShiftGuide', icon: Bot },
  { to: '/expiry-check', label: 'Expiry Check', icon: ClipboardCheck },
  { to: '/logistics-call', label: 'Logistics Call', icon: RadioTower },
  { to: '/knowledge-base', label: 'Knowledge Base', icon: Library },
  { to: '/packing-calculator', label: 'Packing Calculator', icon: Calculator }
];

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" style={{ height: '56px' }}>

          {/* Logo */}
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-700 text-white">
              <Boxes size={18} />
            </span>
            <span className="text-sm font-bold text-slate-950 hidden sm:block">LineOps Toolkit</span>
          </Link>

          {/* Desktop nav — centred */}
          <nav className="absolute left-1/2 -translate-x-1/2 hidden items-center gap-0.5 xl:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-teal-700 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <item.icon size={15} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden w-32 xl:block" />
        </div>
      </header>

      {/* Page content — padding-bottom on mobile to avoid bottom nav overlap */}
      <main className="pb-[calc(5rem_+_env(safe-area-inset-bottom))] xl:pb-0">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm xl:hidden">
        <div className="grid grid-cols-7">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-semibold transition-colors ${
                  isActive ? 'text-teal-700' : 'text-slate-400'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                  <span className="truncate max-w-[52px]">{item.label.split(' ')[0]}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
