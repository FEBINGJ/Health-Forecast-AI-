import { useMemo } from 'react';
import { Check, CircleCheck } from 'lucide-react';
import type { VitalReading } from '../../types';
import { useApp } from '../../store/AppStore';
import { SEVERITY_STYLES, SeverityIcon } from '../../components/ui';
import { HOUR, fmtDateTime, timeAgo } from '../../lib/format';
import { cn } from '../../utils/cn';

export function scoreTone(score: number): string {
  if (score >= 3) return 'text-red-600 font-semibold';
  if (score === 2) return 'text-orange-600 font-semibold';
  if (score === 1) return 'text-amber-600 font-medium';
  return 'text-slate-700';
}

export function ScorePill({ score, className }: { score: number; className?: string }) {
  return (
    <span
      className={cn(
        'inline-grid h-6 min-w-6 place-items-center rounded-md px-1.5 text-xs font-bold tabular-nums',
        score >= 7 ? 'bg-red-100 text-red-700' : score >= 5 ? 'bg-orange-100 text-orange-700' : score >= 1 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500',
        className,
      )}
    >
      {score}
    </span>
  );
}

export function SubScore({ score }: { score: number }) {
  return (
    <span
      className={cn(
        'inline-grid h-6 min-w-6 place-items-center rounded-md px-1.5 text-xs font-bold',
        score >= 3 ? 'bg-red-100 text-red-700' : score === 2 ? 'bg-orange-100 text-orange-700' : score === 1 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500',
      )}
    >
      {score}
    </span>
  );
}

/** Earliest reading within the 12 hours preceding the latest observation. */
export function baseline12h(vitals: VitalReading[]): VitalReading | null {
  if (vitals.length < 2) return null;
  const latest = vitals[vitals.length - 1];
  const b = vitals.find((v) => v.t >= latest.t - 12 * HOUR - 60_000);
  return b && b !== latest && latest.t - b.t >= HOUR ? b : null;
}

export function PatientAlerts({ patientId, limit = 6 }: { patientId: string; limit?: number }) {
  const { state, dispatch } = useApp();
  const items = useMemo(
    () =>
      state.alerts
        .filter((a) => a.patientId === patientId)
        .sort((a, b) => Number(a.acknowledged) - Number(b.acknowledged) || b.t - a.t)
        .slice(0, limit),
    [state.alerts, patientId, limit],
  );
  const activeCount = state.alerts.filter((a) => a.patientId === patientId && !a.acknowledged).length;

  if (!items.length)
    return (
      <div className="m-4 flex items-center gap-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 sm:m-5">
        <CircleCheck className="h-5 w-5 shrink-0" /> No alerts have been raised for this patient.
      </div>
    );

  return (
    <div className="p-4 sm:p-5">
      {activeCount > 1 && (
        <div className="mb-3 flex justify-end">
          <button
            onClick={() => dispatch({ type: 'ACK_ALL', at: Date.now(), patientId })}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            <Check className="h-3.5 w-3.5" /> Acknowledge all ({activeCount})
          </button>
        </div>
      )}
      <ul className="space-y-2">
        {items.map((a) => (
          <li
            key={a.id}
            className={cn(
              'flex items-start gap-3 rounded-lg border-l-4 p-3 transition',
              a.acknowledged ? 'border-l-slate-200 bg-slate-50 opacity-75' : cn(SEVERITY_STYLES[a.severity].bg, SEVERITY_STYLES[a.severity].border),
            )}
          >
            <SeverityIcon severity={a.severity} className={cn('mt-0.5 shrink-0', a.acknowledged && 'text-slate-400')} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{a.title}</p>
              <p className="text-xs text-slate-600">{a.detail}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {fmtDateTime(a.t)} · {timeAgo(a.t)}
                {a.acknowledged && a.ackBy ? ` · Ack. by ${a.ackBy}` : ''}
              </p>
            </div>
            {!a.acknowledged && (
              <button
                onClick={() => dispatch({ type: 'ACK_ALERT', id: a.id, at: Date.now() })}
                className="shrink-0 rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
              >
                Acknowledge
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
