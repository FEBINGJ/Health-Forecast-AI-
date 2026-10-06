import type {
  AlertPrefs,
  ClinicalAlert,
  Gender,
  LabKey,
  LabPanel,
  Note,
  NoteType,
  Patient,
  RiskLevel,
  Thresholds,
  VitalReading,
} from '../types';
import { DAY, HOUR, MIN, fmtDate } from './format';
import { COMORBIDITY_OPTIONS, LAB_KEYS, LAB_META, predict, replayAlerts } from './model';

type RNG = () => number;

function mulberry32(seed: number): RNG {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = (r: RNG, a: number, b: number) => a + (b - a) * r();
const rint = (r: RNG, a: number, b: number) => Math.floor(rnd(r, a, b + 1));
function pick<T>(r: RNG, arr: readonly T[]): T {
  return arr[Math.floor(r() * arr.length)];
}
function shuffle<T>(r: RNG, arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const round1 = (x: number) => Math.round(x * 10) / 10;
const pad2 = (n: number) => String(n).padStart(2, '0');
export const patientIdFor = (n: number) => `P${String(n).padStart(3, '0')}`;

/* ------------------------------------------------------------------ */
/* Builders                                                            */
/* ------------------------------------------------------------------ */

interface VSpec {
  hr: number;
  spo2: number;
  sys: number;
  dia: number;
  rr: number;
  temp: number;
}

interface SeriesOpts {
  t0: number;
  start: number;
  base: VSpec;
  final: VSpec;
  rampH: number;
  noise: number;
  rampNoise: number;
  o2Hours?: number;
  admission: boolean;
}

function buildVitals(r: RNG, o: SeriesOpts): VitalReading[] {
  const out: VitalReading[] = [];
  const steps = Math.max(0, Math.floor((o.t0 - o.start) / (2 * HOUR)));
  for (let k = steps; k >= 0; k--) {
    const t = o.t0 - k * 2 * HOUR;
    const hb = k * 2;
    const f = o.rampH > 0 && hb < o.rampH ? 1 - hb / o.rampH : 0;
    const amp = hb > o.rampH ? o.noise : k === 0 || hb === o.rampH ? 0 : o.rampNoise;
    const n = (a: number) => (r() * 2 - 1) * a * amp;
    const lerp = (a: number, b: number) => a + (b - a) * f;
    const v: VitalReading = {
      t,
      hr: Math.round(lerp(o.base.hr, o.final.hr) + n(3)),
      spo2: Math.min(100, Math.round(lerp(o.base.spo2, o.final.spo2) + n(1))),
      sys: Math.round(lerp(o.base.sys, o.final.sys) + n(5)),
      dia: Math.round(lerp(o.base.dia, o.final.dia) + n(3)),
      rr: Math.round(lerp(o.base.rr, o.final.rr) + n(1.2)),
      temp: round1(lerp(o.base.temp, o.final.temp) + n(0.15)),
      source: k === steps && o.admission ? 'Admission' : 'Monitor',
    };
    if (o.o2Hours && hb < o.o2Hours) v.o2 = true;
    out.push(v);
  }
  return out;
}

function dobFor(age: number, t0: number, offsetDays: number): string {
  const d = new Date(t0);
  d.setHours(12, 0, 0, 0);
  d.setFullYear(d.getFullYear() - age);
  d.setDate(d.getDate() - offsetDays);
  return fmtDate(d.getTime());
}

function roundLabs(v: Record<LabKey, number>): Partial<Record<LabKey, number>> {
  const out: Partial<Record<LabKey, number>> = {};
  for (const k of LAB_KEYS) out[k] = Number(v[k].toFixed(LAB_META[k].decimals));
  return out;
}

function buildLabs(r: RNG, times: number[], early: Record<LabKey, number>, late: Record<LabKey, number>): LabPanel[] {
  return times.map((t, i) => {
    const f = times.length === 1 ? 1 : i / (times.length - 1);
    const vals = {} as Record<LabKey, number>;
    for (const k of LAB_KEYS) {
      let v = early[k] + (late[k] - early[k]) * f;
      if (i !== times.length - 1) v *= 1 + (r() * 2 - 1) * 0.03;
      vals[k] = v;
    }
    return { t, values: roundLabs(vals) };
  });
}

function labTimes(r: RNG, t0: number, admittedAt: number): number[] {
  const out: number[] = [];
  let t = t0 - (2 + rint(r, 0, 3)) * HOUR;
  for (let i = 0; i < 3; i++) {
    if (t < admittedAt + HOUR) break;
    out.unshift(t);
    t -= DAY;
  }
  if (!out.length) out.push(Math.min(t0, admittedAt + HOUR));
  return out;
}

function normalLabs(r: RNG, gender: Gender): Record<LabKey, number> {
  return {
    wbc: rnd(r, 5.0, 9.6),
    hb: gender === 'Male' ? rnd(r, 13.2, 15.8) : rnd(r, 12.2, 14.6),
    plt: rint(r, 170, 360),
    creat: rnd(r, 0.7, 1.1),
    lactate: rnd(r, 0.7, 1.6),
    crp: rint(r, 2, 9),
    na: rint(r, 136, 143),
    k: rnd(r, 3.7, 4.8),
  };
}

let noteSeq = 0;
function note(t: number, author: string, type: NoteType, text: string): Note {
  noteSeq += 1;
  return { id: `n${noteSeq}-${t}`, t, author, type, text };
}

/* ------------------------------------------------------------------ */
/* Named patients from the prototype                                   */
/* ------------------------------------------------------------------ */

interface NamedSpec {
  id: string;
  name: string;
  gender: Gender;
  age: number;
  dobOffsetDays: number;
  ward: string;
  bed: string;
  admitH: number;
  diagnosis: string;
  comorbidities: string[];
  priorAdmissions: number;
  icuStay: boolean;
  attending: string;
  base: VSpec;
  final: VSpec;
  rampH: number;
  noise: number;
  rampNoise: number;
  labs: { h: number; v: Record<LabKey, number> }[];
  notes: { h: number; author: string; type: NoteType; text: string }[];
}

const NAMED: NamedSpec[] = [
  {
    id: 'P001',
    name: 'John Doe',
    gender: 'Male',
    age: 67,
    dobOffsetDays: 143,
    ward: 'Ward 3',
    bed: '3-12',
    admitH: 46,
    diagnosis: 'Community-acquired pneumonia',
    comorbidities: ['Hypertension', 'Type 2 Diabetes', 'COPD'],
    priorAdmissions: 2,
    icuStay: false,
    attending: 'Dr. Smith',
    base: { hr: 85, spo2: 97, sys: 124, dia: 78, rr: 16, temp: 37.1 },
    final: { hr: 108, spo2: 91, sys: 102, dia: 64, rr: 21, temp: 38.1 },
    rampH: 12,
    noise: 0.6,
    rampNoise: 0,
    labs: [
      { h: 45, v: { wbc: 9.6, hb: 13.6, plt: 248, creat: 1.0, lactate: 1.3, crp: 22, na: 139, k: 4.1 } },
      { h: 21, v: { wbc: 11.4, hb: 13.1, plt: 236, creat: 1.1, lactate: 1.6, crp: 41, na: 138, k: 4.3 } },
      { h: 2, v: { wbc: 13.8, hb: 12.8, plt: 221, creat: 1.2, lactate: 2.1, crp: 64, na: 137, k: 4.4 } },
    ],
    notes: [
      {
        h: 45.5,
        author: 'Dr. Alex Smith',
        type: 'Progress',
        text: 'Admitted with right lower lobe community-acquired pneumonia. Background COPD, type 2 diabetes and hypertension. Started IV co-amoxiclav and oral clarithromycin, 4-hourly observations.',
      },
      {
        h: 20,
        author: 'Nurse Mei Tan',
        type: 'Nursing',
        text: 'Comfortable overnight on room air. Productive cough, eating and drinking well.',
      },
      {
        h: 3,
        author: 'Nurse Daniel Lim',
        type: 'Nursing',
        text: 'Increased work of breathing and new tachycardia. SpO₂ trending down to 92%. Medical team informed, observations increased to 2-hourly.',
      },
      {
        h: 0.5,
        author: 'Dr. Alex Smith',
        type: 'Plan',
        text: 'AI model flags high deterioration risk. Repeat ABG, lactate and blood cultures; chest X-ray ordered. Start controlled O₂ (target 88–92%). Low threshold for HDU referral — review again in 1 hour.',
      },
    ],
  },
  {
    id: 'P002',
    name: 'Mary Tan',
    gender: 'Female',
    age: 54,
    dobOffsetDays: 61,
    ward: 'Ward 2',
    bed: '2-04',
    admitH: 70,
    diagnosis: 'Cellulitis (left lower leg)',
    comorbidities: ['Asthma'],
    priorAdmissions: 0,
    icuStay: false,
    attending: 'Dr. Smith',
    base: { hr: 94, spo2: 96, sys: 128, dia: 80, rr: 18, temp: 38.0 },
    final: { hr: 76, spo2: 98, sys: 122, dia: 78, rr: 16, temp: 36.8 },
    rampH: 60,
    noise: 0.5,
    rampNoise: 0.5,
    labs: [
      { h: 69, v: { wbc: 13.2, hb: 13.0, plt: 280, creat: 0.8, lactate: 1.4, crp: 96, na: 139, k: 4.0 } },
      { h: 45, v: { wbc: 11.1, hb: 12.9, plt: 274, creat: 0.8, lactate: 1.1, crp: 71, na: 140, k: 4.1 } },
      { h: 21, v: { wbc: 8.6, hb: 12.8, plt: 266, creat: 0.7, lactate: 0.9, crp: 38, na: 140, k: 4.0 } },
    ],
    notes: [
      {
        h: 69.5,
        author: 'Dr. Alex Smith',
        type: 'Progress',
        text: 'Left lower leg cellulitis with fever on arrival. Started IV flucloxacillin, leg elevation, borders marked.',
      },
      {
        h: 22,
        author: 'Dr. Alex Smith',
        type: 'Progress',
        text: 'Erythema receding within marked borders, afebrile for 24 h. Plan to switch to oral antibiotics tomorrow.',
      },
    ],
  },
  {
    id: 'P003',
    name: 'Ahmed Ali',
    gender: 'Male',
    age: 72,
    dobOffsetDays: 212,
    ward: 'Ward 5',
    bed: '5-02',
    admitH: 221,
    diagnosis: 'Heart failure exacerbation',
    comorbidities: ['Heart Failure', 'Chronic Kidney Disease', 'Type 2 Diabetes', 'Atrial Fibrillation'],
    priorAdmissions: 2,
    icuStay: false,
    attending: 'Dr. Smith',
    base: { hr: 90, spo2: 95, sys: 114, dia: 70, rr: 18, temp: 37.4 },
    final: { hr: 98, spo2: 93, sys: 108, dia: 68, rr: 21, temp: 37.6 },
    rampH: 12,
    noise: 0.6,
    rampNoise: 0,
    labs: [
      { h: 50, v: { wbc: 9.1, hb: 9.8, plt: 198, creat: 2.0, lactate: 1.5, crp: 22, na: 132, k: 5.0 } },
      { h: 26, v: { wbc: 9.4, hb: 9.6, plt: 192, creat: 1.9, lactate: 1.6, crp: 25, na: 133, k: 4.9 } },
      { h: 2, v: { wbc: 9.8, hb: 9.4, plt: 188, creat: 1.9, lactate: 1.7, crp: 28, na: 133, k: 4.8 } },
    ],
    notes: [
      {
        h: 220,
        author: 'Dr. Priya Patel',
        type: 'Progress',
        text: 'Decompensated heart failure with fluid overload (+4 kg). IV furosemide started. Background CKD stage 3b, AF and type 2 diabetes.',
      },
      {
        h: 26,
        author: 'Dr. Alex Smith',
        type: 'Progress',
        text: 'Diuresing well, weight down 3 kg. Creatinine stable around 1.9 mg/dL. Persistent anaemia (Hb 9.6) — iron studies sent.',
      },
      {
        h: 1.5,
        author: 'Nurse Siti Rahman',
        type: 'Nursing',
        text: 'More breathless this morning, RR 21, SpO₂ 93% on air. Bibasal crackles. Doctor informed.',
      },
      {
        h: 0.8,
        author: 'Dr. Alex Smith',
        type: 'Plan',
        text: 'High predicted ICU readmission risk — 2 admissions this year, CKD and anaemia. Arrange heart-failure nurse follow-up and early outpatient review before discharge.',
      },
    ],
  },
  {
    id: 'P004',
    name: 'Lisa Wong',
    gender: 'Female',
    age: 49,
    dobOffsetDays: 97,
    ward: 'Ward 1',
    bed: '1-08',
    admitH: 22,
    diagnosis: 'Post-op laparoscopic cholecystectomy',
    comorbidities: [],
    priorAdmissions: 0,
    icuStay: false,
    attending: 'Dr. Smith',
    base: { hr: 84, spo2: 97, sys: 118, dia: 74, rr: 15, temp: 37.0 },
    final: { hr: 80, spo2: 98, sys: 120, dia: 76, rr: 15, temp: 36.9 },
    rampH: 12,
    noise: 0.8,
    rampNoise: 0.4,
    labs: [
      { h: 21, v: { wbc: 9.8, hb: 12.9, plt: 232, creat: 0.7, lactate: 1.1, crp: 14, na: 140, k: 4.0 } },
      { h: 3, v: { wbc: 8.4, hb: 12.6, plt: 228, creat: 0.7, lactate: 0.9, crp: 22, na: 139, k: 3.9 } },
    ],
    notes: [
      {
        h: 21.5,
        author: 'Dr. Kenneth Chen',
        type: 'Progress',
        text: 'Uncomplicated laparoscopic cholecystectomy. Pain well controlled, tolerating fluids.',
      },
      {
        h: 4,
        author: 'Nurse Mei Tan',
        type: 'Nursing',
        text: 'Mobilising independently, wounds clean and dry. Likely discharge this afternoon.',
      },
    ],
  },
  {
    id: 'P005',
    name: 'Raj Kumar',
    gender: 'Male',
    age: 66,
    dobOffsetDays: 34,
    ward: 'Ward 4',
    bed: '4-15',
    admitH: 26,
    diagnosis: 'Urosepsis',
    comorbidities: ['Hypertension', 'Coronary Artery Disease'],
    priorAdmissions: 2,
    icuStay: false,
    attending: 'Dr. Smith',
    base: { hr: 92, spo2: 96, sys: 118, dia: 72, rr: 17, temp: 37.4 },
    final: { hr: 118, spo2: 93, sys: 96, dia: 58, rr: 23, temp: 38.6 },
    rampH: 12,
    noise: 0.6,
    rampNoise: 0,
    labs: [
      { h: 25, v: { wbc: 11.8, hb: 12.4, plt: 210, creat: 1.1, lactate: 1.4, crp: 48, na: 136, k: 4.2 } },
      { h: 4, v: { wbc: 16.1, hb: 11.6, plt: 176, creat: 1.4, lactate: 2.8, crp: 142, na: 134, k: 4.0 } },
    ],
    notes: [
      {
        h: 25.5,
        author: 'Dr. Alex Smith',
        type: 'Progress',
        text: 'Urosepsis — fever, dysuria and rigors. Blood and urine cultures sent, IV piperacillin–tazobactam started. Background hypertension and coronary artery disease.',
      },
      {
        h: 5,
        author: 'Nurse Daniel Lim',
        type: 'Nursing',
        text: 'Febrile 38.4 °C, HR 110s, BP softening to 103/62. Fluid bolus given as per protocol.',
      },
      {
        h: 3.5,
        author: 'Dr. Alex Smith',
        type: 'Plan',
        text: 'Sepsis pathway activated. Lactate 2.8 — second fluid bolus, repeat lactate in 2 h. Escalate to ICU outreach if MAP < 65.',
      },
    ],
  },
];

function buildNamed(r: RNG, s: NamedSpec, t0: number, seededAt: number): Patient {
  const admittedAt = t0 - s.admitH * HOUR - 20 * MIN;
  const start = Math.max(admittedAt, t0 - 72 * HOUR);
  return {
    id: s.id,
    name: s.name,
    dob: dobFor(s.age, t0, s.dobOffsetDays),
    gender: s.gender,
    ward: s.ward,
    bed: s.bed,
    admittedAt,
    diagnosis: s.diagnosis,
    comorbidities: s.comorbidities,
    priorAdmissions: s.priorAdmissions,
    icuStay: s.icuStay,
    attending: s.attending,
    vitals: buildVitals(r, {
      t0,
      start,
      base: s.base,
      final: s.final,
      rampH: s.rampH,
      noise: s.noise,
      rampNoise: s.rampNoise,
      admission: start === admittedAt,
    }),
    labs: s.labs.map((l) => ({ t: t0 - l.h * HOUR, values: roundLabs(l.v) })),
    notes: s.notes.map((n) => note(t0 - n.h * HOUR, n.author, n.type, n.text)).sort((a, b) => b.t - a.t),
    createdAt: seededAt,
  };
}

/* ------------------------------------------------------------------ */
/* Generated cohort                                                    */
/* ------------------------------------------------------------------ */

const MALE = ['James', 'Michael', 'David', 'Daniel', 'Wei Ming', 'Jun Jie', 'Arjun', 'Hafiz', 'Faizal', 'Muhammad', 'Thomas', 'Benjamin', 'Ethan', 'Ravi', 'Suresh', 'Kenneth', 'Eric', 'Marcus', 'Jason', 'Vincent', 'Ismail', 'Leon', 'Samuel', 'Henry', 'Patrick', 'Gabriel', 'Hao', 'Kevin', 'Aaron', 'Victor', 'Peter', 'Andrew', 'Joseph', 'Ryan', 'Adrian', 'Desmond', 'Alvin', 'Ivan', 'Omar', 'Bryan'];
const FEMALE = ['Emily', 'Grace', 'Siti', 'Nurul', 'Mei Ling', 'Hui Min', 'Priya', 'Anjali', 'Aisha', 'Farah', 'Olivia', 'Chloe', 'Hannah', 'Jessica', 'Rachel', 'Michelle', 'Angela', 'Catherine', 'Lakshmi', 'Deepa', 'Zara', 'Nadia', 'Sophia', 'Isabella', 'Jasmine', 'Vanessa', 'Charlotte', 'Amelia', 'Kavya', 'Yasmin', 'Irene', 'Joanne', 'Wendy', 'Cheryl', 'Alicia', 'Fiona', 'Helen', 'Linda', 'Susan', 'Natalie'];
const LAST = ['Tan', 'Lim', 'Lee', 'Ng', 'Wong', 'Chan', 'Goh', 'Chua', 'Ong', 'Teo', 'Koh', 'Chen', 'Ho', 'Yeo', 'Sim', 'Low', 'Kumar', 'Singh', 'Pillai', 'Nair', 'Menon', 'Krishnan', 'Rahman', 'Ismail', 'Hassan', 'Abdullah', 'Ibrahim', 'Yusof', 'Smith', 'Brown', 'Taylor', 'Johnson', 'Williams', 'Martin', 'Clarke', 'Walker', 'Anderson', 'Fernandez', 'Santos', 'Garcia', 'Cruz', 'Reyes', 'Nguyen', 'Tran', 'Park', 'Kim'];

const MINOR = ['Hypertension', 'Type 2 Diabetes', 'Hyperlipidaemia', 'Asthma', 'Obesity'];
const OTHER = ['Coronary Artery Disease', 'Atrial Fibrillation', 'Previous Stroke', 'Cancer'];
const MAJOR = ['Heart Failure', 'COPD', 'Chronic Kidney Disease'];

const DX_HIGH = ['Community-acquired pneumonia', 'Urosepsis', 'Acute cholangitis', 'Aspiration pneumonia', 'Suspected anastomotic leak (post-op)', 'Cellulitis with sepsis', 'Hospital-acquired pneumonia'];
const DX_MOD = ['COPD exacerbation', 'Heart failure exacerbation', 'Pyelonephritis', 'Acute kidney injury', 'Upper GI bleed', 'Atrial fibrillation with RVR', 'Acute pancreatitis', 'Post-op bowel resection'];
const DX_LOW = ['Cellulitis', 'Post-op knee replacement', 'Post-op laparoscopic cholecystectomy', 'Chest pain – ACS ruled out', 'Syncope – observation', 'Diabetic foot ulcer', 'Asthma exacerbation (resolving)', 'Fall – minor head injury', 'Hip fracture (post-op)', 'Gastroenteritis', 'Hypoglycaemia (resolved)', 'Transient ischaemic attack', 'Renal colic', 'Deep vein thrombosis'];
const DX_READM = ['Heart failure exacerbation', 'COPD exacerbation', 'Acute kidney injury', 'Hospital-acquired pneumonia'];
const ATTENDINGS = ['Dr. Smith', 'Dr. Patel', 'Dr. Chen', 'Dr. Rahman', 'Dr. Okafor', 'Dr. Lim'];

const PLAN: Record<RiskLevel, string> = {
  High: 'IV antibiotics, fluid resuscitation and 2-hourly observations.',
  Moderate: 'Treat underlying cause, 4-hourly observations, repeat bloods in the morning.',
  Low: 'Routine observations, mobilise as tolerated, anticipate discharge in 24–48 h.',
};

function uniqueName(r: RNG, gender: Gender, used: Set<string>): string {
  for (let i = 0; i < 200; i++) {
    const n = `${pick(r, gender === 'Male' ? MALE : FEMALE)} ${pick(r, LAST)}`;
    if (!used.has(n)) {
      used.add(n);
      return n;
    }
  }
  return `Patient ${used.size + 1}`;
}

function genPatient(r: RNG, num: number, det: RiskLevel, readm: RiskLevel, t0: number, seededAt: number): Patient {
  const gender: Gender = r() < 0.5 ? 'Male' : 'Female';
  const age = readm === 'High' ? rint(r, 68, 90) : readm === 'Moderate' ? rint(r, 52, 86) : rint(r, 21, 68);
  const admitH = readm === 'High' ? rint(r, 110, 360) : readm === 'Moderate' ? rint(r, 26, 220) : rint(r, 14, 140);
  const admittedAt = t0 - admitH * HOUR - rint(r, 0, 50) * MIN;

  let com: string[] = [];
  if (readm === 'Low') {
    if (r() < 0.45) com = [pick(r, MINOR)];
  } else if (readm === 'Moderate') {
    com = shuffle(r, [...MINOR, ...OTHER]).slice(0, rint(r, 1, 3));
    if (r() < 0.35) com[0] = pick(r, MAJOR);
  } else {
    const nMaj = rint(r, 1, 2);
    const n = rint(r, 3, 5);
    com = [...shuffle(r, MAJOR).slice(0, nMaj), ...shuffle(r, [...MINOR, ...OTHER]).slice(0, n - nMaj)];
  }
  com = COMORBIDITY_OPTIONS.filter((c) => com.includes(c));
  const prior = readm === 'High' ? rint(r, 2, 4) : readm === 'Moderate' ? pick(r, [0, 1, 1, 2]) : 0;
  const icu = readm === 'High' ? r() < 0.45 : readm === 'Moderate' ? r() < 0.15 : false;

  const base: VSpec = {
    hr: rint(r, 62, 88),
    spo2: rint(r, 96, 99),
    sys: rint(r, 112, 138),
    dia: 0,
    rr: rint(r, 13, 17),
    temp: round1(rnd(r, 36.4, 37.2)),
  };
  const ratio = rnd(r, 0.58, 0.66);
  base.dia = Math.round(base.sys * ratio);
  let final: VSpec;
  let rampH: number;
  let o2Hours = 0;
  if (det === 'High') {
    final = {
      hr: base.hr + rint(r, 22, 36),
      spo2: base.spo2 - rint(r, 4, 7),
      sys: base.sys - rint(r, 16, 30),
      dia: 0,
      rr: base.rr + rint(r, 4, 8),
      temp: round1(base.temp + rnd(r, 0.8, 1.6)),
    };
    rampH = pick(r, [10, 12, 14]);
    if (r() < 0.35) o2Hours = 4;
  } else if (det === 'Moderate') {
    final = {
      hr: base.hr + rint(r, 8, 22),
      spo2: base.spo2 - rint(r, 1, 4),
      sys: base.sys - rint(r, 4, 16),
      dia: 0,
      rr: base.rr + rint(r, 2, 6),
      temp: round1(base.temp + rnd(r, 0.2, 1.0)),
    };
    rampH = pick(r, [8, 10, 12, 14]);
  } else {
    final = {
      hr: base.hr + rint(r, -4, 4),
      spo2: Math.min(99, base.spo2 + rint(r, -1, 1)),
      sys: base.sys + rint(r, -6, 6),
      dia: 0,
      rr: base.rr + rint(r, -1, 1),
      temp: round1(base.temp + rnd(r, -0.2, 0.2)),
    };
    rampH = 2;
  }
  final.dia = Math.round(final.sys * ratio);
  const start = Math.max(admittedAt, t0 - 72 * HOUR);
  const vitals = buildVitals(r, {
    t0,
    start,
    base,
    final,
    rampH,
    noise: 1,
    rampNoise: 0.5,
    o2Hours,
    admission: start === admittedAt,
  });

  const late = normalLabs(r, gender);
  if (det === 'Moderate') {
    const x = r();
    if (x < 0.35) late.wbc = rnd(r, 11.2, 13.2);
    else if (x < 0.6) late.crp = rint(r, 52, 95);
    else if (x < 0.75) late.creat = rnd(r, 1.55, 1.95);
  }
  if (readm === 'High') {
    late.hb = rnd(r, 8.6, 10.4);
    late.na = rint(r, 129, 135);
    if (r() < 0.6) late.creat = rnd(r, 1.55, 2.4);
  } else if (readm === 'Moderate') {
    const x = r();
    if (x < 0.3) late.hb = rnd(r, 9.4, 11.2);
    else if (x < 0.5) late.na = rint(r, 132, 136);
  }
  const early = {} as Record<LabKey, number>;
  for (const k of LAB_KEYS) early[k] = late[k] * rnd(r, 0.93, 1.07);
  if (det === 'High') {
    late.wbc = rnd(r, 12.8, 18);
    late.lactate = rnd(r, 2.2, 3.4);
    late.crp = rint(r, 60, 190);
    early.wbc = rnd(r, 8, 11);
    early.lactate = rnd(r, 1.0, 1.6);
    early.crp = rint(r, 10, 40);
  }
  const labs = buildLabs(r, labTimes(r, t0, admittedAt), early, late);

  let diagnosis = det === 'High' ? pick(r, DX_HIGH) : det === 'Moderate' ? pick(r, DX_MOD) : pick(r, DX_LOW);
  if (readm === 'High' && r() < 0.5) diagnosis = pick(r, DX_READM);
  const wardNum = rint(r, 1, 6);
  const attending = pick(r, ATTENDINGS);

  const notes: Note[] = [
    note(
      admittedAt + 40 * MIN,
      attending.replace('Dr. ', 'Dr. '),
      'Progress',
      `Admitted with ${diagnosis.charAt(0).toLowerCase() + diagnosis.slice(1)}. ${
        com.length ? `Background: ${com.join(', ')}.` : 'No significant past medical history.'
      } Plan: ${PLAN[det]}`,
    ),
  ];
  if (det === 'High') {
    notes.unshift(
      note(
        t0 - 90 * MIN,
        pick(r, ['Nurse Mei Tan', 'Nurse Daniel Lim', 'Nurse Siti Rahman']),
        'Nursing',
        'Escalated to medical team — heart rate rising and SpO₂ trending down. Observation frequency increased to hourly.',
      ),
    );
  }

  return {
    id: patientIdFor(num),
    name: '',
    dob: dobFor(age, t0, rint(r, 20, 340)),
    gender,
    ward: `Ward ${wardNum}`,
    bed: `${wardNum}-${pad2(rint(r, 1, 24))}`,
    admittedAt,
    diagnosis,
    comorbidities: com,
    priorAdmissions: prior,
    icuStay: icu,
    attending,
    vitals,
    labs,
    notes,
    createdAt: seededAt,
  };
}

function genAccepted(
  r: RNG,
  num: number,
  det: RiskLevel,
  readm: RiskLevel,
  t0: number,
  seededAt: number,
  th: Thresholds,
): Patient {
  let fallback: Patient | null = null;
  for (let attempt = 0; attempt < 400; attempt++) {
    const p = genPatient(r, num, det, readm, t0, seededAt);
    const pred = predict(p, th);
    if (!pred) continue;
    const d = pred.deterioration.level;
    const rl = pred.readmission.level;
    if (d === det && rl === readm) return p;
    if (!fallback && (d === 'High') === (det === 'High') && (rl === 'High') === (readm === 'High')) fallback = p;
  }
  return fallback ?? genPatient(r, num, 'Low', 'Low', t0, seededAt);
}

/* ------------------------------------------------------------------ */
/* Public entry                                                        */
/* ------------------------------------------------------------------ */

export interface SeedResult {
  patients: Patient[];
  alerts: ClinicalAlert[];
  seededAt: number;
}

export function generateSeedData(th: Thresholds, prefs: AlertPrefs, now: number = Date.now()): SeedResult {
  noteSeq = 0;
  const r = mulberry32(20240115);
  const t0 = Math.floor(now / HOUR) * HOUR;
  const seededAt = now;

  const patients: Patient[] = NAMED.map((s) => buildNamed(r, s, t0, seededAt));
  const used = new Set<string>([...NAMED.map((s) => s.name), 'Sarah Lee']);

  const rep = (d: RiskLevel, rl: RiskLevel, n: number) => Array.from({ length: n }, () => [d, rl] as [RiskLevel, RiskLevel]);
  const targets = shuffle(r, [
    ...rep('High', 'High', 2),
    ...rep('High', 'Moderate', 2),
    ...rep('High', 'Low', 2),
    ...rep('Moderate', 'High', 2),
    ...rep('Low', 'High', 1),
    ...rep('Low', 'Low', 62),
    ...rep('Low', 'Moderate', 18),
    ...rep('Moderate', 'Low', 16),
    ...rep('Moderate', 'Moderate', 10),
  ]);

  targets.forEach(([d, rl], i) => {
    const p = genAccepted(r, 6 + i, d, rl, t0, seededAt, th);
    p.name = uniqueName(r, p.gender, used);
    patients.push(p);
  });

  const alerts: ClinicalAlert[] = [];
  for (const p of patients) {
    for (const a of replayAlerts(p, th, prefs)) {
      if (now - a.t > 12 * HOUR) {
        a.acknowledged = true;
        a.ackBy = 'Dr. Rahman (night shift)';
        a.ackAt = a.t + rint(r, 10, 80) * MIN;
      }
      alerts.push(a);
    }
  }
  alerts.sort((a, b) => b.t - a.t);
  return { patients, alerts, seededAt };
}
