import type {
  AlertKind,
  AlertPrefs,
  AlertSeverity,
  ClinicalAlert,
  Contribution,
  Factor,
  LabKey,
  LabPanel,
  News2Part,
  News2Result,
  Patient,
  Prediction,
  RiskLevel,
  RiskResult,
  Thresholds,
  VitalReading,
} from '../types';
import { HOUR, ageAt } from './format';

/* ------------------------------------------------------------------ */
/* Reference data                                                      */
/* ------------------------------------------------------------------ */

export interface LabMeta {
  label: string;
  short: string;
  unit: string;
  low: number;
  high: number;
  decimals: number;
  min: number;
  max: number;
}

export const LAB_META: Record<LabKey, LabMeta> = {
  wbc: { label: 'White Blood Cells', short: 'WBC', unit: '×10⁹/L', low: 4.0, high: 11.0, decimals: 1, min: 0.1, max: 100 },
  hb: { label: 'Haemoglobin', short: 'Hb', unit: 'g/dL', low: 12.0, high: 17.0, decimals: 1, min: 2, max: 25 },
  plt: { label: 'Platelets', short: 'PLT', unit: '×10⁹/L', low: 150, high: 400, decimals: 0, min: 1, max: 2000 },
  creat: { label: 'Creatinine', short: 'Creat', unit: 'mg/dL', low: 0.6, high: 1.2, decimals: 2, min: 0.1, max: 20 },
  lactate: { label: 'Lactate', short: 'Lactate', unit: 'mmol/L', low: 0.5, high: 2.0, decimals: 1, min: 0.1, max: 30 },
  crp: { label: 'C-Reactive Protein', short: 'CRP', unit: 'mg/L', low: 0, high: 10, decimals: 0, min: 0, max: 600 },
  na: { label: 'Sodium', short: 'Na⁺', unit: 'mmol/L', low: 135, high: 145, decimals: 0, min: 100, max: 190 },
  k: { label: 'Potassium', short: 'K⁺', unit: 'mmol/L', low: 3.5, high: 5.1, decimals: 1, min: 1, max: 10 },
};

export const LAB_KEYS: LabKey[] = ['wbc', 'hb', 'plt', 'creat', 'lactate', 'crp', 'na', 'k'];

export function labFlag(key: LabKey, value: number): 'H' | 'L' | null {
  const m = LAB_META[key];
  if (value > m.high) return 'H';
  if (value < m.low) return 'L';
  return null;
}

export function fmtLab(key: LabKey, value: number): string {
  return value.toFixed(LAB_META[key].decimals);
}

export const COMORBIDITY_OPTIONS = [
  'Hypertension',
  'Type 2 Diabetes',
  'COPD',
  'Heart Failure',
  'Chronic Kidney Disease',
  'Coronary Artery Disease',
  'Atrial Fibrillation',
  'Asthma',
  'Previous Stroke',
  'Cancer',
  'Obesity',
  'Hyperlipidaemia',
];

const MAJOR_COMORBIDITIES = ['Heart Failure', 'COPD', 'Chronic Kidney Disease'];

export const MODEL_INFO = {
  name: 'CRPS Risk Engine',
  version: '2.3 (demo)',
  deteriorationHorizon: 'next 24 hours',
  readmissionHorizon: '30 days after ICU / ward discharge',
};

export const DET_INTERCEPT = -3.0;
export const READM_INTERCEPT = -3.2;

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/* ------------------------------------------------------------------ */
/* NEWS2                                                               */
/* ------------------------------------------------------------------ */

export type VitalKey = 'hr' | 'spo2' | 'sys' | 'rr' | 'temp';

export function vitalScore(key: VitalKey, x: number): number {
  switch (key) {
    case 'rr':
      return x <= 8 ? 3 : x <= 11 ? 1 : x <= 20 ? 0 : x <= 24 ? 2 : 3;
    case 'spo2':
      return x <= 91 ? 3 : x <= 93 ? 2 : x <= 95 ? 1 : 0;
    case 'sys':
      return x <= 90 ? 3 : x <= 100 ? 2 : x <= 110 ? 1 : x <= 219 ? 0 : 3;
    case 'hr':
      return x <= 40 ? 3 : x <= 50 ? 1 : x <= 90 ? 0 : x <= 110 ? 1 : x <= 130 ? 2 : 3;
    case 'temp':
      return x <= 35.0 ? 3 : x <= 36.0 ? 1 : x <= 38.0 ? 0 : x <= 39.0 ? 1 : 2;
  }
}

export function computeNews2(v: VitalReading): News2Result {
  const avpuScore = !v.avpu || v.avpu === 'Alert' ? 0 : 3;
  const parts: News2Part[] = [
    { key: 'rr', label: 'Respiration rate', value: `${v.rr} /min`, score: vitalScore('rr', v.rr) },
    { key: 'spo2', label: 'SpO₂ (scale 1)', value: `${v.spo2}%`, score: vitalScore('spo2', v.spo2) },
    { key: 'o2', label: 'Air or oxygen', value: v.o2 ? 'Oxygen' : 'Air', score: v.o2 ? 2 : 0 },
    { key: 'sys', label: 'Systolic BP', value: `${v.sys} mmHg`, score: vitalScore('sys', v.sys) },
    { key: 'hr', label: 'Pulse', value: `${v.hr} bpm`, score: vitalScore('hr', v.hr) },
    { key: 'avpu', label: 'Consciousness', value: v.avpu ?? 'Alert', score: avpuScore },
    { key: 'temp', label: 'Temperature', value: `${v.temp.toFixed(1)} °C`, score: vitalScore('temp', v.temp) },
  ];
  const total = parts.reduce((s, p) => s + p.score, 0);
  const band: News2Result['band'] =
    total >= 7 ? 'High' : total >= 5 ? 'Medium' : parts.some((p) => p.score === 3) ? 'Low–Medium' : 'Low';
  return { total, parts, band };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function baselineIndex(vitals: VitalReading[], idx: number): number {
  const cur = vitals[idx];
  const from = cur.t - 12 * HOUR - 60_000;
  for (let i = 0; i < idx; i++) {
    if (vitals[i].t >= from) {
      return cur.t - vitals[i].t >= 2 * HOUR ? i : -1;
    }
  }
  return -1;
}

export function labValuesAt(labs: LabPanel[], t: number): Partial<Record<LabKey, number>> {
  const out: Partial<Record<LabKey, number>> = {};
  for (const p of labs) {
    if (p.t <= t) {
      for (const k of LAB_KEYS) {
        const v = p.values[k];
        if (typeof v === 'number' && !Number.isNaN(v)) out[k] = v;
      }
    }
  }
  return out;
}

function scaleTo(list: Contribution[], cap: number) {
  const sum = list.reduce((s, c) => s + c.value, 0);
  if (sum > cap) {
    const k = cap / sum;
    list.forEach((c) => (c.value *= k));
  }
}

export function levelFor(percent: number, th: Thresholds): RiskLevel {
  return percent >= th.high ? 'High' : percent >= th.moderate ? 'Moderate' : 'Low';
}

function finalize(intercept: number, contributions: Contribution[], th: Thresholds): RiskResult {
  const logit = intercept + contributions.reduce((s, c) => s + c.value, 0);
  const probability = sigmoid(logit);
  const percent = Math.round(probability * 100);
  return { probability, percent, level: levelFor(percent, th), logit, intercept, contributions };
}

/** Approximate change in risk (percentage points) attributable to a single contribution. */
export function contributionImpact(r: RiskResult, c: Contribution): number {
  return Math.round((r.probability - sigmoid(r.logit - c.value)) * 100);
}

/* ------------------------------------------------------------------ */
/* Deterioration model                                                 */
/* ------------------------------------------------------------------ */

function detContributions(
  v: VitalReading,
  base: VitalReading | null,
  labs: Partial<Record<LabKey, number>>,
  age: number,
  news: ReturnType<typeof computeNews2>,
): Contribution[] {
  const out: Contribution[] = [
    {
      key: 'news2',
      group: 'vitals',
      label: 'NEWS2 early warning score',
      detail: `Score ${news.total} (${news.band} clinical risk)`,
      value: 0.32 * Math.min(news.total, 14),
    },
  ];

  const trend: Contribution[] = [];
  if (base) {
    const hrRise = v.hr - base.hr;
    if (hrRise >= 10)
      trend.push({
        key: 'hrTrend',
        group: 'trend',
        label: 'Increasing heart rate over the last 12 hours',
        detail: `${base.hr} → ${v.hr} bpm (+${hrRise})`,
        value: Math.min(0.45, 0.02 * hrRise),
      });
    const spo2Drop = base.spo2 - v.spo2;
    if (spo2Drop >= 2)
      trend.push({
        key: 'spo2Trend',
        group: 'trend',
        label: 'Decreasing SpO₂ levels',
        detail: `${base.spo2}% → ${v.spo2}%`,
        value: Math.min(0.5, 0.12 * spo2Drop),
      });
    const sysDrop = base.sys - v.sys;
    if (sysDrop >= 10)
      trend.push({
        key: 'bpTrend',
        group: 'trend',
        label: 'Falling blood pressure',
        detail: `Systolic ${base.sys} → ${v.sys} mmHg`,
        value: Math.min(0.4, 0.015 * sysDrop),
      });
    const rrRise = v.rr - base.rr;
    if (rrRise >= 4)
      trend.push({
        key: 'rrTrend',
        group: 'trend',
        label: 'Rising respiratory rate',
        detail: `${base.rr} → ${v.rr} breaths/min`,
        value: Math.min(0.3, 0.05 * rrRise),
      });
    const tRise = Math.round((v.temp - base.temp) * 10) / 10;
    if (tRise >= 0.8)
      trend.push({
        key: 'tempTrend',
        group: 'trend',
        label: 'Rising body temperature',
        detail: `${base.temp.toFixed(1)} → ${v.temp.toFixed(1)} °C`,
        value: 0.2,
      });
  }
  scaleTo(trend, 0.8);

  const lab: Contribution[] = [];
  if (labs.wbc != null) {
    if (labs.wbc > 11)
      lab.push({
        key: 'wbc',
        group: 'labs',
        label: 'Elevated white blood cell count',
        detail: `WBC ${fmtLab('wbc', labs.wbc)} ×10⁹/L`,
        value: Math.min(0.5, 0.25 + 0.04 * (labs.wbc - 11)),
      });
    else if (labs.wbc < 4)
      lab.push({
        key: 'wbcLow',
        group: 'labs',
        label: 'Low white blood cell count',
        detail: `WBC ${fmtLab('wbc', labs.wbc)} ×10⁹/L`,
        value: 0.3,
      });
  }
  if (labs.lactate != null && labs.lactate > 2)
    lab.push({
      key: 'lactate',
      group: 'labs',
      label: 'Raised serum lactate',
      detail: `Lactate ${fmtLab('lactate', labs.lactate)} mmol/L`,
      value: Math.min(0.8, 0.3 + 0.3 * (labs.lactate - 2)),
    });
  if (labs.crp != null && labs.crp > 50)
    lab.push({
      key: 'crp',
      group: 'labs',
      label: 'Elevated C-reactive protein',
      detail: `CRP ${fmtLab('crp', labs.crp)} mg/L`,
      value: labs.crp > 100 ? 0.3 : 0.15,
    });
  if (labs.creat != null && labs.creat > 1.5)
    lab.push({
      key: 'creat',
      group: 'labs',
      label: 'Impaired renal function',
      detail: `Creatinine ${fmtLab('creat', labs.creat)} mg/dL`,
      value: 0.2,
    });
  scaleTo(lab, 0.7);

  out.push(...trend, ...lab);
  out.push({ key: 'age', group: 'demographic', label: 'Age', detail: `${age} years`, value: 0.012 * (age - 60) });
  return out;
}

/* ------------------------------------------------------------------ */
/* ICU readmission model                                               */
/* ------------------------------------------------------------------ */

function readmContributions(
  p: Patient,
  labs: Partial<Record<LabKey, number>>,
  age: number,
  news: ReturnType<typeof computeNews2>,
  t: number,
): Contribution[] {
  const out: Contribution[] = [
    { key: 'age', group: 'demographic', label: 'Age', detail: `${age} years`, value: 0.025 * (age - 60) },
  ];
  const n = p.comorbidities.length;
  const nMajor = p.comorbidities.filter((c) => MAJOR_COMORBIDITIES.includes(c)).length;
  if (n > 0)
    out.push({
      key: 'comorbid',
      group: 'history',
      label: n > 1 ? 'Multiple comorbidities' : 'Comorbidity',
      detail: p.comorbidities.join(', '),
      value: Math.min(1.6, 0.3 * n + 0.2 * nMajor),
    });
  if (p.priorAdmissions > 0)
    out.push({
      key: 'prior',
      group: 'history',
      label: 'Prior hospital admissions',
      detail: `${p.priorAdmissions} in the past 12 months`,
      value: Math.min(1.35, 0.45 * p.priorAdmissions),
    });
  const los = (t - p.admittedAt) / (24 * HOUR);
  if (los > 7)
    out.push({
      key: 'los',
      group: 'history',
      label: 'Prolonged length of stay',
      detail: `${Math.floor(los)} days in hospital`,
      value: los > 14 ? 0.5 : 0.3,
    });
  if (p.icuStay)
    out.push({
      key: 'icu',
      group: 'history',
      label: 'ICU stay during this admission',
      detail: 'Stepped down from ICU / HDU',
      value: 0.4,
    });
  if (news.total > 0)
    out.push({
      key: 'instab',
      group: 'vitals',
      label: 'Physiological instability',
      detail: `NEWS2 ${news.total}`,
      value: Math.min(0.8, 0.08 * news.total),
    });
  const lab: Contribution[] = [];
  if (labs.hb != null && labs.hb < 10)
    lab.push({ key: 'anemia', group: 'labs', label: 'Anaemia', detail: `Hb ${fmtLab('hb', labs.hb)} g/dL`, value: 0.35 });
  if (labs.na != null && labs.na < 135)
    lab.push({ key: 'hypoNa', group: 'labs', label: 'Hyponatraemia', detail: `Na⁺ ${fmtLab('na', labs.na)} mmol/L`, value: 0.25 });
  if (labs.creat != null && labs.creat > 1.5)
    lab.push({
      key: 'renal',
      group: 'labs',
      label: 'Impaired renal function',
      detail: `Creatinine ${fmtLab('creat', labs.creat)} mg/dL`,
      value: 0.3,
    });
  scaleTo(lab, 0.8);
  out.push(...lab);
  return out;
}

/* ------------------------------------------------------------------ */
/* Explanations                                                        */
/* ------------------------------------------------------------------ */

const FACTOR_PRIORITY = ['hrTrend', 'spo2Trend', 'bpTrend', 'wbc', 'wbcLow', 'lactate', 'rrTrend', 'tempTrend', 'crp', 'creat'];

function buildFactors(det: RiskResult, readm: RiskResult, news: News2Result, v: VitalReading): Factor[] {
  const out: Factor[] = [];
  const dk = new Map(det.contributions.map((c) => [c.key, c]));
  for (const k of FACTOR_PRIORITY) {
    const c = dk.get(k);
    if (c && c.value > 0.001)
      out.push({ key: k, text: c.label, detail: c.detail, severity: c.value >= 0.15 ? 'high' : 'medium', model: 'Deterioration' });
  }
  const part = (k: string) => news.parts.find((p) => p.key === k)?.score ?? 0;
  const add = (key: string, text: string, detail: string, high: boolean) =>
    out.push({ key, text, detail, severity: high ? 'high' : 'medium', model: 'Deterioration' });
  if (part('spo2') >= 2 && !dk.has('spo2Trend')) add('lowSpo2', 'Low oxygen saturation', `SpO₂ ${v.spo2}%`, part('spo2') >= 3);
  if (part('rr') >= 2 && !dk.has('rrTrend'))
    add('rr', v.rr <= 8 ? 'Low respiratory rate' : 'Elevated respiratory rate', `${v.rr} breaths/min`, part('rr') >= 3);
  if (part('hr') >= 2 && !dk.has('hrTrend')) add('hr', v.hr <= 40 ? 'Bradycardia' : 'Tachycardia', `HR ${v.hr} bpm`, part('hr') >= 3);
  if (part('sys') >= 2 && !dk.has('bpTrend'))
    add('sys', v.sys >= 220 ? 'Severe hypertension' : 'Low systolic blood pressure', `${v.sys}/${v.dia} mmHg`, part('sys') >= 3);
  if (part('temp') >= 1 && !dk.has('tempTrend'))
    add('temp', v.temp <= 36 ? 'Low body temperature' : 'Fever', `${v.temp.toFixed(1)} °C`, part('temp') >= 2);
  if (v.o2) add('o2', 'Requires supplemental oxygen', 'On O₂ therapy', false);
  if (part('avpu') >= 3) add('avpu', 'Altered level of consciousness', v.avpu ?? '', true);

  if (readm.level !== 'Low') {
    const rk = new Map(readm.contributions.map((c) => [c.key, c]));
    for (const k of ['prior', 'comorbid', 'icu', 'los', 'anemia', 'hypoNa', 'renal']) {
      const c = rk.get(k);
      if (!c || c.value < 0.2) continue;
      if (k === 'renal' && dk.has('creat')) continue;
      out.push({
        key: `r-${k}`,
        text: c.label,
        detail: c.detail,
        severity: c.value >= 0.8 ? 'high' : 'medium',
        model: 'Readmission',
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Public prediction API                                               */
/* ------------------------------------------------------------------ */

export function predictAt(p: Patient, idx: number, th: Thresholds, allLabs = false): Prediction {
  const v = p.vitals[idx];
  const bi = baselineIndex(p.vitals, idx);
  const base = bi >= 0 ? p.vitals[bi] : null;
  const labs = labValuesAt(p.labs, allLabs ? Number.POSITIVE_INFINITY : v.t);
  const age = ageAt(p.dob, v.t);
  const news = computeNews2(v);
  const deterioration = finalize(DET_INTERCEPT, detContributions(v, base, labs, age, news), th);
  const readmission = finalize(READM_INTERCEPT, readmContributions(p, labs, age, news, v.t), th);
  return { t: v.t, news2: news, deterioration, readmission, factors: buildFactors(deterioration, readmission, news, v) };
}

export function predict(p: Patient, th: Thresholds): Prediction | null {
  if (!p.vitals.length) return null;
  return predictAt(p, p.vitals.length - 1, th, true);
}

export interface RiskPoint {
  t: number;
  det: number;
  readm: number;
  news2: number;
}

export function riskHistory(p: Patient, th: Thresholds): RiskPoint[] {
  return p.vitals.map((_, i) => {
    const r = predictAt(p, i, th, i === p.vitals.length - 1);
    return { t: r.t, det: r.deterioration.percent, readm: r.readmission.percent, news2: r.news2.total };
  });
}

/* ------------------------------------------------------------------ */
/* Alerts                                                              */
/* ------------------------------------------------------------------ */

function mkAlert(
  pid: string,
  t: number,
  kind: AlertKind,
  severity: AlertSeverity,
  title: string,
  detail: string,
  suffix = '',
): ClinicalAlert {
  return { id: `${pid}-${kind}-${t}${suffix}`, patientId: pid, kind, severity, title, detail, t, acknowledged: false };
}

export function riskTransitionAlerts(
  pid: string,
  t: number,
  prev: Prediction | null,
  cur: Prediction,
  suffix = '',
): ClinicalAlert[] {
  const out: ClinicalAlert[] = [];
  const d = cur.deterioration;
  const pd = prev?.deterioration;
  if (d.level === 'High' && pd?.level !== 'High') {
    out.push(
      mkAlert(
        pid,
        t,
        'det-high',
        'critical',
        'High deterioration risk detected',
        `Predicted risk ${d.percent}%${pd ? ` (was ${pd.percent}%)` : ''} · NEWS2 ${cur.news2.total}`,
        suffix,
      ),
    );
  } else if (d.level === 'Moderate' && pd?.level === 'Low') {
    out.push(
      mkAlert(pid, t, 'det-moderate', 'info', 'Deterioration risk increased to Moderate', `Predicted risk ${d.percent}% (was ${pd.percent}%)`, suffix),
    );
  }
  const r = cur.readmission;
  const pr = prev?.readmission;
  if (r.level === 'High' && pr?.level !== 'High') {
    out.push(
      mkAlert(pid, t, 'readm-high', 'warning', 'High ICU readmission risk', `Predicted risk ${r.percent}%${pr ? ` (was ${pr.percent}%)` : ''}`, suffix),
    );
  }
  return out;
}

export function evaluateAlerts(
  p: Patient,
  idx: number,
  prev: Prediction | null,
  cur: Prediction,
  prefs: AlertPrefs,
): ClinicalAlert[] {
  const v = p.vitals[idx];
  const pv = idx > 0 ? p.vitals[idx - 1] : null;
  const out: ClinicalAlert[] = [];
  const add = (kind: AlertKind, severity: AlertSeverity, title: string, detail: string) =>
    out.push(mkAlert(p.id, v.t, kind, severity, title, detail));
  if (prefs.vitals) {
    if (v.spo2 < 92 && !(pv && pv.spo2 < 92))
      add('spo2', 'warning', 'SpO₂ below 92%', `SpO₂ ${v.spo2}%${pv ? ` (previous ${pv.spo2}%)` : ''}`);
    if (v.hr > 120 && !(pv && pv.hr > 120))
      add('hr-high', 'warning', 'Heart rate above 120 bpm', `HR ${v.hr} bpm${pv ? ` (previous ${pv.hr} bpm)` : ''}`);
    if (v.hr < 45 && !(pv && pv.hr < 45)) add('hr-low', 'warning', 'Heart rate below 45 bpm', `HR ${v.hr} bpm`);
    if (v.sys < 90 && !(pv && pv.sys < 90)) add('sbp-low', 'critical', 'Systolic BP below 90 mmHg', `BP ${v.sys}/${v.dia} mmHg`);
    if (v.rr > 24 && !(pv && pv.rr > 24)) add('rr-high', 'warning', 'Respiratory rate above 24/min', `RR ${v.rr} breaths/min`);
    if (v.temp >= 38.5 && !(pv && pv.temp >= 38.5))
      add('temp-high', 'warning', 'Fever ≥ 38.5 °C', `Temperature ${v.temp.toFixed(1)} °C`);
    if (v.temp < 35.5 && !(pv && pv.temp < 35.5))
      add('temp-low', 'warning', 'Temperature below 35.5 °C', `Temperature ${v.temp.toFixed(1)} °C`);
  }
  if (prefs.risk) out.push(...riskTransitionAlerts(p.id, v.t, prev, cur));
  return out;
}

export function replayAlerts(p: Patient, th: Thresholds, prefs: AlertPrefs): ClinicalAlert[] {
  const out: ClinicalAlert[] = [];
  let prev: Prediction | null = null;
  for (let i = 0; i < p.vitals.length; i++) {
    const cur = predictAt(p, i, th, i === p.vitals.length - 1);
    out.push(...evaluateAlerts(p, i, prev, cur, prefs));
    prev = cur;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Simulated bedside-monitor reading                                   */
/* ------------------------------------------------------------------ */

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

export function simulateReading(p: Patient, pred: Prediction | null, t: number = Date.now()): VitalReading {
  const last = p.vitals[p.vitals.length - 1];
  const r = Math.random;
  const level = pred?.deterioration.level ?? 'Low';
  const severity = pred?.news2.total ?? 0;
  const pWorsen = level === 'High' ? (severity >= 11 ? 0.3 : severity >= 9 ? 0.5 : 0.62) : level === 'Moderate' ? 0.45 : 0.15;
  const worsen = r() < pWorsen;
  const j = (a: number) => (r() * 2 - 1) * a;
  let { hr, spo2, sys, dia, rr, temp } = last;
  if (worsen) {
    hr += 1 + r() * 4;
    spo2 -= r() < 0.5 ? 1 : 0;
    sys -= r() * 4;
    dia -= r() * 2;
    rr += r() < 0.5 ? 1 : 0;
    temp += r() * 0.15;
  } else {
    hr += (78 - hr) * 0.15 + j(2);
    spo2 += (97 - spo2) * 0.3 + j(0.6);
    sys += (122 - sys) * 0.15 + j(3);
    dia += (76 - dia) * 0.15 + j(2);
    rr += (16 - rr) * 0.2 + j(0.6);
    temp += (36.9 - temp) * 0.15 + j(0.08);
  }
  return {
    t: Math.max(t, last.t + 60_000),
    hr: clamp(Math.round(hr), 35, 180),
    spo2: clamp(Math.round(spo2), 75, 100),
    sys: clamp(Math.round(sys), 70, 210),
    dia: clamp(Math.round(dia), 35, 130),
    rr: clamp(Math.round(rr), 6, 40),
    temp: clamp(Math.round(temp * 10) / 10, 34, 41.5),
    o2: last.o2,
    avpu: last.avpu ?? 'Alert',
    source: 'Monitor',
  };
}
