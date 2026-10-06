import { useMemo, useState } from 'react';
import { BrainCircuit, ClipboardList, Cpu, Sparkles, TrendingUp } from 'lucide-react';
import type { Patient, Prediction, RiskResult, Thresholds } from '../../types';
import { useApp } from '../../store/AppStore';
import { MODEL_INFO, contributionImpact, riskHistory, type RiskPoint } from '../../lib/model';
import { HOUR, fmtDateTime } from '../../lib/format';
import { Card, CardHeader, EmptyState, Gauge, RiskBadge, Segmented } from '../../components/ui';
import { RiskTrajectoryChart } from '../../components/charts';
import { SubScore } from './shared';
import { cn } from '../../utils/cn';

function guidance(total: number, hasThree: boolean): string {
  if (total >= 7) return 'Emergency response: continuous monitoring and urgent assessment by a critical-care outreach team.';
  if (total >= 5) return 'Urgent response: at least hourly observations and urgent review by a clinician competent in acute illness.';
  if (hasThree) return 'Single parameter scoring 3: at least hourly observations and urgent ward-based review.';
  if (total >= 1) return 'Low risk: 4–6 hourly observations; registered nurse to decide on escalation.';
  return 'Minimal risk: continue routine observations at least every 12 hours.';
}

function GaugeCard({ title, subtitle, r, th, history, k }: { title: string; subtitle: string; r: RiskResult; th: Thresholds; history: RiskPoint[]; k: 'det' | 'readm' }) {
  const last = history[history.length - 1];
  const ref = last ? history.find((h) => h.t >= last.t - 12 * HOUR - 60_000 && h.t < last.t) : undefined;
  const delta = ref ? r.percent - ref[k] : 0;
  const peak = history.length ? Math.max(...history.map((h) => h[k]), r.percent) : r.percent;
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-xs leading-snug text-slate-500">{subtitle}</p>
        </div>
        <RiskBadge level={r.level} size="lg" />
      </div>
      <div className="mt-3 flex justify-center">
        <Gauge percent={r.percent} level={r.level} thresholds={th} label={`${r.level} risk`} />
      </div>
      <div className="mt-3 grid grid-cols-3 divide-x divide-slate-200 rounded-lg bg-slate-50 py-2.5 text-center">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">12 h change</p>
          <p className={cn('text-sm font-bold tabular-nums', delta > 0 ? 'text-red-600' : delta < 0 ? 'text-emerald-600' : 'text-slate-700')}>
            {delta > 0 ? '+' : ''}
            {delta} pts
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Peak</p>
          <p className="text-sm font-bold tabular-nums text-slate-700">{peak}%</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Thresholds</p>
          <p className="text-sm font-bold tabular-nums text-slate-700">
            {th.moderate} / {th.high}%
          </p>
        </div>
      </div>
    </Card>
  );
}

export default function RiskTab({ patient, prediction }: { patient: Patient; prediction: Prediction | null }) {
  const { state } = useApp();
  const th = state.settings.thresholds;
  const history = useMemo(() => riskHistory(patient, th), [patient, th]);
  const [model, setModel] = useState<'det' | 'readm'>('det');

  if (!prediction) return <EmptyState icon={<BrainCircuit className="h-5 w-5" />} title="No prediction available" description="Record vital signs to run the risk model." />;

  const r = model === 'det' ? prediction.deterioration : prediction.readmission;
  const contribs = r.contributions.filter((c) => Math.abs(c.value) > 0.02).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const max = Math.max(0.01, ...contribs.map((c) => Math.abs(c.value)));
  const baseRate = Math.round(100 / (1 + Math.exp(-r.intercept)));
  const n2 = prediction.news2;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
        <GaugeCard
          title="Deterioration Risk"
          subtitle="Probability of clinical deterioration (rapid response, ICU transfer or cardiac arrest) within the next 24 hours"
          r={prediction.deterioration}
          th={th}
          history={history}
          k="det"
        />
        <GaugeCard
          title="ICU Readmission Risk"
          subtitle="Probability of ICU readmission or unplanned readmission within 30 days of discharge"
          r={prediction.readmission}
          th={th}
          history={history}
          k="readm"
        />
      </div>

      <Card className="min-w-0">
        <CardHeader
          title="Risk Trajectory"
          subtitle="Model output recalculated at every observation · shaded bands mark moderate and high thresholds"
          icon={<TrendingUp className="h-4 w-4" />}
          action={
            <div className="hidden items-center gap-4 text-xs font-medium text-slate-600 sm:flex">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-600" /> Deterioration
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" /> ICU Readmission
              </span>
            </div>
          }
        />
        <div className="flex items-center gap-4 px-4 pt-3 text-xs font-medium text-slate-600 sm:hidden">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-600" /> Deterioration
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" /> ICU Readmission
          </span>
        </div>
        <div className="p-2 sm:p-3">
          <RiskTrajectoryChart points={history} thresholds={th} height={280} />
        </div>
      </Card>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
        <Card className="min-w-0">
          <CardHeader
            title="What is driving this prediction?"
            subtitle="Estimated change in predicted probability attributable to each factor"
            icon={<Sparkles className="h-4 w-4" />}
          />
          <div className="px-4 pt-3 sm:px-5">
            <Segmented
              items={[
                { id: 'det', label: `Deterioration · ${prediction.deterioration.percent}%` },
                { id: 'readm', label: `Readmission · ${prediction.readmission.percent}%` },
              ]}
              value={model}
              onChange={setModel}
            />
          </div>
          <div className="space-y-3.5 p-4 sm:p-5">
            {contribs.length ? (
              contribs.map((c) => {
                const impact = contributionImpact(r, c);
                const pos = c.value > 0;
                return (
                  <div key={c.key}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium text-slate-800">{c.label}</span>
                      <span className={cn('shrink-0 text-xs font-bold tabular-nums', pos ? 'text-red-600' : 'text-emerald-600')}>
                        {impact > 0 ? '+' : impact < 0 ? '−' : '±'}
                        {Math.abs(impact)} pts
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-slate-100">
                      <div
                        className={cn('h-full rounded-full', pos ? 'bg-gradient-to-r from-red-400 to-red-500' : 'bg-gradient-to-r from-emerald-400 to-emerald-500')}
                        style={{ width: `${Math.max(3, (Math.abs(c.value) / max) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{c.detail}</p>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">No factors are currently increasing this risk.</p>
            )}
            <p className="border-t border-slate-100 pt-3 text-[11px] text-slate-400">
              Baseline risk for a 60-year-old with normal observations and no history: {baseRate}%. Impacts are approximate and not additive.
            </p>
          </div>
        </Card>

        <div className="space-y-4 sm:space-y-5">
          <Card>
            <CardHeader title="NEWS2 Breakdown" subtitle={`Latest observation · ${fmtDateTime(prediction.t)}`} icon={<ClipboardList className="h-4 w-4" />} />
            <div className="p-4 sm:p-5">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {n2.parts.map((p) => (
                    <tr key={p.key}>
                      <td className="py-2 text-slate-600">{p.label}</td>
                      <td className="py-2 text-right font-medium tabular-nums text-slate-900">{p.value}</td>
                      <td className="w-10 py-2 pl-3 text-right">
                        <SubScore score={p.score} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
                <span className="text-sm font-semibold text-slate-800">Total NEWS2</span>
                <span className="flex items-center gap-2">
                  <span className="text-lg font-bold tabular-nums text-slate-900">{n2.total}</span>
                  <span
                    className={cn(
                      'rounded-md px-2 py-0.5 text-xs font-semibold',
                      n2.band === 'High' ? 'bg-red-100 text-red-700' : n2.band === 'Medium' ? 'bg-orange-100 text-orange-700' : n2.band === 'Low–Medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700',
                    )}
                  >
                    {n2.band}
                  </span>
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{guidance(n2.total, n2.parts.some((p) => p.score === 3))}</p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Model Information" icon={<Cpu className="h-4 w-4" />} />
            <dl className="space-y-2.5 p-4 text-sm sm:p-5">
              {[
                ['Model', `${MODEL_INFO.name} ${MODEL_INFO.version}`],
                ['Inputs', 'Vital signs, 12-hour trends, laboratory results, age, comorbidities and admission history'],
                ['Deterioration horizon', MODEL_INFO.deteriorationHorizon],
                ['Readmission horizon', MODEL_INFO.readmissionHorizon],
                ['Last assessment', fmtDateTime(prediction.t)],
              ].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[130px_1fr] gap-3">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="font-medium text-slate-800">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mx-4 mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800 sm:mx-5 sm:mb-5">
              <strong>Decision support only.</strong> Predictions come from a demonstration model running on simulated data and must not replace clinical judgement.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
