import {
  useEffect,
  useId,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '../utils/cn';
import type { AlertSeverity, RiskLevel, Thresholds } from '../types';
import avatarUrl from '../assets/doctor-avatar.jpg';

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

export const RISK_STYLES: Record<RiskLevel, { badge: string; text: string; bar: string; hex: string; soft: string }> = {
  High: { badge: 'bg-red-50 text-red-700 ring-red-200', text: 'text-red-600', bar: 'bg-red-500', hex: '#dc2626', soft: 'bg-red-50' },
  Moderate: {
    badge: 'bg-orange-50 text-orange-700 ring-orange-200',
    text: 'text-orange-600',
    bar: 'bg-orange-500',
    hex: '#ea580c',
    soft: 'bg-orange-50',
  },
  Low: {
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    text: 'text-emerald-600',
    bar: 'bg-emerald-500',
    hex: '#16a34a',
    soft: 'bg-emerald-50',
  },
};

export const SEVERITY_STYLES: Record<AlertSeverity, { icon: string; bg: string; ring: string; label: string; chip: string; border: string }> = {
  critical: { icon: 'text-red-600', bg: 'bg-red-50', ring: 'ring-red-200', label: 'Critical', chip: 'bg-red-100 text-red-700', border: 'border-l-red-500' },
  warning: { icon: 'text-orange-600', bg: 'bg-orange-50', ring: 'ring-orange-200', label: 'Warning', chip: 'bg-orange-100 text-orange-700', border: 'border-l-orange-500' },
  info: { icon: 'text-blue-600', bg: 'bg-blue-50', ring: 'ring-blue-200', label: 'Info', chip: 'bg-blue-100 text-blue-700', border: 'border-l-blue-500' },
};

/* ------------------------------------------------------------------ */
/* Basics                                                              */
/* ------------------------------------------------------------------ */

export function Spinner({ className }: { className?: string }) {
  return <span className={cn('inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent', className)} />;
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'soft';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-blue-600 text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700 active:bg-blue-800',
  secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 active:bg-slate-100',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
  success: 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/25 hover:bg-emerald-700',
  soft: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-[15px] gap-2 rounded-xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
}

export function Button({ variant = 'primary', size = 'md', icon, loading, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-55',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]', className)} {...rest} />;
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5', className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600">{icon}</span>}
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, className }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-navy-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function RiskBadge({
  level,
  percent,
  size = 'md',
  className,
  title,
}: {
  level: RiskLevel;
  percent?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  title?: string;
}) {
  const sz = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs';
  return (
    <span title={title} className={cn('inline-flex items-center gap-1 rounded-md font-semibold ring-1 ring-inset', sz, RISK_STYLES[level].badge, className)}>
      {level}
      {percent != null && <span className="font-medium opacity-75">{percent}%</span>}
    </span>
  );
}

export function SeverityIcon({ severity, className }: { severity: AlertSeverity; className?: string }) {
  const cls = cn('h-4 w-4', SEVERITY_STYLES[severity].icon, className);
  if (severity === 'critical') return <TriangleAlert className={cls} />;
  if (severity === 'warning') return <CircleAlert className={cls} />;
  return <Info className={cls} />;
}

/* ------------------------------------------------------------------ */
/* Forms                                                               */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

const inputBase =
  'block w-full rounded-lg border bg-white text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-4 disabled:bg-slate-50 disabled:text-slate-500';
const okRing = 'border-slate-300 focus:border-blue-500 focus:ring-blue-500/15';
const badRing = 'border-red-400 focus:border-red-500 focus:ring-red-500/15';

export function Input({
  invalid,
  leftIcon,
  rightSlot,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; leftIcon?: ReactNode; rightSlot?: ReactNode }) {
  return (
    <div className="relative">
      {leftIcon && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">{leftIcon}</span>}
      <input
        className={cn(inputBase, 'h-10 px-3', leftIcon && 'pl-10', rightSlot && 'pr-11', invalid ? badRing : okRing, className)}
        aria-invalid={invalid || undefined}
        {...rest}
      />
      {rightSlot && <span className="absolute inset-y-0 right-1.5 flex items-center">{rightSlot}</span>}
    </div>
  );
}

export function Select({ invalid, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <select className={cn(inputBase, 'h-10 appearance-none pl-3 pr-9', invalid ? badRing : okRing, className)} aria-invalid={invalid || undefined} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

export function Textarea({ invalid, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea className={cn(inputBase, 'min-h-[96px] px-3 py-2.5', invalid ? badRing : okRing, className)} {...rest} />;
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-slate-800">
          {label}
        </label>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:opacity-50',
          checked ? 'bg-blue-600' : 'bg-slate-300',
        )}
      >
        <span className={cn('absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-5')} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Navigation widgets                                                  */
/* ------------------------------------------------------------------ */

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: ReactNode;
  badge?: number;
}

export function Tabs<T extends string>({ items, value, onChange, className }: { items: TabItem<T>[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cn('no-scrollbar -mx-3 overflow-x-auto border-b border-slate-200 sm:mx-0', className)}>
      <div role="tablist" className="flex min-w-max gap-0.5 px-3 sm:px-0">
        {items.map((t) => {
          const active = t.id === value;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(t.id)}
              className={cn(
                'relative flex items-center gap-2 px-3 py-3 text-sm font-medium transition-colors sm:px-4',
                active ? 'text-blue-700' : 'text-slate-500 hover:text-slate-800',
              )}
            >
              {t.icon}
              {t.label}
              {t.badge ? <span className="rounded-full bg-red-500 px-1.5 py-px text-[10px] font-bold text-white">{t.badge}</span> : null}
              <span className={cn('absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-colors', active ? 'bg-blue-600' : 'bg-transparent')} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  items,
  value,
  onChange,
  className,
  stretch,
}: {
  items: { id: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  stretch?: boolean;
}) {
  return (
    <div className={cn('inline-flex rounded-lg bg-slate-100 p-1', stretch && 'flex w-full', className)}>
      {items.map((i) => (
        <button
          key={i.id}
          type="button"
          onClick={() => onChange(i.id)}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-semibold transition sm:text-[13px]',
            stretch && 'flex-1',
            value === i.id ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:text-slate-900',
          )}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex w-full items-start">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className={cn('flex items-start', i < steps.length - 1 && 'flex-1')}>
            <div className="flex w-16 shrink-0 flex-col items-center gap-1.5 sm:w-24">
              <span
                className={cn(
                  'grid h-8 w-8 place-items-center rounded-full text-sm font-semibold transition-all',
                  done && 'bg-blue-600 text-white',
                  active && 'bg-blue-600 text-white ring-4 ring-blue-100',
                  !done && !active && 'border border-slate-300 bg-white text-slate-400',
                )}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
              </span>
              <span className={cn('text-center text-[11px] font-medium sm:text-xs', active || done ? 'text-slate-900' : 'text-slate-400')}>{s}</span>
            </div>
            {i < steps.length - 1 && <div className={cn('mt-4 h-0.5 flex-1 rounded-full transition-colors', done ? 'bg-blue-600' : 'bg-slate-200')} />}
          </li>
        );
      })}
    </ol>
  );
}

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPage,
  className,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
  className?: string;
}) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const start = Math.max(1, Math.min(page - 2, pageCount - 4));
  const pages = Array.from({ length: Math.min(5, pageCount) }, (_, i) => start + i);
  const btn = 'grid h-8 min-w-8 place-items-center rounded-lg px-2 text-xs font-semibold transition';
  return (
    <div className={cn('flex flex-col items-center justify-between gap-3 sm:flex-row', className)}>
      <p className="text-xs text-slate-500">
        Showing <span className="font-semibold text-slate-700">{from}–{to}</span> of <span className="font-semibold text-slate-700">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button className={cn(btn, 'text-slate-600 hover:bg-slate-100 disabled:opacity-40')} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={cn(btn, p === page ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100')}
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </button>
        ))}
        <button className={cn(btn, 'text-slate-600 hover:bg-slate-100 disabled:opacity-40')} disabled={page >= pageCount} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overlays                                                            */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const w = size === 'sm' ? 'sm:max-w-md' : size === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-xl';
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn('relative flex max-h-[92dvh] w-full animate-sheet-up flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:animate-pop-in sm:rounded-2xl', w)}
      >
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
          {icon}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          <button onClick={onClose} className="-mr-1 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Data viz                                                            */
/* ------------------------------------------------------------------ */

export function RiskBar({ percent, level, thresholds, className }: { percent: number; level: RiskLevel; thresholds?: Thresholds; className?: string }) {
  return (
    <div className={cn('relative h-2 w-full rounded-full bg-slate-100', className)}>
      <div className={cn('h-full rounded-full transition-all duration-500', RISK_STYLES[level].bar)} style={{ width: `${Math.max(2, percent)}%` }} />
      {thresholds &&
        [thresholds.moderate, thresholds.high].map((t) => (
          <span key={t} className="absolute top-1/2 h-3.5 w-px -translate-y-1/2 bg-slate-400/70" style={{ left: `${t}%` }} />
        ))}
    </div>
  );
}

export function Gauge({ percent, level, thresholds, label }: { percent: number; level: RiskLevel; thresholds?: Thresholds; label?: string }) {
  const r = 80;
  const cx = 100;
  const cy = 100;
  const sw = 16;
  const len = Math.PI * r;
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const tick = (p: number) => {
    const a = Math.PI * (1 - p / 100);
    const r1 = r - sw / 2 - 3;
    const r2 = r + sw / 2 + 3;
    return (
      <line
        key={p}
        x1={cx + r1 * Math.cos(a)}
        y1={cy - r1 * Math.sin(a)}
        x2={cx + r2 * Math.cos(a)}
        y2={cy - r2 * Math.sin(a)}
        stroke="#94a3b8"
        strokeWidth={1.5}
      />
    );
  };
  return (
    <svg viewBox="0 0 200 118" className="w-full max-w-[240px]" role="img" aria-label={`${percent}% ${level} risk`}>
      <path d={arc} fill="none" stroke="#eef2f7" strokeWidth={sw} strokeLinecap="round" />
      <path
        d={arc}
        fill="none"
        stroke={RISK_STYLES[level].hex}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={`${(len * Math.max(percent, 0.5)) / 100} ${len}`}
        style={{ transition: 'stroke-dasharray .6s ease' }}
      />
      {thresholds && [thresholds.moderate, thresholds.high].map(tick)}
      <text x={cx} y={cy - 12} textAnchor="middle" fill="#0f172a" style={{ fontSize: 34, fontWeight: 700 }}>
        {percent}%
      </text>
      {label && (
        <text x={cx} y={cy + 13} textAnchor="middle" fill="#64748b" style={{ fontSize: 11, fontWeight: 500 }}>
          {label}
        </text>
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {icon && <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400">{icon}</div>}
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Logo({ className }: { className?: string }) {
  const id = `lg${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="2" y1="3" x2="22" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <path
        d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
        stroke={`url(#${id})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" stroke={`url(#${id})`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DoctorAvatar({ className }: { className?: string }) {
  return <img src={avatarUrl} alt="Doctor profile" className={cn('rounded-full object-cover ring-2 ring-white', className)} />;
}

const AVATAR_COLORS = ['bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700', 'bg-violet-100 text-violet-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700', 'bg-cyan-100 text-cyan-700'];

export function InitialsAvatar({ name, className }: { name: string; className?: string }) {
  const parts = name.replace(/^(Dr\.|Nurse)\s+/i, '').trim().split(/\s+/);
  const ini = ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  const h = [...name].reduce((s, c) => s + c.charCodeAt(0), 0);
  return (
    <span className={cn('grid shrink-0 place-items-center rounded-full text-xs font-bold', AVATAR_COLORS[h % AVATAR_COLORS.length], className)}>{ini}</span>
  );
}
