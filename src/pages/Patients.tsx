import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Plus, Search, Users, X } from 'lucide-react';
import { useApp, useStats } from '../store/AppStore';
import { Button, Card, EmptyState, Input, PageHeader, Pagination, Select } from '../components/ui';
import { PatientTable, buildRows, filterRows, sortRows, type RiskFilter, type SortKey, type SortState } from '../components/PatientTable';
import { downloadCsv, fmtDate } from '../lib/format';
import { cn } from '../utils/cn';

const SORT_OPTIONS: { value: string; label: string; sort: SortState }[] = [
  { value: 'id', label: 'Patient ID', sort: { key: 'id', dir: 'asc' } },
  { value: 'det', label: 'Highest deterioration risk', sort: { key: 'det', dir: 'desc' } },
  { value: 'readm', label: 'Highest readmission risk', sort: { key: 'readm', dir: 'desc' } },
  { value: 'news2', label: 'Highest NEWS2', sort: { key: 'news2', dir: 'desc' } },
  { value: 'name', label: 'Name (A–Z)', sort: { key: 'name', dir: 'asc' } },
  { value: 'ward', label: 'Ward', sort: { key: 'ward', dir: 'asc' } },
  { value: 'default', label: 'Recently added', sort: { key: 'default', dir: 'asc' } },
];

export default function Patients() {
  const { state, predictions } = useApp();
  const stats = useStats();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const risk = (params.get('risk') as RiskFilter | null) ?? 'all';
  const ward = params.get('ward') ?? 'all';
  const q = params.get('q') ?? '';
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ key: 'id', dir: 'asc' });

  const setParam = (k: string, v: string) => {
    const n = new URLSearchParams(params);
    if (!v || v === 'all') n.delete(k);
    else n.set(k, v);
    setParams(n, { replace: true });
    setPage(1);
  };

  const wards = useMemo(
    () => Array.from(new Set(state.patients.map((p) => p.ward))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [state.patients],
  );
  const rows = useMemo(() => buildRows(state.patients, predictions, state.alerts, state.seededAt), [state.patients, predictions, state.alerts, state.seededAt]);
  const filtered = useMemo(() => sortRows(filterRows(rows, q, ward, risk), sort), [rows, q, ward, risk, sort]);
  const pageSize = state.settings.pageSize;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, pageCount);
  const pageRows = filtered.slice((cur - 1) * pageSize, cur * pageSize);

  const chips: { id: RiskFilter; label: string; count: number; dot?: string }[] = [
    { id: 'all', label: 'All patients', count: rows.length },
    { id: 'any', label: 'Any high risk', count: stats.highAny, dot: 'bg-red-500' },
    { id: 'det', label: 'High deterioration', count: stats.detHigh, dot: 'bg-orange-500' },
    { id: 'readm', label: 'High readmission', count: stats.readmHigh, dot: 'bg-indigo-500' },
    { id: 'moderate', label: 'Moderate', count: rows.filter((r) => filterRows([r], '', 'all', 'moderate').length).length, dot: 'bg-amber-400' },
    { id: 'low', label: 'Low risk', count: rows.filter((r) => r.prediction?.deterioration.level === 'Low' && r.prediction?.readmission.level === 'Low').length, dot: 'bg-emerald-500' },
    { id: 'alerts', label: 'Active alerts', count: rows.filter((r) => r.activeAlerts > 0).length, dot: 'bg-rose-500' },
  ];

  const onSort = (k: SortKey) =>
    setSort((s) => (s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: k === 'det' || k === 'readm' || k === 'news2' ? 'desc' : 'asc' }));

  const exportCsv = () => {
    downloadCsv(`patients-${fmtDate(Date.now())}.csv`, [
      ['Patient ID', 'Name', 'Age', 'Gender', 'Ward', 'Bed', 'Diagnosis', 'Admission date', 'NEWS2', 'Deterioration risk (%)', 'Deterioration level', 'Readmission risk (%)', 'Readmission level', 'Active alerts'],
      ...filtered.map((r) => [
        r.patient.id,
        r.patient.name,
        r.age,
        r.patient.gender,
        r.patient.ward,
        r.patient.bed,
        r.patient.diagnosis,
        fmtDate(r.patient.admittedAt),
        r.prediction?.news2.total ?? '',
        r.prediction?.deterioration.percent ?? '',
        r.prediction?.deterioration.level ?? '',
        r.prediction?.readmission.percent ?? '',
        r.prediction?.readmission.level ?? '',
        r.activeAlerts,
      ]),
    ]);
  };

  const hasFilters = q || ward !== 'all' || risk !== 'all';
  const currentSortValue = SORT_OPTIONS.find((o) => o.sort.key === sort.key && o.sort.dir === sort.dir)?.value ?? '';

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Patients"
        subtitle={`${rows.length} patients currently monitored by the AI risk engine`}
        actions={
          <>
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportCsv}>
              Export CSV
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/add-patient')}>
              Add New Patient
            </Button>
          </>
        }
      />

      <div className="no-scrollbar -mx-3 mb-4 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:px-0">
        {chips.map((c) => (
          <button
            key={c.id}
            onClick={() => setParam('risk', c.id)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 ring-inset transition sm:text-[13px]',
              risk === c.id ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
            )}
          >
            {c.dot && <span className={cn('h-2 w-2 rounded-full', c.dot, risk === c.id && 'ring-2 ring-white/60')} />}
            {c.label}
            <span className={cn('rounded-full px-1.5 text-[11px]', risk === c.id ? 'bg-white/20' : 'bg-slate-100 text-slate-500')}>{c.count}</span>
          </button>
        ))}
      </div>

      <Card>
        <div className="grid gap-3 p-4 sm:grid-cols-[1fr_180px] sm:p-5 md:grid-cols-[1fr_180px] lg:grid-cols-[1fr_200px_220px]">
          <Input
            placeholder="Search by name, ID, ward or diagnosis…"
            aria-label="Search patients"
            value={q}
            onChange={(e) => setParam('q', e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
            rightSlot={
              q ? (
                <button onClick={() => setParam('q', '')} className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Clear search">
                  <X className="h-4 w-4" />
                </button>
              ) : undefined
            }
          />
          <Select value={ward} onChange={(e) => setParam('ward', e.target.value)} aria-label="Filter by ward">
            <option value="all">All wards</option>
            {wards.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </Select>
          <div className="sm:col-span-2 lg:col-span-1">
            <Select
              value={currentSortValue}
              onChange={(e) => {
                const o = SORT_OPTIONS.find((x) => x.value === e.target.value);
                if (o) setSort(o.sort);
              }}
              aria-label="Sort patients"
            >
              {!currentSortValue && <option value="">Custom sort</option>}
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  Sort: {o.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {pageRows.length ? (
          <>
            <div className="px-3 pb-3 md:px-0 md:pb-0">
              <PatientTable rows={pageRows} variant="full" sort={sort} onSort={onSort} onView={(id) => navigate(`/patients/${id}`, { state: { from: `/patients?${params.toString()}` } })} />
            </div>
            <div className="border-t border-slate-100 px-4 py-3 sm:px-5">
              <Pagination page={cur} pageCount={pageCount} total={filtered.length} pageSize={pageSize} onPage={setPage} />
            </div>
          </>
        ) : (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="No patients match these filters"
            description="Try a different search term, ward or risk filter."
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                  Clear all filters
                </Button>
              ) : undefined
            }
          />
        )}
      </Card>
    </div>
  );
}
