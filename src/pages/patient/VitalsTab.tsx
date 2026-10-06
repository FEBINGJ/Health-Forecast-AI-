import { useState } from 'react';
import { Activity, BellRing, ClipboardList, Plus, Thermometer, Wind } from 'lucide-react';
import type { Patient } from '../../types';
import { computeNews2, vitalScore } from '../../lib/model';
import { fmtDateTime } from '../../lib/format';
import { Button, Card, CardHeader, Segmented } from '../../components/ui';
import { MiniTrendChart, SeriesToggle, VitalsTrendChart, type SeriesKey } from '../../components/charts';
import { PatientAlerts, ScorePill, scoreTone } from './shared';
import { cn } from '../../utils/cn';

const RANGES = [
  { id: '12', label: '12h' },
  { id: '24', label: '24h' },
  { id: '48', label: '48h' },
  { id: '72', label: '72h' },
];

export default function VitalsTab({ patient, onRecord }: { patient: Patient; onRecord: () => void }) {
  const [hours, setHours] = useState('48');
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({ hr: true, spo2: true, sys: true });
  const [limit, setLimit] = useState(8);
  const h = Number(hours);
  const readings = [...patient.vitals].reverse();

  return (
    <div className="space-y-4 sm:space-y-5">
      <Card className="min-w-0">
        <CardHeader
          title="Vital Signs Trend"
          subtitle={`${patient.vitals.length} observations recorded`}
          icon={<Activity className="h-4 w-4" />}
          action={<Segmented items={RANGES} value={hours} onChange={setHours} />}
        />
        <div className="px-4 pt-3 sm:px-5">
          <SeriesToggle visible={visible} onToggle={(k) => setVisible((v) => ({ ...v, [k]: !v[k] }))} />
        </div>
        <div className="p-2 sm:p-3">
          <VitalsTrendChart vitals={patient.vitals} hours={h} visible={visible} height={280} />
        </div>
      </Card>

      <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader title="Respiratory Rate" subtitle="breaths/min · normal range 12–20 shaded" icon={<Wind className="h-4 w-4" />} />
          <div className="p-2 sm:p-3">
            <MiniTrendChart data={patient.vitals.map((v) => ({ t: v.t, v: v.rr }))} color="#8b5cf6" domain={[10, 24]} unit="/min" label="Resp. rate" refRange={[12, 20]} hours={h} />
          </div>
        </Card>
        <Card className="min-w-0">
          <CardHeader title="Temperature" subtitle="°C · normal range 36.1–38.0 shaded" icon={<Thermometer className="h-4 w-4" />} />
          <div className="p-2 sm:p-3">
            <MiniTrendChart data={patient.vitals.map((v) => ({ t: v.t, v: v.temp }))} color="#f59e0b" domain={[36, 38.5]} unit="°C" label="Temperature" refRange={[36.1, 38]} hours={h} decimals={1} />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="min-w-0">
          <CardHeader
            title="Latest Measurements"
            subtitle="Values coloured by NEWS2 sub-score"
            icon={<ClipboardList className="h-4 w-4" />}
            action={
              <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={onRecord}>
                Record
              </Button>
            }
          />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-y border-slate-200 bg-slate-50/80 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-semibold">Time</th>
                  <th className="px-3 py-2.5 font-semibold">HR</th>
                  <th className="px-3 py-2.5 font-semibold">SpO₂</th>
                  <th className="px-3 py-2.5 font-semibold">BP (Sys/Dia)</th>
                  <th className="px-3 py-2.5 font-semibold">Temp</th>
                  <th className="px-3 py-2.5 font-semibold">RR</th>
                  <th className="px-3 py-2.5 font-semibold">NEWS2</th>
                  <th className="px-4 py-2.5 font-semibold">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {readings.slice(0, limit).map((v, i) => (
                  <tr key={`${v.t}-${i}`} className={cn('tabular-nums', i === 0 && 'bg-blue-50/40')}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                      {fmtDateTime(v.t)}
                      {i === 0 && <span className="ml-2 rounded bg-blue-100 px-1.5 py-px text-[10px] font-bold uppercase text-blue-700">Latest</span>}
                    </td>
                    <td className={cn('px-3 py-2.5', scoreTone(vitalScore('hr', v.hr)))}>{v.hr}</td>
                    <td className={cn('px-3 py-2.5', scoreTone(vitalScore('spo2', v.spo2)))}>
                      {v.spo2}%{v.o2 && <span className="ml-1 text-[10px] font-semibold text-blue-600">O₂</span>}
                    </td>
                    <td className={cn('whitespace-nowrap px-3 py-2.5', scoreTone(vitalScore('sys', v.sys)))}>
                      {v.sys}/{v.dia}
                    </td>
                    <td className={cn('px-3 py-2.5', scoreTone(vitalScore('temp', v.temp)))}>{v.temp.toFixed(1)}</td>
                    <td className={cn('px-3 py-2.5', scoreTone(vitalScore('rr', v.rr)))}>{v.rr}</td>
                    <td className="px-3 py-2.5">
                      <ScorePill score={computeNews2(v).total} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">
                      {v.source ?? 'Monitor'}
                      {v.by ? ` · ${v.by}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {readings.length > limit && (
            <div className="border-t border-slate-100 p-2 text-center">
              <button onClick={() => setLimit((l) => l + 12)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-blue-600 hover:bg-blue-50">
                Show older measurements ({readings.length - limit})
              </button>
            </div>
          )}
        </Card>

        <Card className="self-start">
          <CardHeader title="Recent Alerts" subtitle="Generated by vital-sign rules and the AI model" icon={<BellRing className="h-4 w-4" />} />
          <PatientAlerts patientId={patient.id} limit={6} />
        </Card>
      </div>
    </div>
  );
}
