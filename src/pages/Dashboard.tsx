import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Activity, BedDouble, BellRing, ChartNoAxesColumn, Plus, Search, TriangleAlert, Users, X } from 'lucide-react';
import { useApp, useStats, type Stats } from '../store/AppStore';
import { Button, Card, CardHeader, EmptyState, Input, PageHeader, Pagination, RISK_STYLES, SEVERITY_STYLES, SeverityIcon } from '../components/ui';
import { PatientTable, buildRows, filterRows, sortRows, type SortKey, type SortState } from '../components/PatientTable';
import { timeAgo } from '../lib/format';
import { cn } from '../utils/cn';

const LEVELS = ['High', 'Moderate', 'Low'] as const;

function RiskDistributionCard({ stats }: { stats: Stats }) {
  const { state, predictions } = useApp();
  const wards = useMemo(() => {
    const m = new Map<string, { total: number; high: number }>();
    for (const p of state.patients) {
      const w = m.get(p.ward) ?? { total: 0, high: 0 };
      w.total++;
      const pr = predictions.get(p.id);
      if (pr && (pr.deterioration.level === 'High' || pr.readmission.level === 'High')) w.high++;
      m.set(p.ward, w);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  }, [state.patients, predictions]);

  const rows = [
    { label: 'Deterioration (24 h)', counts: stats.detCounts },
    { label: 'ICU Readmission (30 d)', counts: stats.readmCounts },
  ];

  return (
    <Card>
      <CardHeader title="Risk Distribution" subtitle="AI-predicted risk levels across monitored patients" icon={<ChartNoAxesColumn className="h-4 w-4" />} />
      <div className="space-y-5 p-4 sm:p-5">
        {rows.map((r) => {
          const total = r.counts.Low + r.counts.Moderate + r.counts.High || 1;
          return (
            <div key={r.label}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{r.label}</span>
                <span className="text-xs text-slate-500">{total} patients</span>
              </div>
              <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-slate-100">
                {LEVELS.map((l) =>
                  r.counts[l] ? <div key={l} className={RISK_STYLES[l].bar} style={{ width: `${(r.counts[l] / total) * 100}%` }} title={`${l}: ${r.counts[l]}`} /> : null,
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                {LEVELS.map((l) => (
                  <span key={l} className="inline-flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 rounded-full', RISK_STYLES[l].bar)} />
                    {l} <span className="font-semibold text-slate-900">{r.counts[l]}</span>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Ward overview</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {wards.map(([w, v]) => (
              <Link key={w} to={`/patients?ward=${encodeURIComponent(w)}`} className="rounded-lg border border-slate-200 bg-slate-50/60 px-2 py-2 text-center transition hover:border-blue-200 hover:bg-blue-50/50">
                <p className="text-[11px] font-medium text-slate-500">{w}</p>
                <p className="text-base font-bold text-slate-900">{v.total}</p>
                <p className={cn('text-[10px] font-semibold', v.high ? 'text-red-600' : 'text-slate-400')}>{v.high} high</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function RecentAlertsCard() {
  const { state } = useApp();
  const navigate = useNavigate();
  const names = useMemo(() => new Map(state.patients.map((p) => [p.id, p.name])), [state.patients]);
  const items = useMemo(
    () =>
      state.alerts
        .filter((a) => !a.acknowledged && a.severity !== 'info')
        .sort((a, b) => b.t - a.t)
        .slice(0, 5),
    [state.alerts],
  );
  return (
    <Card>
      <CardHeader
        title="Recent Alerts"
        subtitle="Unacknowledged critical and warning alerts"
        icon={<BellRing className="h-4 w-4" />}
        action={
          <Link to="/alerts" className="text-xs font-semibold text-blue-600 hover:text-blue-800">
            View all
          </Link>
        }
      />
      <div className="p-4 sm:p-5">
        {items.length ? (
          <ul className="space-y-2">
            {items.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => navigate(`/patients/${a.patientId}?tab=vitals`, { state: { from: '/' } })}
                  className={cn('flex w-full items-start gap-3 rounded-lg border-l-4 p-3 text-left transition hover:brightness-[0.97]', SEVERITY_STYLES[a.severity].bg, SEVERITY_STYLES[a.severity].border)}
                >
                  <SeverityIcon severity={a.severity} className="mt-0.5 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900">{a.title}</span>
                    <span className="block truncate text-xs text-slate-600">
                      {a.patientId} · {names.get(a.patientId)} — {a.detail}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-500">{timeAgo(a.t)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<BellRing className="h-5 w-5" />} title="No active alerts" description="All alerts have been acknowledged." />
        )}
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { state, predictions } = useApp();
  const stats = useStats();
  const navigate = useNavigate();
  const location = useLocation();
  const addedId = (location.state as { addedId?: string } | null)?.addedId;
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ key: 'default', dir: 'asc' });
  const pageSize = state.settings.pageSize;

  const rows = useMemo(() => buildRows(state.patients, predictions, state.alerts, state.seededAt), [state.patients, predictions, state.alerts, state.seededAt]);
  const visible = useMemo(() => sortRows(filterRows(rows, q), sort), [rows, q, sort]);
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const cur = Math.min(page, pageCount);
  const pageRows = visible.slice((cur - 1) * pageSize, cur * pageSize);
  const lastUpdate = useMemo(() => state.patients.reduce((m, p) => Math.max(m, p.vitals[p.vitals.length - 1]?.t ?? 0), 0), [state.patients]);

  const onSort = (k: SortKey) =>
    setSort((s) => (s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: k === 'det' || k === 'readm' || k === 'news2' ? 'desc' : 'asc' }));
  const view = (id: string) => navigate(`/patients/${id}`, { state: { from: '/' } });

  const statCards = [
    { label: 'Total Patients', value: stats.total, color: 'text-blue-600', icon: Users, iconBg: 'bg-blue-50 text-blue-600', to: '/patients', hint: 'Currently monitored' },
    { label: 'High Risk', value: stats.highAny, color: 'text-red-600', icon: TriangleAlert, iconBg: 'bg-red-50 text-red-600', to: '/patients?risk=any', hint: 'Any high-risk prediction' },
    { label: 'Deterioration Risk', value: stats.detHigh, color: 'text-orange-500', icon: Activity, iconBg: 'bg-orange-50 text-orange-500', to: '/patients?risk=det', hint: 'High risk · next 24 h' },
    { label: 'Readmission Risk', value: stats.readmHigh, color: 'text-indigo-600', icon: BedDouble, iconBg: 'bg-indigo-50 text-indigo-600', to: '/patients?risk=readm', hint: 'High ICU readmission risk' },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={`Welcome, ${state.profile.displayName}`}
        subtitle="Here is the current patient overview"
        actions={
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
            <span className="h-2 w-2 animate-pulse-ring rounded-full bg-emerald-500" />
            Live monitoring · last reading {timeAgo(lastUpdate)}
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {statCards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="group min-w-0 rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md sm:p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-xs font-medium text-slate-500 sm:text-sm">{c.label}</p>
              <span className={cn('hidden h-8 w-8 place-items-center rounded-lg sm:grid', c.iconBg)}>
                <c.icon className="h-4 w-4" />
              </span>
            </div>
            <p className={cn('mt-1 truncate text-3xl font-bold tracking-tight sm:text-[34px]', c.color)}>{c.value}</p>
            <p className="mt-0.5 truncate text-[11px] text-slate-400 sm:text-xs">{c.hint}</p>
          </Link>
        ))}
      </div>

      <Card className="mt-5 sm:mt-6">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="w-full sm:max-w-sm">
            <Input
              placeholder="Search patients..."
              aria-label="Search patients"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              leftIcon={<Search className="h-4 w-4" />}
              rightSlot={
                q ? (
                  <button onClick={() => setQ('')} className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Clear search">
                    <X className="h-4 w-4" />
                  </button>
                ) : undefined
              }
            />
          </div>
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/add-patient')}>
            Add New Patient
          </Button>
        </div>
        {pageRows.length ? (
          <>
            <div className="px-3 pb-3 md:px-0 md:pb-0">
              <PatientTable rows={pageRows} sort={sort} onSort={onSort} highlightId={addedId} onView={view} />
            </div>
            <div className="border-t border-slate-100 px-4 py-3 sm:px-5">
              <Pagination page={cur} pageCount={pageCount} total={visible.length} pageSize={pageSize} onPage={setPage} />
            </div>
          </>
        ) : (
          <EmptyState
            icon={<Search className="h-5 w-5" />}
            title="No patients found"
            description={`No patients match “${q}”.`}
            action={
              <Button variant="secondary" onClick={() => setQ('')}>
                Clear search
              </Button>
            }
          />
        )}
      </Card>

      <div className="mt-5 grid gap-4 sm:mt-6 lg:grid-cols-2">
        <RiskDistributionCard stats={stats} />
        <RecentAlertsCard />
      </div>
    </div>
  );
}
