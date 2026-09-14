import { Bot, Boxes, Calculator, ClipboardCheck, FileText, FlaskConical, Home, Library, RadioTower } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { APP_HEADER_HEIGHT_PX, RESPONSIVE_SHELL_CSS_VARS } from '../layout/responsiveGeometry';
import { PageFrame } from './PageFrame';

const navItems = [
  { to: '/', label: 'Accueil', icon: Home },
  { to: '/rapport', label: 'Rapport', icon: FileText },
  { to: '/proposition-pilote', label: 'Pilote', icon: FlaskConical },
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
  const shellGeometry = {
    [RESPONSIVE_SHELL_CSS_VARS.appHeaderHeight]: `${APP_HEADER_HEIGHT_PX}px`,
  } as CSSProperties;

  return (
    <div className="min-h-screen bg-slate-50" style={shellGeometry} data-app-shell>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <PageFrame className="app-shell-header-inner grid grid-cols-[auto_minmax(0,1fr)] items-center gap-6">
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-700 text-white">
              <Boxes size={18} />
            </span>
            <span className="hidden text-sm font-bold text-slate-950 sm:block">ProtoCap</span>
          </Link>

          <nav className="hidden min-w-0 items-center justify-end gap-0.5 xl:flex" aria-label="Navigation principale">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
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
        </PageFrame>
      </header>

      <main className="app-shell-content" data-shell-content>
        {children}
      </main>

      <nav
        className="app-shell-mobile-nav fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-sm xl:hidden"
        aria-label="Navigation principale"
      >
        <div className="grid grid-cols-4 sm:grid-cols-8">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-semibold transition-colors ${
                  isActive ? 'text-teal-700' : 'text-slate-400'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                  <span className="max-w-full whitespace-nowrap leading-none">{item.label.split(' ')[0]}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
