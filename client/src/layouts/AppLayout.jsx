import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard, Map, Siren, RadioTower, Truck, Building2, Construction, History, BarChart3, Network, Settings,
  LogOut, Menu, X, WifiOff, ChevronDown, User, Phone,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLive } from '../hooks/useLive';
import NotificationsMenu from '../components/NotificationsMenu';
import SimControls from '../components/SimControls';
import DemoPanel, { RunDemoButton } from '../components/DemoPanel';
import { NAV } from '../utils/constants';
import { clsx } from '../utils/format';

const ICONS = { LayoutDashboard, Map, Siren, RadioTower, Truck, Building2, Construction, History, BarChart3, Network, Settings, Phone };

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="4" fill="#16202b" stroke="#273748" />
        <rect x="13" y="6" width="6" height="20" fill="#e5484d" />
        <rect x="6" y="13" width="20" height="6" fill="#e5484d" />
      </svg>
      <div>
        <div className="text-base font-semibold leading-none text-fg">RapidResQ</div>
        <div className="mt-1 text-2xs uppercase tracking-wider text-faint">Dispatch simulation</div>
      </div>
    </div>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return <span className="font-mono text-sm text-fg">{now.toLocaleTimeString([], { hour12: false })}</span>;
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-ink-700" aria-expanded={open} aria-label="User menu">
        <span className="flex h-7 w-7 items-center justify-center rounded bg-ink-600 text-muted">
          <User size={15} />
        </span>
        <span className="hidden text-left md:block">
          <span className="block text-sm leading-4 text-fg">{user.fullName}</span>
          <span className="block text-2xs uppercase tracking-wider text-faint">{user.role}</span>
        </span>
        <ChevronDown size={14} className="text-faint" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded border border-line bg-ink-800 py-1">
          <Link to="/settings" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm text-fg hover:bg-ink-700 hover:no-underline">
            Settings
          </Link>
          <Link to="/terms" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm text-fg hover:bg-ink-700 hover:no-underline">
            Terms and Conditions
          </Link>
          <Link to="/privacy" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm text-fg hover:bg-ink-700 hover:no-underline">
            Privacy Policy
          </Link>
          <button type="button" onClick={logout} className="flex w-full items-center gap-2 border-t border-line px-4 py-2 text-left text-sm text-fg hover:bg-ink-700">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function Sidebar({ onNavigate }) {
  const { user } = useAuth();
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line px-5 py-4">
        <Logo />
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3" aria-label="Main">
        {NAV.map((group) => {
          const items = group.items.filter((i) => !i.roles || i.roles.includes(user.role));
          if (items.length === 0) return null;
          return (
            <div key={group.group} className="mb-4">
              <div className="px-2 pb-1 text-2xs font-semibold uppercase tracking-wider text-faint">{group.group}</div>
              {items.map((item) => {
                const Icon = ICONS[item.icon];
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-3 rounded px-2.5 py-2 text-sm hover:no-underline',
                        isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-ink-700 hover:text-fg',
                      )
                    }
                  >
                    <Icon size={17} />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>
      <div className="border-t border-line px-5 py-3 text-2xs leading-4 text-faint">
        <p>Simulation for coursework. Not for use in real emergencies.</p>
        <p className="mt-1.5 space-x-3">
          <Link to="/terms" className="text-muted">
            Terms
          </Link>
          <Link to="/privacy" className="text-muted">
            Privacy
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const { live, online } = useLive();
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);

  useEffect(() => setDrawer(false), [location.pathname]);

  const current = NAV.flatMap((g) => g.items).find((i) => location.pathname.startsWith(i.to));
  const critical = live ? live.kpis.criticalActive : 0;

  return (
    <div className="flex h-full bg-ink-900">
      <aside className="hidden w-60 shrink-0 border-r border-line bg-ink-800 lg:block">
        <Sidebar />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setDrawer(false)} />
          <aside className="relative h-full w-64 border-r border-line bg-ink-800">
            <button type="button" className="absolute right-3 top-4 text-muted" onClick={() => setDrawer(false)} aria-label="Close menu">
              <X size={18} />
            </button>
            <Sidebar onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-ink-800 px-4">
          <button type="button" className="rounded p-1.5 text-muted hover:bg-ink-700 lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{current ? current.label : 'RapidResQ'}</div>

          <div className="hidden items-center gap-5 text-xs md:flex">
            <div className="text-right">
              <div className="panel-title leading-none">Time</div>
              <Clock />
            </div>
            <div className="text-right">
              <div className="panel-title leading-none">Sim clock</div>
              <span className="font-mono text-sm text-fg">{live ? `${live.simClock.toFixed(1)} min` : '...'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={clsx('h-2 w-2 rounded-full', online ? (live && live.paused ? 'bg-warn' : 'bg-ok') : 'bg-crit')} />
              <span className="text-fg">{online ? (live && live.paused ? 'Paused' : 'Online') : 'Offline'}</span>
            </div>
            <Link to="/emergencies" className={clsx('flex items-center gap-2 hover:no-underline', critical > 0 ? 'text-crit' : 'text-muted')} title="Active critical emergencies">
              <Siren size={15} />
              <span className="font-mono text-sm">{critical}</span>
              <span>critical</span>
            </Link>
          </div>

          <div className="hidden xl:block">
            <SimControls compact />
          </div>
          <div className="hidden sm:block">
            <RunDemoButton size="sm" />
          </div>
          <NotificationsMenu />
          <UserMenu />
        </header>

        {!online && (
          <div className="flex items-center gap-2 border-b border-crit/40 bg-crit/15 px-4 py-2 text-sm text-red-100" role="alert">
            <WifiOff size={15} /> Connection to the server was lost. Retrying automatically.
          </div>
        )}

        <main className="min-h-0 flex-1 overflow-y-auto p-5">
          <Outlet />
        </main>
      </div>
      <DemoPanel />
    </div>
  );
}
