import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '../utils/cn';

type ToastKind = 'success' | 'error' | 'warning' | 'info';

export interface ToastInput {
  kind?: ToastKind;
  title: string;
  description?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends ToastInput {
  id: number;
  kind: ToastKind;
}

const ToastContext = createContext<(t: ToastInput) => void>(() => {});

const STYLES: Record<ToastKind, { ring: string; iconWrap: string; icon: ReactNode; bar: string }> = {
  success: {
    ring: 'border-emerald-200',
    iconWrap: 'bg-emerald-100 text-emerald-600',
    icon: <CircleCheck className="h-5 w-5" />,
    bar: 'bg-emerald-500',
  },
  error: {
    ring: 'border-red-200',
    iconWrap: 'bg-red-100 text-red-600',
    icon: <TriangleAlert className="h-5 w-5" />,
    bar: 'bg-red-500',
  },
  warning: {
    ring: 'border-orange-200',
    iconWrap: 'bg-orange-100 text-orange-600',
    icon: <CircleAlert className="h-5 w-5" />,
    bar: 'bg-orange-500',
  },
  info: {
    ring: 'border-blue-200',
    iconWrap: 'bg-blue-100 text-blue-600',
    icon: <Info className="h-5 w-5" />,
    bar: 'bg-blue-500',
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setItems((s) => s.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (t: ToastInput) => {
      seq.current += 1;
      const id = seq.current;
      const item: ToastItem = { ...t, id, kind: t.kind ?? 'info' };
      setItems((s) => [...s.slice(-3), item]);
      window.setTimeout(() => dismiss(id), t.duration ?? 5500);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[80] flex flex-col gap-2 md:inset-x-auto md:bottom-6 md:right-6 md:w-[400px]"
      >
        {items.map((t) => {
          const s = STYLES[t.kind];
          return (
            <div
              key={t.id}
              role="status"
              className={cn('pointer-events-auto relative flex animate-slide-up items-start gap-3 overflow-hidden rounded-xl border bg-white p-3.5 pr-10 shadow-lg shadow-slate-900/10', s.ring)}
            >
              <span className={cn('absolute inset-y-0 left-0 w-1', s.bar)} />
              <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full', s.iconWrap)}>{s.icon}</span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm font-semibold text-slate-900">{t.title}</p>
                {t.description && <p className="mt-0.5 text-[13px] leading-snug text-slate-600">{t.description}</p>}
                {t.action && (
                  <button
                    onClick={() => {
                      t.action?.onClick();
                      dismiss(t.id);
                    }}
                    className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    {t.action.label} →
                  </button>
                )}
              </div>
              <button onClick={() => dismiss(t.id)} className="absolute right-2 top-2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Dismiss">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
