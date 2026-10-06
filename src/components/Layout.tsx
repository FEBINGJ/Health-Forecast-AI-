import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, BrainCircuit, ChevronDown, LayoutDashboard, LogOut, Plus, Search, Settings, User, UserPlus, Users } from 'lucide-react';
import { useApp, useStats } from '../store/AppStore';
import { useToast } from './Toast';
import { DoctorAvatar, Logo, RiskBadge, SEVERITY_STYLES, SeverityIcon } from './ui';
import { cn } from '../utils/cn';
import { timeAgo } from '../lib/format';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/patients', label: 'Patients', icon: Users, end: false },
  { to: '/add-patient', label: 'Add Patient', icon: UserPlus, end: false },
  { to: '/alerts', label: 'Alerts', icon: Bell, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
];

function useClickOutside(ref: RefObject<HTMLElement | null>, onOutside: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const h = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener('mousedown', h);
    document.addEventListener('touchstart', h);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('touchstart', h);
    };
  }, [ref, onOutside, active]);
}

/* ------------------------------------------------------------------ */

function HeaderSearch() {
  const { state, predictions } = useApp();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return state.patients.filter((p) => p.name.toLowerCase().includes(s) || p.id.toLowerCase().includes(s)).slice(0, 6);
  }, [q, state.patients]);

  const go = (id: string) => {
    setOpen(false);
    setQ('');
    navigate(`/patients/${id}`);
  };

  return (
    <div ref={ref} className="relative hidden lg:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) go(results[0].id);
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder="Search patient name or ID…"
        aria-label="Search patients"
        className="h-9 w-64 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/15 xl:w-80"
      />
      {open && q.trim() && (
        <div className="absolute right-0 top-11 w-full animate-pop-in overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          {results.length ? (
            results.map((p) => {
              const pr = predictions.get(p.id);
              return (
                <button key={p.id} onClick={() => go(p.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50">
                  <span className="font-mono text-xs text-slate-500">{p.id}</span>
                  <span className="flex-1 truncate text-sm font-medium text-slate-800">{p.name}</span>
                  {pr && <RiskBadge level={pr.deterioration.level} size="sm" />}
                </button>
              );
            })
          ) : (
            <p className="px-3 py-3 text-sm text-slate-500">No patients match “{q}”.</p>
          )}
        </div>
      )}
    </div>
  );
}

function AlertsMenu() {
  const { state, dispatch } = useApp();
  const stats = useStats();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  const names = useMemo(() => new Map(state.patients.map((p) => [p.id, p.name])), [state.patients]);
  const active = useMemo(
    () =>
      state.alerts
        .filter((a) => !a.acknowledged && a.severity !== 'info')
        .sort((a, b) => b.t - a.t)
        .slice(0, 6),
    [state.alerts],
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative grid h-10 w-10 place-items-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
        aria-label={`Notifications, ${stats.activeAlerts} active alerts`}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {stats.activeAlerts > 0 && (
          <span className="absolute right-0.5 top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {stats.activeAlerts > 99 ? '99+' : stats.activeAlerts}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-16 z-50 animate-pop-in overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Notifications</p>
              <p className="text-xs text-slate-500">
                {stats.activeAlerts} active · {stats.activeCritical} critical
              </p>
            </div>
            {active.length > 0 && (
              <button
                onClick={() => dispatch({ type: 'ACK_ALL', at: Date.now(), ids: active.map((a) => a.id) })}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                Acknowledge shown
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {active.length ? (
              active.map((a) => (
                <button
                  key={a.id}
                  onClick={() => {
                    setOpen(false);
                    navigate(`/patients/${a.patientId}?tab=vitals`);
                  }}
                  className="flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50"
                >
                  <span className={cn('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full', SEVERITY_STYLES[a.severity].bg)}>
                    <SeverityIcon severity={a.severity} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-900">{a.title}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {a.patientId} · {names.get(a.patientId)} — {a.detail}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-400">{timeAgo(a.t)}</span>
                  </span>
                </button>
              ))
            ) : (
              <div className="px-4 py-10 text-center text-sm text-slate-500">You’re all caught up — no active alerts.</div>
            )}
          </div>
          <Link to="/alerts" onClick={() => setOpen(false)} className="block bg-slate-50 px-4 py-2.5 text-center text-sm font-semibold text-blue-600 hover:bg-slate-100">
            View all alerts
          </Link>
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, children, onClick, danger }: { icon: ReactNode; children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition',
        danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-100',
      )}
    >
      <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      {children}
    </button>
  );
}

function UserMenu() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full p-0.5 transition hover:bg-slate-100 lg:pr-2"
        aria-label="Account menu"
        aria-expanded={open}
      >
        <DoctorAvatar className="h-9 w-9" />
        <span className="hidden text-left lg:block">
          <span className="block text-sm font-semibold leading-tight text-slate-900">{state.profile.displayName}</span>
          <span className="block text-[11px] leading-tight text-slate-500">{state.profile.role}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-slate-400 lg:block" />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-64 animate-pop-in overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center gap-3 border-b border-slate-100 p-4">
            <DoctorAvatar className="h-11 w-11" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{state.profile.fullName}</p>
              <p className="truncate text-xs text-slate-500">{state.profile.email}</p>
            </div>
          </div>
          <div className="p-1.5">
            <MenuItem
              icon={<User />}
              onClick={() => {
                setOpen(false);
                navigate('/settings');
              }}
            >
              Profile & settings
            </MenuItem>
            <MenuItem
              icon={<LogOut />}
              danger
              onClick={() => {
                setOpen(false);
                dispatch({ type: 'LOGOUT' });
                navigate('/login');
              }}
            >
              Log out
            </MenuItem>
          </div>
        </div>
      )}
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 h-14 border-b border-slate-200 bg-white/95 backdrop-blur md:h-16">
      <div className="flex h-full items-center gap-3 px-3 sm:px-5">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <Logo className="h-7 w-7 shrink-0 md:h-8 md:w-8" />
          <span className="line-clamp-2 text-[14px] font-bold leading-[1.15] tracking-tight text-slate-900 sm:line-clamp-1 sm:truncate sm:text-[15px] md:text-base">
            Clinical Risk Prediction System
          </span>
        </Link>
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <HeaderSearch />
          <AlertsMenu />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

function Sidebar({ alertCount }: { alertCount: number }) {
  return (
    <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-[84px] shrink-0 flex-col border-r border-slate-200 bg-white md:flex lg:w-60">
      <nav className="flex-1 space-y-1 overflow-y-auto p-2 lg:p-3" aria-label="Main navigation">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'group relative flex flex-col items-center gap-1 rounded-lg px-1.5 py-2.5 text-[11px] font-medium transition-colors lg:flex-row lg:gap-3 lg:px-3 lg:text-sm',
                isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute bottom-2 left-0 top-2 hidden w-1 rounded-r bg-blue-600 lg:block" />}
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {label === 'Alerts' && alertCount > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white lg:hidden">
                      {alertCount > 99 ? '99+' : alertCount}
                    </span>
                  )}
                </span>
                <span className="text-center leading-tight">{label}</span>
                {label === 'Alerts' && alertCount > 0 && (
                  <span className="ml-auto hidden rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white lg:inline">{alertCount}</span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="hidden p-3 lg:block">
        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-blue-50 to-white p-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
            <BrainCircuit className="h-4 w-4 text-blue-600" /> AI Risk Engine
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
            <span className="h-2 w-2 animate-pulse-ring rounded-full bg-emerald-500" /> Online · v2.3
          </div>
          <p className="mt-1 text-[11px] leading-snug text-slate-500">Predictions update automatically with every new observation.</p>
        </div>
      </div>
    </aside>
  );
}

function BottomNav({ alertCount }: { alertCount: number }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Main navigation">
      <div className="grid h-16 grid-cols-5">
        {NAV.map(({ to, label, icon: Icon, end }) =>
          to === '/add-patient' ? (
            <NavLink key={to} to={to} className="flex flex-col items-center justify-center" aria-label="Add patient">
              {({ isActive }) => (
                <span
                  className={cn(
                    '-mt-6 grid h-14 w-14 place-items-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-4 ring-white transition active:scale-95',
                    isActive && 'bg-blue-700',
                  )}
                >
                  <Plus className="h-6 w-6" />
                </span>
              )}
            </NavLink>
          ) : (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => cn('relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium', isActive ? 'text-blue-700' : 'text-slate-500')}
            >
              <span className="relative">
                <Icon className="h-5 w-5" />
                {label === 'Alerts' && alertCount > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {alertCount > 99 ? '99+' : alertCount}
                  </span>
                )}
              </span>
              {label === 'Dashboard' ? 'Home' : label}
            </NavLink>
          ),
        )}
      </div>
    </nav>
  );
}

function useAlertToasts() {
  const { state } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!seen.current) {
      seen.current = new Set(state.alerts.map((a) => a.id));
      return;
    }
    const known = seen.current;
    const fresh = state.alerts.filter((a) => !known.has(a.id));
    if (!fresh.length) return;
    fresh.forEach((a) => known.add(a.id));
    if (!state.settings.alerts.toasts || fresh.length > 8) return;
    fresh
      .filter((a) => a.severity !== 'info')
      .slice(0, 3)
      .forEach((a) => {
        const p = state.patients.find((x) => x.id === a.patientId);
        toast({
          kind: a.severity === 'critical' ? 'error' : 'warning',
          title: a.title,
          description: `${a.patientId} · ${p?.name ?? ''} — ${a.detail}`,
          duration: 8000,
          action: { label: 'Open patient', onClick: () => navigate(`/patients/${a.patientId}?tab=vitals`) },
        });
      });
  }, [state.alerts, state.patients, state.settings.alerts.toasts, toast, navigate]);
}

export default function Layout() {
  const { state } = useApp();
  const stats = useStats();
  const { pathname } = useLocation();
  useAlertToasts();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  if (!state.authenticated) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-dvh bg-[#f4f7fb]">
      <Header />
      <div className="flex">
        <Sidebar alertCount={stats.activeAlerts} />
        <main className="min-w-0 flex-1 px-3 pb-28 pt-4 sm:px-5 sm:pt-6 md:pb-10 lg:px-8">
          <div className="mx-auto max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>
      <BottomNav alertCount={stats.activeAlerts} />
    </div>
  );
}
