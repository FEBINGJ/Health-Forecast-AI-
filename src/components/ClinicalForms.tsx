import type { Consciousness, LabKey, VitalReading } from '../types';
import { LAB_KEYS, LAB_META, vitalScore, type VitalKey } from '../lib/model';
import { Field, Input, Select } from './ui';
import { cn } from '../utils/cn';

/* ------------------------------------------------------------------ */
/* Vitals                                                              */
/* ------------------------------------------------------------------ */

export interface VitalsForm {
  hr: string;
  spo2: string;
  bp: string;
  rr: string;
  temp: string;
  time: string;
  o2: boolean;
  avpu: Consciousness;
}

export type VitalsErrors = Partial<Record<keyof VitalsForm, string>>;

export const AVPU_OPTIONS: Consciousness[] = ['Alert', 'New confusion', 'Voice', 'Pain', 'Unresponsive'];

export function emptyVitals(time: string): VitalsForm {
  return { hr: '', spo2: '', bp: '', rr: '', temp: '', time, o2: false, avpu: 'Alert' };
}

const num = (s: string) => (s.trim() === '' ? Number.NaN : Number(s));

export function parseBp(bp: string): { sys: number; dia: number } | null {
  const m = bp.match(/^\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*$/);
  return m ? { sys: Number(m[1]), dia: Number(m[2]) } : null;
}

export function parseVitals(f: VitalsForm): { errors: VitalsErrors; reading: VitalReading | null } {
  const errors: VitalsErrors = {};
  const hr = num(f.hr);
  const spo2 = num(f.spo2);
  const rr = num(f.rr);
  const temp = num(f.temp);
  if (Number.isNaN(hr)) errors.hr = 'Heart rate is required';
  else if (hr < 20 || hr > 250) errors.hr = 'Enter a value between 20 and 250';
  if (Number.isNaN(spo2)) errors.spo2 = 'SpO₂ is required';
  else if (spo2 < 50 || spo2 > 100) errors.spo2 = 'Enter a value between 50 and 100';
  const bp = parseBp(f.bp);
  if (!f.bp.trim()) errors.bp = 'Blood pressure is required';
  else if (!bp) errors.bp = 'Use the format 120/80';
  else if (bp.sys < 50 || bp.sys > 260 || bp.dia < 20 || bp.dia > 160) errors.bp = 'Value out of plausible range';
  else if (bp.sys <= bp.dia) errors.bp = 'Systolic must be higher than diastolic';
  if (Number.isNaN(rr)) errors.rr = 'Respiratory rate is required';
  else if (rr < 4 || rr > 60) errors.rr = 'Enter a value between 4 and 60';
  if (Number.isNaN(temp)) errors.temp = 'Temperature is required';
  else if (temp < 30 || temp > 43) errors.temp = 'Enter a value between 30 and 43';
  const t = new Date(f.time).getTime();
  if (!f.time || Number.isNaN(t)) errors.time = 'Measurement time is required';
  else if (t > Date.now() + 5 * 60_000) errors.time = 'Measurement time cannot be in the future';
  if (Object.keys(errors).length || !bp) return { errors, reading: null };
  return {
    errors,
    reading: {
      t,
      hr: Math.round(hr),
      spo2: Math.round(spo2),
      sys: bp.sys,
      dia: bp.dia,
      rr: Math.round(rr),
      temp: Math.round(temp * 10) / 10,
      ...(f.o2 ? { o2: true } : {}),
      avpu: f.avpu,
    },
  };
}

function ScoreChip({ k, value }: { k: VitalKey; value: string }) {
  let v = Number.NaN;
  if (k === 'sys') v = parseBp(value)?.sys ?? Number.NaN;
  else v = num(value);
  if (Number.isNaN(v)) return null;
  const s = vitalScore(k, v);
  if (s === 0) return null;
  return (
    <span
      className={cn(
        'ml-1.5 rounded px-1.5 py-px align-middle text-[10px] font-bold',
        s >= 3 ? 'bg-red-100 text-red-700' : s === 2 ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700',
      )}
      title="NEWS2 sub-score"
    >
      NEWS2 +{s}
    </span>
  );
}

export function VitalsFields({
  form,
  errors,
  onChange,
  showTime = true,
  placeholders,
  idPrefix = 'v',
}: {
  form: VitalsForm;
  errors: VitalsErrors;
  onChange: (patch: Partial<VitalsForm>) => void;
  showTime?: boolean;
  placeholders?: Partial<Record<'hr' | 'spo2' | 'bp' | 'rr' | 'temp', string>>;
  idPrefix?: string;
}) {
  const id = (s: string) => `${idPrefix}-${s}`;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label={<>Heart Rate (bpm)<ScoreChip k="hr" value={form.hr} /></>} htmlFor={id('hr')} error={errors.hr} required>
        <Input id={id('hr')} type="number" inputMode="numeric" placeholder={placeholders?.hr ?? 'e.g. 88'} value={form.hr} onChange={(e) => onChange({ hr: e.target.value })} invalid={!!errors.hr} />
      </Field>
      <Field label={<>SpO₂ (%)<ScoreChip k="spo2" value={form.spo2} /></>} htmlFor={id('spo2')} error={errors.spo2} required>
        <Input id={id('spo2')} type="number" inputMode="numeric" placeholder={placeholders?.spo2 ?? 'e.g. 95'} value={form.spo2} onChange={(e) => onChange({ spo2: e.target.value })} invalid={!!errors.spo2} />
      </Field>
      <Field label={<>Blood Pressure (mmHg)<ScoreChip k="sys" value={form.bp} /></>} htmlFor={id('bp')} error={errors.bp} required>
        <Input id={id('bp')} type="text" inputMode="text" placeholder={placeholders?.bp ?? '120/80'} value={form.bp} onChange={(e) => onChange({ bp: e.target.value })} invalid={!!errors.bp} />
      </Field>
      <Field label={<>Respiratory Rate (breaths/min)<ScoreChip k="rr" value={form.rr} /></>} htmlFor={id('rr')} error={errors.rr} required>
        <Input id={id('rr')} type="number" inputMode="numeric" placeholder={placeholders?.rr ?? 'e.g. 18'} value={form.rr} onChange={(e) => onChange({ rr: e.target.value })} invalid={!!errors.rr} />
      </Field>
      <Field label={<>Temperature (°C)<ScoreChip k="temp" value={form.temp} /></>} htmlFor={id('temp')} error={errors.temp} required>
        <Input id={id('temp')} type="number" step="0.1" inputMode="decimal" placeholder={placeholders?.temp ?? 'e.g. 36.8'} value={form.temp} onChange={(e) => onChange({ temp: e.target.value })} invalid={!!errors.temp} />
      </Field>
      {showTime && (
        <Field label="Measurement Time" htmlFor={id('time')} error={errors.time} required>
          <Input id={id('time')} type="datetime-local" value={form.time} onChange={(e) => onChange({ time: e.target.value })} invalid={!!errors.time} />
        </Field>
      )}
      <Field label="Consciousness (ACVPU)" htmlFor={id('avpu')}>
        <Select id={id('avpu')} value={form.avpu} onChange={(e) => onChange({ avpu: e.target.value as Consciousness })}>
          {AVPU_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Oxygen therapy">
        <label className="flex h-10 cursor-pointer items-center gap-2.5 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50">
          <input type="checkbox" checked={form.o2} onChange={(e) => onChange({ o2: e.target.checked })} className="h-4 w-4 accent-blue-600" />
          On supplemental oxygen
        </label>
      </Field>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Labs                                                                */
/* ------------------------------------------------------------------ */

export type LabsForm = Record<LabKey, string>;

export function emptyLabs(): LabsForm {
  return { wbc: '', hb: '', plt: '', creat: '', lactate: '', crp: '', na: '', k: '' };
}

export function parseLabs(f: LabsForm): { errors: Partial<Record<LabKey, string>>; values: Partial<Record<LabKey, number>>; count: number } {
  const errors: Partial<Record<LabKey, string>> = {};
  const values: Partial<Record<LabKey, number>> = {};
  for (const k of LAB_KEYS) {
    const raw = f[k].trim();
    if (!raw) continue;
    const v = Number(raw);
    const m = LAB_META[k];
    if (Number.isNaN(v) || v < m.min || v > m.max) errors[k] = `Enter ${m.min}–${m.max}`;
    else values[k] = Number(v.toFixed(m.decimals));
  }
  return { errors, values, count: Object.keys(values).length };
}

export function LabFields({ form, errors, onChange, idPrefix = 'lab' }: { form: LabsForm; errors: Partial<Record<LabKey, string>>; onChange: (k: LabKey, v: string) => void; idPrefix?: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {LAB_KEYS.map((k) => {
        const m = LAB_META[k];
        const v = num(form[k]);
        const flag = !Number.isNaN(v) ? (v > m.high ? 'H' : v < m.low ? 'L' : null) : null;
        return (
          <Field
            key={k}
            label={
              <>
                {m.label} <span className="font-normal text-slate-400">({m.unit})</span>
                {flag && <span className={cn('ml-1.5 rounded px-1.5 py-px text-[10px] font-bold', flag === 'H' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700')}>{flag}</span>}
              </>
            }
            htmlFor={`${idPrefix}-${k}`}
            error={errors[k]}
            hint={`Reference ${m.low}–${m.high}`}
          >
            <Input id={`${idPrefix}-${k}`} type="number" step="any" inputMode="decimal" placeholder="—" value={form[k]} onChange={(e) => onChange(k, e.target.value)} invalid={!!errors[k]} />
          </Field>
        );
      })}
    </div>
  );
}
