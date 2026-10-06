import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Pause, Play, Plus, Radio, Stethoscope, UserRound } from 'lucide-react';
import type { Patient, Prediction } from '../types';
import { useApp } from '../store/AppStore';
import { useToast } from '../components/Toast';
import { Button, Card, EmptyState, Tabs, type TabItem } from '../components/ui';
import { AddLabsModal, RecordVitalsModal } from '../components/PatientModals';
import { predict, simulateReading } from '../lib/model';
import { ageAt, fmtDate, losDays } from '../lib/format';
import OverviewTab from './patient/OverviewTab';
import VitalsTab from './patient/VitalsTab';
import LabsTab from './patient/LabsTab';
import RiskTab from './patient/RiskTab';
import NotesTab from './patient/NotesTab';

type TabId = 'overview' | 'vitals' | 'labs' | 'risk' | 'notes';
const TAB_IDS: TabId[] = ['overview', 'vitals', 'labs', 'risk', 'notes'];

export default function PatientDetail() {
  const { id } = useParams();
  const { state, dispatch, predictions } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [vitalsOpen, setVitalsOpen] = useState(false);
  const [labsOpen, setLabsOpen] = useState(false);

  const rawTab = params.get('tab') as TabId | null;
  const tab: TabId = rawTab && TAB_IDS.includes(rawTab) ? rawTab : 'overview';
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const setTab = (t: TabId) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true, state: { from } });

  const patient = state.patients.find((p) => p.id === id);
  const [live, setLive] = useState(false);
  const latestRef = useRef<{ patient?: Patient; prediction: Prediction | null }>({ prediction: null });

  useEffect(() => {
    latestRef.current = { patient, prediction: patient ? (predictions.get(patient.id) ?? null) : null };
  });

  useEffect(() => {
    setLive(false);
  }, [id]);

  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => {
      const { patient: p, prediction: pr } = latestRef.current;
      if (p) dispatch({ type: 'ADD_VITALS', patientId: p.id, reading: simulateReading(p, pr) });
    }, 3500);
    return () => window.clearInterval(timer);
  }, [live, dispatch]);

  if (!patient) {
    return (
      <Card className="mx-auto mt-6 max-w-lg">
        <EmptyState
          icon={<UserRound className="h-5 w-5" />}
          title="Patient not found"
          description={`No patient with ID “${id}” exists in the system.`}
          action={<Button onClick={() => navigate('/patients')}>Back to patients</Button>}
        />
      </Card>
    );
  }

  const prediction = predictions.get(patient.id) ?? null;
  const activeAlerts = state.alerts.filter((a) => a.patientId === patient.id && !a.acknowledged && a.severity !== 'info').length;

  const simulate = () => {
    const reading = simulateReading(patient, prediction);
    dispatch({ type: 'ADD_VITALS', patientId: patient.id, reading });
    const pr = predict({ ...patient, vitals: [...patient.vitals, reading] }, state.settings.thresholds);
    toast({
      kind: 'info',
      title: 'New monitor reading received',
      description: `HR ${reading.hr} · SpO₂ ${reading.spo2}% · BP ${reading.sys}/${reading.dia} · RR ${reading.rr} · ${reading.temp.toFixed(1)} °C${
        pr ? ` — deterioration risk ${pr.deterioration.percent}%` : ''
      }`,
    });
  };

  const tabs: TabItem<TabId>[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'vitals', label: 'Vital Signs', badge: activeAlerts || undefined },
    { id: 'labs', label: 'Lab Results' },
    { id: 'risk', label: 'Risk Analysis' },
    { id: 'notes', label: 'Notes' },
  ];

  const meta: [string, string | number][] = [
    ['Age', ageAt(patient.dob)],
    ['Gender', patient.gender],
    ['Ward', patient.ward.replace(/^Ward\s*/i, '')],
    ['Admission', fmtDate(patient.admittedAt)],
    ['Bed', patient.bed],
    ['Length of stay', `${losDays(patient.admittedAt)} d`],
  ];

  return (
    <div className="animate-fade-in">
      <Link to={from} className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800">
        <ArrowLeft className="h-4 w-4" /> Back to Patient List
      </Link>

      <Card className="mt-3 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-navy-900 sm:text-2xl">
                {patient.id} - {patient.name}
              </h1>
              {prediction?.deterioration.level === 'High' && (
                <span className="animate-pop-in rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">High deterioration risk</span>
              )}
              {prediction?.readmission.level === 'High' && (
                <span className="animate-pop-in rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">High readmission risk</span>
              )}
              {live && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  <span className="h-1.5 w-1.5 animate-pulse-ring rounded-full bg-emerald-500" /> Live feed
                </span>
              )}
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-x-4 gap-y-3 sm:flex sm:flex-wrap sm:gap-0 sm:divide-x sm:divide-slate-200">
              {meta.map(([k, v]) => (
                <div key={k} className="min-w-0 sm:px-5 sm:first:pl-0">
                  <dt className="text-xs text-slate-500">{k}</dt>
                  <dd className="truncate text-sm font-semibold text-slate-900">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 font-semibold text-blue-700">
                <Stethoscope className="h-3.5 w-3.5" /> {patient.diagnosis}
              </span>
              {patient.comorbidities.map((c) => (
                <span key={c} className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-600">
                  {c}
                </span>
              ))}
              {patient.icuStay && <span className="rounded-md bg-indigo-50 px-2 py-1 font-medium text-indigo-700">ICU step-down</span>}
              <span className="px-1 text-slate-400">Attending: {patient.attending}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            <Button
              variant={live ? 'success' : 'secondary'}
              icon={live ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              onClick={() => {
                setLive((l) => !l);
                toast({
                  kind: 'info',
                  title: live ? 'Live feed paused' : 'Live monitoring started',
                  description: live ? undefined : 'Simulated bedside-monitor readings will stream in every few seconds.',
                  duration: 3000,
                });
              }}
              title="Stream simulated bedside-monitor readings"
            >
              {live ? 'Pause live feed' : 'Live feed'}
            </Button>
            <Button variant="secondary" icon={<Radio className="h-4 w-4" />} onClick={simulate} title="Simulate a single incoming bedside-monitor observation" className="hidden sm:inline-flex">
              Simulate reading
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setVitalsOpen(true)}>
              Record vitals
            </Button>
          </div>
        </div>
      </Card>

      <Tabs className="mt-4" items={tabs} value={tab} onChange={setTab} />

      <div className="mt-4 sm:mt-5">
        {tab === 'overview' && <OverviewTab patient={patient} prediction={prediction} onTab={setTab} />}
        {tab === 'vitals' && <VitalsTab patient={patient} onRecord={() => setVitalsOpen(true)} />}
        {tab === 'labs' && <LabsTab patient={patient} onAdd={() => setLabsOpen(true)} />}
        {tab === 'risk' && <RiskTab patient={patient} prediction={prediction} />}
        {tab === 'notes' && <NotesTab patient={patient} />}
      </div>

      <RecordVitalsModal open={vitalsOpen} onClose={() => setVitalsOpen(false)} patient={patient} />
      <AddLabsModal open={labsOpen} onClose={() => setLabsOpen(false)} patient={patient} />
    </div>
  );
}
