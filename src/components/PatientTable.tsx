import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Bell, ChevronRight } from 'lucide-react';
import type { ClinicalAlert, Patient, Prediction, RiskLevel } from '../types';
import { ageAt } from '../lib/format';
import { RiskBadge } from './ui';
import { cn } from '../utils/cn';

export interface PatientRow {
  patient: Patient;
  prediction: Prediction | null;
  age: number;
  activeAlerts: number;
  isNew: boolean;
}

export type SortKey = 'default' | 'id' | 'name' | 'age' | 'ward' | 'det' | 'readm' | 'news2';
export interface SortState {
  key: SortKey;
  dir: 'asc' | 'desc';
}

export function buildRows(patients: Patient[], predictions: Map<string, Prediction | null>, alerts: ClinicalAlert[], seededAt: number): PatientRow[] {
  const counts = new Map<string, number>();
  for (const a of alerts) if (!a.acknowledged && a.severity !== 'info') counts.set(a.patientId, (counts.get(a.patientId) ?? 0) + 1);
  const now = Date.now();
  return patients.map((p) => ({
    patient: p,
    prediction: predictions.get(p.id) ?? null,
    age: ageAt(p.dob, now),
    activeAlerts: counts.get(p.id) ?? 0,
    isNew: p.createdAt > seededAt && now - p.createdAt < 24 * 3600_000,
  }));
}

export type RiskFilter = 'all' | 'any' | 'det' | 'readm' | 'moderate' | 'low' | 'alerts';

export function filterRows(rows: PatientRow[], q: string, ward = 'all', risk: RiskFilter = 'all'): PatientRow[] {
  const s = q.trim().toLowerCase();
  return rows.filter((r) => {
    const p = r.patient;
    if (s && !(p.name.toLowerCase().includes(s) || p.id.toLowerCase().includes(s) || p.diagnosis.toLowerCase().includes(s) || p.ward.toLowerCase().includes(s))) return false;
    if (ward !== 'all' && p.ward !== ward) return false;
    const d = r.prediction?.deterioration.level;
    const rl = r.prediction?.readmission.level;
    switch (risk) {
      case 'any':
        return d === 'High' || rl === 'High';
      case 'det':
        return d === 'High';
      case 'readm':
        return rl === 'High';
      case 'moderate':
        return d !== 'High' && rl !== 'High' && (d === 'Moderate' || rl === 'Moderate');
      case 'low':
        return d === 'Low' && rl === 'Low';
      case 'alerts':
        return r.activeAlerts > 0;
      default:
        return true;
    }
  });
}

const idNum = (id: string) => parseInt(id.replace(/\D/g, ''), 10) || 0;
const wardNum = (w: string) => parseInt(w.replace(/\D/g, ''), 10) || 0;

export function sortRows(rows: PatientRow[], sort: SortState): PatientRow[] {
  const dir = sort.dir === 'asc' ? 1 : -1;
  const out = [...rows];
  out.sort((a, b) => {
    let c = 0;
    switch (sort.key) {
      case 'default':
        c = b.patient.createdAt - a.patient.createdAt || idNum(a.patient.id) - idNum(b.patient.id);
        return c;
      case 'id':
        c = idNum(a.patient.id) - idNum(b.patient.id);
        break;
      case 'name':
        c = a.patient.name.localeCompare(b.patient.name);
        break;
      case 'age':
        c = a.age - b.age;
        break;
      case 'ward':
        c = wardNum(a.patient.ward) - wardNum(b.patient.ward);
        break;
      case 'det':
        c = (a.prediction?.deterioration.probability ?? 0) - (b.prediction?.deterioration.probability ?? 0);
        break;
      case 'readm':
        c = (a.prediction?.readmission.probability ?? 0) - (b.prediction?.readmission.probability ?? 0);
        break;
      case 'news2':
        c = (a.prediction?.news2.total ?? 0) - (b.prediction?.news2.total ?? 0);
        break;
    }
    return c * dir || idNum(a.patient.id) - idNum(b.patient.id);
  });
  return out;
}

function Th({
  children,
  k,
  sort,
  onSort,
  className,
}: {
  children: ReactNode;
  k?: SortKey;
  sort?: SortState;
  onSort?: (k: SortKey) => void;
  className?: string;
}) {
  const active = k && sort?.key === k;
  return (
    <th scope="col" className={cn('whitespace-nowrap px-4 py-3 font-semibold', className)} aria-sort={active ? (sort?.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
      {k && onSort ? (
        <button onClick={() => onSort(k)} className={cn('group inline-flex items-center gap-1.5 hover:text-slate-800', active && 'text-slate-800')}>
          {children}
          {active ? (
            sort?.dir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-60" />
          )}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

function News2Pill({ score }: { score: number }) {
  return (
    <span
      className={cn(
        'inline-grid h-6 min-w-6 place-items-center rounded-md px-1.5 text-xs font-bold',
        score >= 7 ? 'bg-red-100 text-red-700' : score >= 5 ? 'bg-orange-100 text-orange-700' : score >= 1 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600',
      )}
    >
      {score}
    </span>
  );
}

function Risk({ level, percent }: { level?: RiskLevel; percent?: number }) {
  if (!level) return <span className="text-xs text-slate-400">—</span>;
  return <RiskBadge level={level} title={percent != null ? `Predicted probability ${percent}%` : undefined} />;
}

export function PatientTable({
  rows,
  variant = 'compact',
  sort,
  onSort,
  highlightId,
  onView,
}: {
  rows: PatientRow[];
  variant?: 'compact' | 'full';
  sort?: SortState;
  onSort?: (k: SortKey) => void;
  highlightId?: string;
  onView: (id: string) => void;
}) {
  const full = variant === 'full';
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className={cn('w-full text-sm', full ? 'min-w-[680px]' : 'min-w-[620px]')}>
          <thead>
            <tr className="border-y border-slate-200 bg-slate-50/80 text-left text-xs uppercase tracking-wide text-slate-500">
              <Th k="id" sort={sort} onSort={onSort}>
                Patient ID
              </Th>
              <Th k="name" sort={sort} onSort={onSort}>
                Name
              </Th>
              <Th k="age" sort={sort} onSort={onSort}>
                Age
              </Th>
              {full && <Th className="hidden lg:table-cell">Gender</Th>}
              <Th k="ward" sort={sort} onSort={onSort}>
                Ward
              </Th>
              {full && <Th className="hidden xl:table-cell">Diagnosis</Th>}
              <Th k="det" sort={sort} onSort={onSort}>
                Deterioration Risk
              </Th>
              <Th k="readm" sort={sort} onSort={onSort}>
                Readmission Risk
              </Th>
              {full && (
                <Th k="news2" sort={sort} onSort={onSort} className="hidden lg:table-cell">
                  NEWS2
                </Th>
              )}
              <Th className="text-right">Status</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const p = r.patient;
              const hl = p.id === highlightId;
              return (
                <tr
                  key={p.id}
                  onClick={() => onView(p.id)}
                  className={cn('cursor-pointer transition-colors', hl ? 'animate-row-flash bg-emerald-50 hover:bg-emerald-100/60' : 'hover:bg-slate-50/80')}
                >
                  <td className={cn('whitespace-nowrap px-4 py-3 font-mono text-[13px] font-semibold text-slate-600', hl && 'border-l-4 border-l-emerald-500 pl-3')}>{p.id}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{p.name}</span>
                      {r.isNew && <span className="rounded bg-emerald-100 px-1.5 py-px text-[10px] font-bold uppercase text-emerald-700">New</span>}
                      {r.activeAlerts > 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 px-1.5 py-px text-[10px] font-bold text-red-600" title={`${r.activeAlerts} active alerts`}>
                          <Bell className="h-3 w-3" />
                          {r.activeAlerts}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{r.age}</td>
                  {full && <td className="hidden px-4 py-3 text-slate-700 lg:table-cell">{p.gender}</td>}
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{p.ward}</td>
                  {full && (
                    <td className="hidden max-w-[220px] truncate px-4 py-3 text-slate-600 xl:table-cell" title={p.diagnosis}>
                      {p.diagnosis}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <Risk level={r.prediction?.deterioration.level} percent={r.prediction?.deterioration.percent} />
                  </td>
                  <td className="px-4 py-3">
                    <Risk level={r.prediction?.readmission.level} percent={r.prediction?.readmission.percent} />
                  </td>
                  {full && (
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <News2Pill score={r.prediction?.news2.total ?? 0} />
                    </td>
                  )}
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onView(p.id);
                      }}
                      className="inline-flex h-8 items-center rounded-md bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
                    >
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2.5 md:hidden">
        {rows.map((r) => {
          const p = r.patient;
          const hl = p.id === highlightId;
          return (
            <li key={p.id}>
              <button
                onClick={() => onView(p.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border bg-white p-3.5 text-left shadow-sm transition active:scale-[0.99]',
                  hl ? 'animate-row-flash border-emerald-300 bg-emerald-50' : 'border-slate-200',
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold text-slate-500">{p.id}</span>
                    {r.isNew && <span className="rounded bg-emerald-100 px-1.5 py-px text-[10px] font-bold uppercase text-emerald-700">New</span>}
                    {r.activeAlerts > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 px-1.5 py-px text-[10px] font-bold text-red-600">
                        <Bell className="h-3 w-3" />
                        {r.activeAlerts}
                      </span>
                    )}
                    {full && r.prediction && (
                      <span className="ml-auto text-[11px] font-medium text-slate-400">NEWS2 {r.prediction.news2.total}</span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[15px] font-semibold text-slate-900">{p.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {r.age} y · {p.gender} · {p.ward}
                    {full ? ` · ${p.diagnosis}` : ''}
                  </p>
                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Deterioration</p>
                      {r.prediction ? <RiskBadge level={r.prediction.deterioration.level} percent={r.prediction.deterioration.percent} size="sm" /> : '—'}
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Readmission</p>
                      {r.prediction ? <RiskBadge level={r.prediction.readmission.level} percent={r.prediction.readmission.percent} size="sm" /> : '—'}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
