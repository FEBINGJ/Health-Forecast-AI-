import { useMemo, useState } from 'react';
import { Activity, BellRing, BrainCircuit, CircleCheck, Droplets, Gauge as GaugeIcon, HeartPulse, ListChecks, Thermometer, Wind } from 'lucide-react';
import type { Patient, Prediction, RiskResult, Thresholds } from '../../types';
import { useApp } from '../../store/AppStore';
import { riskHistory, vitalScore } from '../../lib/model';
import { HOUR, fmtDateTime } from '../../lib/format';
import { Card, CardHeader, EmptyState, RISK_STYLES, RiskBadge, RiskBar } from '../../components/ui';
import { SeriesToggle, VitalsTrendChart, type SeriesKey } from '../../components/charts';
import { PatientAlerts, ScorePill, baseline12h } from './shared';
import { cn } from '../../utils/cn';

type Tab = 'overview' | 'vitals' | 'labs' | 'risk' | 'notes';

function RiskBlock({ title, horizon, r, th, delta }: { title: string; horizon: string; r: RiskResult; th: Thresholds; delta: number | null }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-700">{title}</p>
          <p className="text-[11px] text-slate-400">{horizon}</p>
        </div>
        <RiskBadge level={r.level} size="lg" />
      </div>
      <div className="mt-2.5 flex items-center gap-3">
        <span className={cn('w-14 text-2xl font-bold tabular-nums', RISK_STYLES[r.level].text)}>{r.percent}%</span>
        <RiskBar percent={r.percent} level={r.level} thresholds={th} className="flex-1" />
      </div>
      {delta != null && delta !== 0 && (
        <p className={cn('mt-1 text-[11px] font-medium', delta > 0 ? 'text-red-600' : 'text-emerald-600')}>
          {delta > 0 ? '▲' : '▼'} {Math.abs(delta)} pts vs 12 h ago
        </p>
      )}
    </div>
  );
}

export default function OverviewTab({ patient, prediction, onTab }: { patient: Patient; prediction: Prediction | null; onTab: (t: Tab) => void }) {
  const { state } = useApp();
  const th = state.settings.thresholds;
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({ hr: true, spo2: true, sys: true });
  const [showAll, setShowAll] = useState(false);
  const history = useMemo(() => riskHistory(patient, th), [patient, th]);

  if (!prediction) return <EmptyState icon={<Activity className="h-5 w-5" />} title="No observations yet" description="Record vital signs to generate a risk prediction." />;

  const latest = patient.vitals[patient.vitals.length - 1];
  const base = baseline12h(patient.vitals);
  const ref = history.find((h) => h.t >= latest.t - 12 * HOUR - 60_000 && h.t < latest.t);
  const dDet = ref ? prediction.deterioration.percent - ref.det : null;
  const dReadm = ref ? prediction.readmission.percent - ref.readm : null;
  const factors = prediction.factors;
  const shown = showAll ? factors : factors.slice(0, 4);

  const tiles = [
    { k: 'hr', label: 'Heart Rate', value: String(latest.hr), unit: 'bpm', icon: HeartPulse, score: vitalScore('hr', latest.hr), delta: base ? latest.hr - base.hr : null },
    { k: 'spo2', label: 'SpO₂', value: String(latest.spo2), unit: '%', icon: Droplets, score: vitalScore('spo2', latest.spo2), delta: base ? latest.spo2 - base.spo2 : null },
    { k: 'bp', label: 'Blood Pressure', value: `${latest.sys}/${latest.dia}`, unit: 'mmHg', icon: GaugeIcon, score: vitalScore('sys', latest.sys), delta: base ? latest.sys - base.sys : null },
    { k: 'rr', label: 'Resp. Rate', value: String(latest.rr), unit: '/min', icon: Wind, score: vitalScore('rr', latest.rr), delta: base ? latest.rr - base.rr : null },
    { k: 'temp', label: 'Temperature', value: latest.temp.toFixed(1), unit: '°C', icon: Thermometer, score: vitalScore('temp', latest.temp), delta: base ? Math.round((latest.temp - base.temp) * 10) / 10 : null },
  ];

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <Card className="flex flex-col">
          <CardHeader title="Risk Predictions" subtitle={`AI assessment · ${fmtDateTime(prediction.t)}`} icon={<BrainCircuit className="h-4 w-4" />} />
          <div className="flex-1 space-y-5 p-4 sm:p-5">
            <RiskBlock title="Deterioration Risk" horizon="Next 24 hours" r={prediction.deterioration} th={th} delta={dDet} />
            <RiskBlock title="ICU Readmission Risk" horizon="Within 30 days of discharge" r={prediction.readmission} th={th} delta={dReadm} />
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
              <span className="font-medium text-slate-600">NEWS2 score</span>
              <span className="flex items-center gap-2">
                <ScorePill score={prediction.news2.total} />
                <span className="text-xs text-slate-500">{prediction.news2.band} clinical risk</span>
              </span>
            </div>
          </div>
          <button onClick={() => onTab('risk')} className="rounded-b-xl border-t border-slate-100 px-5 py-3 text-left text-sm font-semibold text-blue-600 transition hover:bg-slate-50">
            View full risk analysis →
          </button>
        </Card>

        <Card className="min-w-0">
          <CardHeader
            title="Key Trends (Last 48 Hours)"
            subtitle="Heart rate, oxygen saturation and systolic blood pressure"
            icon={<Activity className="h-4 w-4" />}
            action={
              <button onClick={() => onTab('vitals')} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                Details
              </button>
            }
          />
          <div className="px-4 pt-3 sm:px-5">
            <SeriesToggle visible={visible} onToggle={(k) => setVisible((v) => ({ ...v, [k]: !v[k] }))} />
          </div>
          <div className="p-2 sm:p-3">
            <VitalsTrendChart vitals={patient.vitals} hours={48} visible={visible} height={250} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t, i) => (
          <div
            key={t.k}
            className={cn(
              'rounded-xl border bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
              t.score >= 3 ? 'border-red-200' : t.score === 2 ? 'border-orange-200' : t.score === 1 ? 'border-amber-200' : 'border-slate-200',
              i === 4 && 'col-span-2 sm:col-span-1',
            )}
          >
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </span>
              {t.score > 0 && (
                <span className={cn('rounded px-1.5 text-[10px] font-bold', t.score >= 3 ? 'bg-red-100 text-red-700' : t.score === 2 ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700')}>
                  +{t.score}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-xl font-bold tabular-nums text-slate-900">
              {t.value} <span className="text-xs font-medium text-slate-400">{t.unit}</span>
            </p>
            {t.delta != null && (
              <p className="mt-0.5 text-[11px] text-slate-500">
                {t.delta > 0 ? '+' : ''}
                {t.delta} vs 12 h ago
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <Card>
          <CardHeader title="Important Contributing Factors" subtitle="Model drivers ranked by clinical priority" icon={<ListChecks className="h-4 w-4" />} />
          <div className="p-4 sm:p-5">
            {factors.length ? (
              <ul className="divide-y divide-slate-100">
                {shown.map((f) => (
                  <li key={f.key} className="flex items-start gap-3 py-2.5 first:pt-0">
                    <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', f.severity === 'high' ? 'bg-red-500' : 'bg-orange-400')} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800">{f.text}</p>
                      <p className="text-xs text-slate-500">{f.detail}</p>
                    </div>
                    <span className="hidden shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:inline">{f.model}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                <CircleCheck className="h-5 w-5 shrink-0" />
                No significant risk factors identified — vital signs and laboratory results are within expected ranges.
              </div>
            )}
            {factors.length > 4 && (
              <button onClick={() => setShowAll((s) => !s)} className="mt-2 text-sm font-semibold text-blue-600 hover:text-blue-800">
                {showAll ? 'Show fewer' : `Show all ${factors.length} factors`}
              </button>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Alerts" subtitle="Most recent first" icon={<BellRing className="h-4 w-4" />} />
          <PatientAlerts patientId={patient.id} limit={4} />
        </Card>
      </div>
    </div>
  );
}
