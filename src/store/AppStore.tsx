import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import type { AppState, LabPanel, Note, Patient, Prediction, Settings, UserProfile, VitalReading } from '../types';
import { evaluateAlerts, predict, predictAt, replayAlerts, riskTransitionAlerts } from '../lib/model';
import { generateSeedData, patientIdFor, type SeedResult } from '../lib/seed';

const STORAGE_KEY = 'crps-state-v1';
const VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  thresholds: { moderate: 30, high: 60 },
  alerts: { vitals: true, risk: true, toasts: true },
  pageSize: 10,
};

export const DEFAULT_PROFILE: UserProfile = {
  username: 'dr.smith',
  displayName: 'Dr. Smith',
  fullName: 'Dr. Alex Smith',
  role: 'Attending Physician',
  department: 'Internal Medicine',
  email: 'alex.smith@citygeneral.org',
};

export const DEMO_CREDENTIALS = { username: 'dr.smith', password: 'password' };

export function createSeed(): SeedResult {
  return generateSeedData(DEFAULT_SETTINGS.thresholds, DEFAULT_SETTINGS.alerts);
}

function stateFromSeed(seed: SeedResult, base?: Partial<AppState>): AppState {
  return {
    version: VERSION,
    authenticated: base?.authenticated ?? false,
    profile: base?.profile ?? DEFAULT_PROFILE,
    settings: base?.settings ?? DEFAULT_SETTINGS,
    patients: seed.patients,
    alerts: seed.alerts,
    seededAt: seed.seededAt,
  };
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as AppState;
      if (s && s.version === VERSION && Array.isArray(s.patients) && Array.isArray(s.alerts)) {
        return {
          ...s,
          profile: { ...DEFAULT_PROFILE, ...s.profile },
          settings: {
            ...DEFAULT_SETTINGS,
            ...s.settings,
            thresholds: { ...DEFAULT_SETTINGS.thresholds, ...s.settings?.thresholds },
            alerts: { ...DEFAULT_SETTINGS.alerts, ...s.settings?.alerts },
          },
        };
      }
    }
  } catch {
    /* corrupted storage — fall through to a fresh seed */
  }
  return stateFromSeed(createSeed());
}

export type Action =
  | { type: 'LOGIN' }
  | { type: 'LOGOUT' }
  | { type: 'ADD_PATIENT'; patient: Patient }
  | { type: 'ADD_VITALS'; patientId: string; reading: VitalReading }
  | { type: 'ADD_LABS'; patientId: string; panel: LabPanel }
  | { type: 'ADD_NOTE'; patientId: string; note: Note }
  | { type: 'DELETE_NOTE'; patientId: string; noteId: string }
  | { type: 'ACK_ALERT'; id: string; at: number }
  | { type: 'ACK_ALL'; at: number; patientId?: string; ids?: string[] }
  | { type: 'UPDATE_PROFILE'; profile: Partial<UserProfile> }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<Settings> }
  | { type: 'RESET_DATA'; seed: SeedResult };

function reducer(state: AppState, action: Action): AppState {
  const th = state.settings.thresholds;
  switch (action.type) {
    case 'LOGIN':
      return { ...state, authenticated: true };
    case 'LOGOUT':
      return { ...state, authenticated: false };
    case 'ADD_PATIENT': {
      const p = action.patient;
      if (state.patients.some((x) => x.id === p.id)) return state;
      const alerts = replayAlerts(p, th, state.settings.alerts);
      return { ...state, patients: [p, ...state.patients], alerts: [...alerts, ...state.alerts] };
    }
    case 'ADD_VITALS': {
      const p = state.patients.find((x) => x.id === action.patientId);
      if (!p) return state;
      const vitals = [...p.vitals, action.reading].sort((a, b) => a.t - b.t);
      const np: Patient = { ...p, vitals };
      const i = vitals.indexOf(action.reading);
      const isLatest = i === vitals.length - 1;
      const prev = i > 0 ? predictAt(np, i - 1, th, isLatest) : null;
      const cur = predictAt(np, i, th, isLatest);
      const created = evaluateAlerts(np, i, prev, cur, state.settings.alerts).map((a) => ({
        ...a,
        id: `${a.id}-${vitals.length}`,
      }));
      return {
        ...state,
        patients: state.patients.map((x) => (x.id === p.id ? np : x)),
        alerts: [...created, ...state.alerts],
      };
    }
    case 'ADD_LABS': {
      const p = state.patients.find((x) => x.id === action.patientId);
      if (!p) return state;
      const before = predict(p, th);
      const np: Patient = { ...p, labs: [...p.labs, action.panel].sort((a, b) => a.t - b.t) };
      const after = predict(np, th);
      const created =
        before && after && state.settings.alerts.risk
          ? riskTransitionAlerts(p.id, Math.max(action.panel.t, after.t), before, after, `-lab${np.labs.length}`)
          : [];
      return {
        ...state,
        patients: state.patients.map((x) => (x.id === p.id ? np : x)),
        alerts: [...created, ...state.alerts],
      };
    }
    case 'ADD_NOTE':
      return {
        ...state,
        patients: state.patients.map((p) => (p.id === action.patientId ? { ...p, notes: [action.note, ...p.notes] } : p)),
      };
    case 'DELETE_NOTE':
      return {
        ...state,
        patients: state.patients.map((p) =>
          p.id === action.patientId ? { ...p, notes: p.notes.filter((n) => n.id !== action.noteId) } : p,
        ),
      };
    case 'ACK_ALERT':
      return {
        ...state,
        alerts: state.alerts.map((a) =>
          a.id === action.id && !a.acknowledged
            ? { ...a, acknowledged: true, ackBy: state.profile.displayName, ackAt: action.at }
            : a,
        ),
      };
    case 'ACK_ALL':
      return {
        ...state,
        alerts: state.alerts.map((a) =>
          !a.acknowledged &&
          (!action.patientId || a.patientId === action.patientId) &&
          (!action.ids || action.ids.includes(a.id))
            ? { ...a, acknowledged: true, ackBy: state.profile.displayName, ackAt: action.at }
            : a,
        ),
      };
    case 'UPDATE_PROFILE':
      return { ...state, profile: { ...state.profile, ...action.profile } };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.settings } };
    case 'RESET_DATA':
      return stateFromSeed(action.seed, state);
    default:
      return state;
  }
}

interface Ctx {
  state: AppState;
  dispatch: Dispatch<Action>;
  predictions: Map<string, Prediction | null>;
}

const AppContext = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        /* storage full or unavailable */
      }
    }, 250);
    return () => window.clearTimeout(id);
  }, [state]);

  const predictions = useMemo(() => {
    const m = new Map<string, Prediction | null>();
    for (const p of state.patients) m.set(p.id, predict(p, state.settings.thresholds));
    return m;
  }, [state.patients, state.settings.thresholds]);

  const value = useMemo(() => ({ state, dispatch, predictions }), [state, predictions]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(AppContext);
  if (!c) throw new Error('useApp must be used inside <AppProvider>');
  return c;
}

export interface Stats {
  total: number;
  highAny: number;
  detHigh: number;
  readmHigh: number;
  detCounts: Record<'Low' | 'Moderate' | 'High', number>;
  readmCounts: Record<'Low' | 'Moderate' | 'High', number>;
  activeAlerts: number;
  activeCritical: number;
}

export function useStats(): Stats {
  const { state, predictions } = useApp();
  return useMemo(() => {
    const detCounts = { Low: 0, Moderate: 0, High: 0 };
    const readmCounts = { Low: 0, Moderate: 0, High: 0 };
    let highAny = 0;
    for (const p of state.patients) {
      const pr = predictions.get(p.id);
      if (!pr) continue;
      detCounts[pr.deterioration.level]++;
      readmCounts[pr.readmission.level]++;
      if (pr.deterioration.level === 'High' || pr.readmission.level === 'High') highAny++;
    }
    const active = state.alerts.filter((a) => !a.acknowledged);
    return {
      total: state.patients.length,
      highAny,
      detHigh: detCounts.High,
      readmHigh: readmCounts.High,
      detCounts,
      readmCounts,
      activeAlerts: active.filter((a) => a.severity !== 'info').length,
      activeCritical: active.filter((a) => a.severity === 'critical').length,
    };
  }, [state.patients, state.alerts, predictions]);
}

export function nextPatientId(patients: Patient[]): string {
  const max = patients.reduce((m, p) => Math.max(m, parseInt(p.id.replace(/\D/g, ''), 10) || 0), 0);
  return patientIdFor(max + 1);
}
