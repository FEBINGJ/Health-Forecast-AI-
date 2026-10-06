export type Gender = 'Male' | 'Female' | 'Other';
export type RiskLevel = 'Low' | 'Moderate' | 'High';
export type Consciousness = 'Alert' | 'New confusion' | 'Voice' | 'Pain' | 'Unresponsive';

export interface VitalReading {
  t: number;
  hr: number;
  spo2: number;
  sys: number;
  dia: number;
  rr: number;
  temp: number;
  o2?: boolean;
  avpu?: Consciousness;
  source?: 'Manual' | 'Monitor' | 'Admission';
  by?: string;
}

export type LabKey = 'wbc' | 'hb' | 'plt' | 'creat' | 'lactate' | 'crp' | 'na' | 'k';

export interface LabPanel {
  t: number;
  values: Partial<Record<LabKey, number>>;
}

export type NoteType = 'Progress' | 'Nursing' | 'Plan' | 'Handover';

export interface Note {
  id: string;
  t: number;
  author: string;
  type: NoteType;
  text: string;
}

export interface Patient {
  id: string;
  name: string;
  dob: string;
  gender: Gender;
  ward: string;
  bed: string;
  admittedAt: number;
  diagnosis: string;
  comorbidities: string[];
  priorAdmissions: number;
  icuStay: boolean;
  attending: string;
  vitals: VitalReading[];
  labs: LabPanel[];
  notes: Note[];
  createdAt: number;
}

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertKind =
  | 'det-high'
  | 'det-moderate'
  | 'readm-high'
  | 'spo2'
  | 'hr-high'
  | 'hr-low'
  | 'sbp-low'
  | 'rr-high'
  | 'temp-high'
  | 'temp-low';

export interface ClinicalAlert {
  id: string;
  patientId: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  detail: string;
  t: number;
  acknowledged: boolean;
  ackBy?: string;
  ackAt?: number;
}

export interface Thresholds {
  moderate: number;
  high: number;
}

export interface AlertPrefs {
  vitals: boolean;
  risk: boolean;
  toasts: boolean;
}

export interface Settings {
  thresholds: Thresholds;
  alerts: AlertPrefs;
  pageSize: number;
}

export interface UserProfile {
  username: string;
  displayName: string;
  fullName: string;
  role: string;
  department: string;
  email: string;
}

export interface AppState {
  version: number;
  authenticated: boolean;
  profile: UserProfile;
  patients: Patient[];
  alerts: ClinicalAlert[];
  settings: Settings;
  seededAt: number;
}

export type ContributionGroup = 'vitals' | 'trend' | 'labs' | 'history' | 'demographic';

export interface Contribution {
  key: string;
  label: string;
  detail: string;
  value: number;
  group: ContributionGroup;
}

export interface RiskResult {
  probability: number;
  percent: number;
  level: RiskLevel;
  logit: number;
  intercept: number;
  contributions: Contribution[];
}

export interface News2Part {
  key: string;
  label: string;
  value: string;
  score: number;
}

export interface News2Result {
  total: number;
  parts: News2Part[];
  band: 'Low' | 'Low–Medium' | 'Medium' | 'High';
}

export interface Factor {
  key: string;
  text: string;
  detail: string;
  severity: 'high' | 'medium';
  model: 'Deterioration' | 'Readmission';
}

export interface Prediction {
  t: number;
  news2: News2Result;
  deterioration: RiskResult;
  readmission: RiskResult;
  factors: Factor[];
}
