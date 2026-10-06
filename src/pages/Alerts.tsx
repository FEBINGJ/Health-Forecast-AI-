import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing, Check, CheckCheck, CircleAlert, Info, Search, TriangleAlert, X } from 'lucide-react';
import type { AlertSeverity } from '../types';
import { useApp } from '../store/AppStore';
import { Button, Card, EmptyState, Input, PageHeader, SEVERITY_STYLES, Segmented, Select, SeverityIcon } from '../components/ui';
import { DAY, fmtDateTime, fmtTime, timeAgo } from '../lib/format';
import { cn } from '../utils/cn';

type Status = 'active' | 'acknowledged' | 'all';
const SEV_RANK: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };

export default function Alerts() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('active');
  const [severity, setSeverity] = useState<'all' | AlertSeverity>('all');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(20);

  const patients = useMemo(() => new Map(state.patients.map((p) => [p.id, p])), [state.patients]);

  const counts = useMemo(() => {
    const active = state.alerts.filter((a) => !a.acknowledged);
    const now = Date.now();
    return {
      active: active.length,
      critical: active.filter((a) => a.severity === 'critical').length,
      warning: active.filter((a) => a.severity === 'warning').length,
      info: active.filter((a) => a.severity === 'info').length,
      ackToday: state.alerts.filter((a) => a.acknowledged && a.ackAt && now - a.ackAt < DAY).length,
    };
  }, [state.alerts]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return state.alerts
      .filter((a) => (status === 'all' ? true : status === 'active' ? !a.acknowledged : a.acknowledged))
      .filter((a) => severity === 'all' || a.severity === severity)
      .filter((a) => {
        if (!s) return true;
        const p = patients.get(a.patientId);
        return a.title.toLowerCase().includes(s) || a.patientId.toLowerCase().includes(s) || (p?.name.toLowerCase().includes(s) ?? false) || (p?.ward.toLowerCase().includes(s) ?? false);
      })
      .sort((a, b) => Number(a.acknowledged) - Number(b.acknowledged) || b.t - a.t || SEV_RANK[a.severity] - SEV_RANK[b.severity]);
  }, [state.alerts, status, severity, q, patients]);

  const activeShown = list.filter((a) => !a.acknowledged);

  const summary = [
    { label: 'Critical', value: counts.critical, icon: TriangleAlert, tone: 'text-red-600', bg: 'bg-red-50', onClick: () => { setStatus('active'); setSeverity('critical'); } },
    { label: 'Warnings', value: counts.warning, icon: CircleAlert, tone: 'text-orange-600', bg: 'bg-orange-50', onClick: () => { setStatus('active'); setSeverity('warning'); } },
    { label: 'Information', value: counts.info, icon: Info, tone: 'text-blue-600', bg: 'bg-blue-50', onClick: () => { setStatus('active'); setSeverity('info'); } },
    { label: 'Acknowledged (24 h)', value: counts.ackToday, icon: CheckCheck, tone: 'text-emerald-600', bg: 'bg-emerald-50', onClick: () => { setStatus('acknowledged'); setSeverity('all'); } },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Alerts"
        subtitle="Clinical alerts raised by vital-sign rules and the AI risk model"
        actions={
          activeShown.length > 0 ? (
            <Button variant="secondary" icon={<CheckCheck className="h-4 w-4" />} onClick={() => dispatch({ type: 'ACK_ALL', at: Date.now(), ids: activeShown.map((a) => a.id) })}>
              Acknowledge {activeShown.length} shown
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {summary.map((s) => (
          <button
            key={s.label}
            onClick={s.onClick}
            className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full', s.bg, s.tone)}>
              <s.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className={cn('block text-2xl font-bold leading-tight', s.tone)}>{s.value}</span>
              <span className="block truncate text-xs font-medium text-slate-500">{s.label}</span>
            </span>
          </button>
        ))}
      </div>

      <Card className="mt-5 sm:mt-6">
        <div className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <Segmented
            items={[
              { id: 'active', label: `Active (${counts.active})` },
              { id: 'acknowledged', label: 'Acknowledged' },
              { id: 'all', label: 'All' },
            ]}
            value={status}
            onChange={(v) => {
              setStatus(v);
              setLimit(20);
            }}
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="sm:w-72">
              <Input
                placeholder="Search patient, ward or alert…"
                aria-label="Search alerts"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                leftIcon={<Search className="h-4 w-4" />}
                rightSlot={
                  q ? (
                    <button onClick={() => setQ('')} className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100" aria-label="Clear search">
                      <X className="h-4 w-4" />
                    </button>
                  ) : undefined
                }
              />
            </div>
            <div className="sm:w-44">
              <Select value={severity} onChange={(e) => setSeverity(e.target.value as 'all' | AlertSeverity)} aria-label="Filter by severity">
                <option value="all">All severities</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </Select>
            </div>
          </div>
        </div>

        {list.length ? (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {list.slice(0, limit).map((a) => {
              const p = patients.get(a.patientId);
              const sev = SEVERITY_STYLES[a.severity];
              return (
                <li key={a.id} className={cn('flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5', a.acknowledged && 'bg-slate-50/60')}>
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full', a.acknowledged ? 'bg-slate-100' : sev.bg)}>
                      <SeverityIcon severity={a.severity} className={cn('h-5 w-5', a.acknowledged && 'text-slate-400')} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={cn('text-sm font-semibold', a.acknowledged ? 'text-slate-600' : 'text-slate-900')}>{a.title}</p>
                        <span className={cn('rounded px-1.5 py-px text-[10px] font-bold uppercase', sev.chip)}>{sev.label}</span>
                        {a.acknowledged && <span className="rounded bg-slate-200 px-1.5 py-px text-[10px] font-bold uppercase text-slate-600">Acknowledged</span>}
                      </div>
                      <p className="mt-0.5 text-sm text-slate-600">{a.detail}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        <button
                          onClick={() => navigate(`/patients/${a.patientId}?tab=vitals`, { state: { from: '/alerts' } })}
                          className="font-semibold text-blue-600 hover:underline"
                        >
                          {a.patientId} · {p?.name ?? 'Unknown patient'}
                        </button>
                        {p && ` · ${p.ward}`} · {fmtDateTime(a.t)} ({timeAgo(a.t)})
                        {a.acknowledged && a.ackBy && ` · Acknowledged by ${a.ackBy}${a.ackAt ? ` at ${fmtTime(a.ackAt)}` : ''}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2 pl-[52px] sm:pl-0">
                    <Button size="sm" variant="secondary" onClick={() => navigate(`/patients/${a.patientId}?tab=vitals`, { state: { from: '/alerts' } })}>
                      View patient
                    </Button>
                    {!a.acknowledged && (
                      <Button size="sm" icon={<Check className="h-3.5 w-3.5" />} onClick={() => dispatch({ type: 'ACK_ALERT', id: a.id, at: Date.now() })}>
                        Acknowledge
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            className="border-t border-slate-100"
            icon={<BellRing className="h-5 w-5" />}
            title={status === 'active' ? 'No active alerts' : 'No alerts found'}
            description={status === 'active' ? 'Everything has been acknowledged. New alerts appear here automatically.' : 'Try changing the filters.'}
          />
        )}
        {list.length > limit && (
          <div className="border-t border-slate-100 p-3 text-center">
            <Button variant="ghost" onClick={() => setLimit((l) => l + 20)}>
              Load more ({list.length - limit} remaining)
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
