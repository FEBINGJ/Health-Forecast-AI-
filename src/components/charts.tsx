import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Thresholds, VitalReading } from '../types';
import type { RiskPoint } from '../lib/model';
import { HOUR, MIN, fmtDateTime, fmtTick } from '../lib/format';
import { cn } from '../utils/cn';

export const VITAL_SERIES = {
  hr: { label: 'Heart Rate', unit: 'bpm', color: '#ef4444' },
  spo2: { label: 'SpO₂', unit: '%', color: '#3b82f6' },
  sys: { label: 'Blood Pressure (Sys)', unit: 'mmHg', color: '#10b981' },
} as const;

export type SeriesKey = keyof typeof VITAL_SERIES;
export const SERIES_KEYS: SeriesKey[] = ['hr', 'spo2', 'sys'];

const UNIT_BY_LABEL: Record<string, string> = {
  'Heart Rate': 'bpm',
  'SpO₂': '%',
  'Blood Pressure (Sys)': 'mmHg',
  Deterioration: '%',
  'ICU Readmission': '%',
};

const tooltipProps = {
  contentStyle: {
    borderRadius: 10,
    border: '1px solid #e2e8f0',
    boxShadow: '0 12px 28px -12px rgba(15,23,42,.28)',
    fontSize: 12,
    padding: '8px 10px',
  },
  labelStyle: { fontWeight: 600, color: '#0f172a', marginBottom: 4 },
  itemStyle: { padding: 0 },
};

const axisTick = { fontSize: 11, fill: '#64748b' };

function stepFor(spanHours: number): number {
  if (spanHours <= 12) return 2;
  if (spanHours <= 24) return 4;
  if (spanHours <= 48) return 8;
  if (spanHours <= 96) return 12;
  return 24;
}

function makeTicks(start: number, end: number, stepH: number): number[] {
  const step = stepH * HOUR;
  const off = new Date(start).getTimezoneOffset() * MIN;
  const out: number[] = [];
  for (let t = Math.ceil((start - off) / step) * step + off; t <= end; t += step) out.push(t);
  return out;
}

export function SeriesToggle({ visible, onToggle, className }: { visible: Record<SeriesKey, boolean>; onToggle: (k: SeriesKey) => void; className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-x-4 gap-y-2', className)}>
      {SERIES_KEYS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onToggle(k)}
          aria-pressed={visible[k]}
          className={cn('inline-flex items-center gap-2 text-xs font-medium transition', visible[k] ? 'text-slate-700' : 'text-slate-400 line-through')}
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: visible[k] ? VITAL_SERIES[k].color : '#cbd5e1' }} />
          {VITAL_SERIES[k].label}
        </button>
      ))}
    </div>
  );
}

export function VitalsTrendChart({
  vitals,
  hours,
  visible,
  height = 260,
}: {
  vitals: VitalReading[];
  hours: number;
  visible: Record<SeriesKey, boolean>;
  height?: number;
}) {
  const end = vitals.length ? vitals[vitals.length - 1].t : Date.now();
  const start = end - hours * HOUR;
  const data = vitals.filter((v) => v.t >= start).map((v) => ({ t: v.t, hr: v.hr, spo2: v.spo2, sys: v.sys }));
  const ticks = makeTicks(start, end, stepFor(hours));
  const dots = data.length <= 14;
  return (
    <div style={{ height }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 14, bottom: 0, left: -14 }}>
          <CartesianGrid stroke="#eef2f7" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={[start, end]}
            ticks={ticks}
            tickFormatter={(t: number) => fmtTick(t, hours)}
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            allowDataOverflow
            minTickGap={10}
          />
          <YAxis
            domain={[(min: number) => Math.min(60, Math.floor(min / 10) * 10), (max: number) => Math.max(140, Math.ceil(max / 10) * 10)]}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={46}
          />
          <Tooltip
            labelFormatter={(l) => fmtDateTime(Number(l))}
            formatter={(value, name) => [`${value} ${UNIT_BY_LABEL[String(name)] ?? ''}`, name]}
            {...tooltipProps}
          />
          {SERIES_KEYS.filter((k) => visible[k]).map((k) => (
            <Line
              key={k}
              type="monotone"
              dataKey={k}
              name={VITAL_SERIES[k].label}
              stroke={VITAL_SERIES[k].color}
              strokeWidth={2.25}
              dot={dots ? { r: 3, strokeWidth: 0, fill: VITAL_SERIES[k].color } : false}
              activeDot={{ r: 4.5, strokeWidth: 2, stroke: '#fff' }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MiniTrendChart({
  data,
  color,
  domain,
  unit,
  label,
  refRange,
  hours,
  height = 150,
  decimals = 0,
}: {
  data: { t: number; v: number }[];
  color: string;
  domain: [number, number];
  unit: string;
  label: string;
  refRange?: [number, number];
  hours?: number;
  height?: number;
  decimals?: number;
}) {
  const end = data.length ? data[data.length - 1].t : Date.now();
  let start = hours ? end - hours * HOUR : data.length ? data[0].t : end - HOUR;
  if (start >= end) start = end - HOUR;
  const span = (end - start) / HOUR;
  const shown = data.filter((d) => d.t >= start);
  const ticks = makeTicks(start, end, stepFor(span));
  const fmt = (v: number) => v.toFixed(decimals);
  return (
    <div style={{ height }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={shown} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
          {refRange && <ReferenceArea y1={refRange[0]} y2={refRange[1]} fill="#10b981" fillOpacity={0.08} strokeOpacity={0} ifOverflow="hidden" />}
          <CartesianGrid stroke="#eef2f7" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={[start, end]}
            ticks={ticks}
            tickFormatter={(t: number) => fmtTick(t, span)}
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            allowDataOverflow
            minTickGap={10}
          />
          <YAxis
            domain={[(min: number) => Math.min(domain[0], Math.floor(min)), (max: number) => Math.max(domain[1], Math.ceil(max))]}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v: number) => (decimals ? v.toFixed(1) : String(Math.round(v)))}
          />
          <Tooltip labelFormatter={(l) => fmtDateTime(Number(l))} formatter={(value) => [`${fmt(Number(value))} ${unit}`, label]} {...tooltipProps} />
          <Line
            type="monotone"
            dataKey="v"
            name={label}
            stroke={color}
            strokeWidth={2}
            dot={shown.length <= 14 ? { r: 3, strokeWidth: 0, fill: color } : false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RiskTrajectoryChart({ points, thresholds, height = 260 }: { points: RiskPoint[]; thresholds: Thresholds; height?: number }) {
  const end = points.length ? points[points.length - 1].t : Date.now();
  let start = points.length ? points[0].t : end - 48 * HOUR;
  if (start >= end) start = end - HOUR;
  const span = (end - start) / HOUR;
  const ticks = makeTicks(start, end, stepFor(span));
  const dots = points.length <= 14;
  return (
    <div style={{ height }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 10, right: 14, bottom: 0, left: -14 }}>
          <ReferenceArea y1={thresholds.high} y2={100} fill="#ef4444" fillOpacity={0.06} strokeOpacity={0} ifOverflow="hidden" />
          <ReferenceArea y1={thresholds.moderate} y2={thresholds.high} fill="#f97316" fillOpacity={0.06} strokeOpacity={0} ifOverflow="hidden" />
          <CartesianGrid stroke="#eef2f7" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={[start, end]}
            ticks={ticks}
            tickFormatter={(t: number) => fmtTick(t, span)}
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            allowDataOverflow
            minTickGap={10}
          />
          <YAxis domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tickFormatter={(v: number) => `${v}%`} tick={axisTick} tickLine={false} axisLine={false} width={48} />
          <ReferenceLine y={thresholds.high} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.55} />
          <ReferenceLine y={thresholds.moderate} stroke="#f97316" strokeDasharray="4 4" strokeOpacity={0.55} />
          <Tooltip labelFormatter={(l) => fmtDateTime(Number(l))} formatter={(value, name) => [`${value}%`, name]} {...tooltipProps} />
          <Line
            type="monotone"
            dataKey="det"
            name="Deterioration"
            stroke="#dc2626"
            strokeWidth={2.25}
            dot={dots ? { r: 3, strokeWidth: 0, fill: '#dc2626' } : false}
            activeDot={{ r: 4.5, strokeWidth: 2, stroke: '#fff' }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="readm"
            name="ICU Readmission"
            stroke="#4f46e5"
            strokeWidth={2.25}
            dot={dots ? { r: 3, strokeWidth: 0, fill: '#4f46e5' } : false}
            activeDot={{ r: 4.5, strokeWidth: 2, stroke: '#fff' }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
