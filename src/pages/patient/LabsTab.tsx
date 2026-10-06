import { useState } from 'react';
import { ArrowDown, ArrowUp, ChartLine, FlaskConical, Minus, Plus } from 'lucide-react';
import type { LabKey, Patient } from '../../types';
import { LAB_KEYS, LAB_META, fmtLab, labFlag } from '../../lib/model';
import { fmtDateTime } from '../../lib/format';
import { Button, Card, CardHeader, EmptyState } from '../../components/ui';
import { MiniTrendChart } from '../../components/charts';
import { cn } from '../../utils/cn';

const RELEVANCE: Record<LabKey, string> = {
  wbc: 'Used by the deterioration model as an infection / sepsis signal when above 11 or below 4 ×10⁹/L.',
  hb: 'Anaemia (Hb below 10 g/dL) increases the predicted ICU readmission risk.',
  plt: 'Shown for clinical context; not used by the current model version.',
  creat: 'Impaired renal function (above 1.5 mg/dL) raises both deterioration and readmission risk.',
  lactate: 'Strong deterioration predictor when above 2.0 mmol/L (tissue hypoperfusion).',
  crp: 'Contributes to deterioration risk when above 50 mg/L, more strongly above 100 mg/L.',
  na: 'Hyponatraemia (Na⁺ below 135 mmol/L) increases the predicted ICU readmission risk.',
  k: 'Shown for clinical context; not used by the current model version.',
};

function FlagChip({ flag }: { flag: 'H' | 'L' }) {
  return <span className={cn('ml-1.5 rounded px-1.5 py-px text-[10px] font-bold', flag === 'H' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700')}>{flag}</span>;
}

function Trend({ diff }: { diff: number }) {
  if (Math.abs(diff) < 1e-9) return <Minus className="h-4 w-4 text-slate-400" />;
  return diff > 0 ? <ArrowUp className="h-4 w-4 text-red-500" /> : <ArrowDown className="h-4 w-4 text-blue-500" />;
}

export default function LabsTab({ patient, onAdd }: { patient: Patient; onAdd: () => void }) {
  const [selected, setSelected] = useState<LabKey>('wbc');
  const series = (k: LabKey) => patient.labs.filter((p) => typeof p.values[k] === 'number').map((p) => ({ t: p.t, v: p.values[k] as number }));
  const lastPanel = patient.labs[patient.labs.length - 1];
  const keys = LAB_KEYS.filter((k) => series(k).length > 0);
  const sel = keys.includes(selected) ? selected : keys[0];

  if (!patient.labs.length)
    return (
      <Card>
        <EmptyState
          icon={<FlaskConical className="h-5 w-5" />}
          title="No lab results yet"
          description="Add the first panel so laboratory values can be included in the risk model."
          action={
            <Button icon={<Plus className="h-4 w-4" />} onClick={onAdd}>
              Add lab results
            </Button>
          }
        />
      </Card>
    );

  const meta = LAB_META[sel];

  return (
    <div className="grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Card className="min-w-0">
        <CardHeader
          title="Lab Results"
          subtitle={`Last panel ${fmtDateTime(lastPanel.t)} · ${patient.labs.length} panel${patient.labs.length > 1 ? 's' : ''}`}
          icon={<FlaskConical className="h-4 w-4" />}
          action={
            <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={onAdd}>
              Add results
            </Button>
          }
        />
        <div className="mt-3 hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50/80 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Test</th>
                <th className="px-4 py-2.5 font-semibold">Latest</th>
                <th className="px-4 py-2.5 font-semibold">Reference</th>
                <th className="px-4 py-2.5 font-semibold">Previous</th>
                <th className="px-4 py-2.5 font-semibold">Trend</th>
                <th className="hidden px-4 py-2.5 font-semibold lg:table-cell">Collected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {keys.map((k) => {
                const s = series(k);
                const last = s[s.length - 1];
                const prev = s.length > 1 ? s[s.length - 2] : null;
                const flag = labFlag(k, last.v);
                const m = LAB_META[k];
                return (
                  <tr key={k} onClick={() => setSelected(k)} className={cn('cursor-pointer transition-colors', sel === k ? 'bg-blue-50/70' : 'hover:bg-slate-50')}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{m.label}</p>
                      <p className="text-xs text-slate-500">{m.short}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={cn('font-semibold tabular-nums', flag === 'H' ? 'text-red-600' : flag === 'L' ? 'text-blue-600' : 'text-slate-900')}>{fmtLab(k, last.v)}</span>{' '}
                      <span className="text-xs text-slate-400">{m.unit}</span>
                      {flag && <FlagChip flag={flag} />}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                      {m.low}–{m.high}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{prev ? fmtLab(k, prev.v) : '—'}</td>
                    <td className="px-4 py-3">{prev ? <Trend diff={last.v - prev.v} /> : <span className="text-slate-300">—</span>}</td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-xs text-slate-500 lg:table-cell">{fmtDateTime(last.t)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100 sm:hidden">
          {keys.map((k) => {
            const s = series(k);
            const last = s[s.length - 1];
            const prev = s.length > 1 ? s[s.length - 2] : null;
            const flag = labFlag(k, last.v);
            const m = LAB_META[k];
            return (
              <li key={k}>
                <button onClick={() => setSelected(k)} className={cn('flex w-full items-center gap-3 px-4 py-3 text-left', sel === k && 'bg-blue-50/70')}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{m.label}</p>
                    <p className="text-[11px] text-slate-500">
                      Ref {m.low}–{m.high} {m.unit}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn('text-sm font-semibold tabular-nums', flag === 'H' ? 'text-red-600' : flag === 'L' ? 'text-blue-600' : 'text-slate-900')}>
                      {fmtLab(k, last.v)}
                      {flag && <FlagChip flag={flag} />}
                    </p>
                    <p className="text-[11px] text-slate-400">prev {prev ? fmtLab(k, prev.v) : '—'}</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="min-w-0 self-start">
        <CardHeader title={`${meta.label} trend`} subtitle={`Reference range ${meta.low}–${meta.high} ${meta.unit} (shaded)`} icon={<ChartLine className="h-4 w-4" />} />
        <div className="p-2 sm:p-3">
          <MiniTrendChart data={series(sel)} color="#2563eb" domain={[meta.low, meta.high]} unit={meta.unit} label={meta.short} refRange={[meta.low, meta.high]} height={230} decimals={meta.decimals > 1 ? 2 : meta.decimals} />
        </div>
        <div className="border-t border-slate-100 p-4 text-xs leading-relaxed text-slate-500 sm:px-5">
          <span className="font-semibold text-slate-700">Model relevance: </span>
          {RELEVANCE[sel]}
        </div>
      </Card>
    </div>
  );
}
