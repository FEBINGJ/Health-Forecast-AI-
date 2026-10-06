import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BrainCircuit, Check, FlaskConical, HeartPulse, Pencil, Save, ShieldCheck, Sparkles } from 'lucide-react';
import type { Gender, Patient, Prediction } from '../types';
import { nextPatientId, useApp } from '../store/AppStore';
import { useToast } from '../components/Toast';
import { Button, Card, Field, Input, Modal, PageHeader, RISK_STYLES, RiskBadge, RiskBar, Segmented, Select, Stepper } from '../components/ui';
import { LabFields, VitalsFields, emptyLabs, emptyVitals, parseLabs, parseVitals, type LabsForm, type VitalsErrors, type VitalsForm } from '../components/ClinicalForms';
import { COMORBIDITY_OPTIONS, LAB_KEYS, LAB_META, fmtLab, predict } from '../lib/model';
import { ageAt, fmtDate, fmtDateTime, parseDateInput, toDateInput, toDateTimeInput } from '../lib/format';
import { cn } from '../utils/cn';

const WARDS = ['Ward 1', 'Ward 2', 'Ward 3', 'Ward 4', 'Ward 5', 'Ward 6'];
const STEPS = ['Basic Info', 'Clinical Data', 'Review'];

interface BasicForm {
  name: string;
  dob: string;
  gender: Gender | '';
  admissionDate: string;
  ward: string;
  bed: string;
  diagnosis: string;
  comorbidities: string[];
  priorAdmissions: string;
  icuStay: boolean;
}

type BasicErrors = Partial<Record<keyof BasicForm, string>>;

function Section({ title, subtitle, children, action }: { title: string; subtitle?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3 border-b border-slate-100 pb-2">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function KV({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs text-slate-500">{k}</dt>
          <dd className="mt-0.5 truncate text-sm font-semibold text-slate-900">{v || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

function PreviewCard({ preview }: { preview: Prediction | null }) {
  const { state } = useApp();
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-slate-100 bg-linear-to-r from-blue-50 to-white px-4 py-3.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-white">
          <BrainCircuit className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-900">AI Risk Preview</p>
          <p className="text-[11px] text-slate-500">Updates live as you enter measurements</p>
        </div>
      </div>
      {preview ? (
        <div className="space-y-4 p-4">
          {[
            { label: 'Deterioration (24 h)', r: preview.deterioration },
            { label: 'ICU Readmission (30 d)', r: preview.readmission },
          ].map(({ label, r }) => (
            <div key={label}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{label}</span>
                <RiskBadge level={r.level} />
              </div>
              <div className="mt-2 flex items-center gap-3">
                <span className={cn('w-11 text-lg font-bold tabular-nums', RISK_STYLES[r.level].text)}>{r.percent}%</span>
                <RiskBar percent={r.percent} level={r.level} thresholds={state.settings.thresholds} className="flex-1" />
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-600">NEWS2</span>
            <span className="font-semibold text-slate-900">
              {preview.news2.total} <span className="text-xs font-normal text-slate-500">({preview.news2.band})</span>
            </span>
          </div>
          {preview.factors.length > 0 && (
            <ul className="space-y-1.5">
              {preview.factors.slice(0, 3).map((f) => (
                <li key={f.key} className="flex items-start gap-2 text-xs text-slate-600">
                  <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', f.severity === 'high' ? 'bg-red-500' : 'bg-orange-400')} />
                  <span>
                    <span className="font-medium text-slate-800">{f.text}</span> — {f.detail}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="p-4 text-sm text-slate-500">Complete the vital signs to see the predicted deterioration and readmission risk before saving.</div>
      )}
    </Card>
  );
}

export default function AddPatient() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const toast = useToast();
  const [newId] = useState(() => nextPatientId(state.patients));
  const [step, setStep] = useState(0);
  const [clinicalTab, setClinicalTab] = useState<'vitals' | 'labs'>('vitals');
  const [basic, setBasic] = useState<BasicForm>(() => ({
    name: '',
    dob: '',
    gender: '',
    admissionDate: toDateInput(Date.now()),
    ward: '',
    bed: '',
    diagnosis: '',
    comorbidities: [],
    priorAdmissions: '0',
    icuStay: false,
  }));
  const [vitals, setVitals] = useState<VitalsForm>(() => emptyVitals(toDateTimeInput(Date.now())));
  const [labs, setLabs] = useState<LabsForm>(emptyLabs);
  const [basicErrors, setBasicErrors] = useState<BasicErrors>({});
  const [vitalErrors, setVitalErrors] = useState<VitalsErrors>({});
  const [labErrors, setLabErrors] = useState<ReturnType<typeof parseLabs>['errors']>({});
  const [saving, setSaving] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const setB = (patch: Partial<BasicForm>) => {
    setBasic((b) => ({ ...b, ...patch }));
    setBasicErrors((e) => {
      const n = { ...e };
      (Object.keys(patch) as (keyof BasicForm)[]).forEach((k) => delete n[k]);
      return n;
    });
  };

  const draft = useMemo((): Patient | null => {
    const v = parseVitals(vitals);
    if (!v.reading || !basic.dob) return null;
    const l = parseLabs(labs);
    const wardNo = basic.ward.replace(/\D/g, '') || '0';
    return {
      id: newId,
      name: basic.name.trim(),
      dob: basic.dob,
      gender: (basic.gender || 'Other') as Gender,
      ward: basic.ward,
      bed: basic.bed.trim() || `${wardNo}-${String((parseInt(newId.replace(/\D/g, ''), 10) % 24) + 1).padStart(2, '0')}`,
      admittedAt: basic.admissionDate ? parseDateInput(basic.admissionDate) : v.reading.t,
      diagnosis: basic.diagnosis.trim() || 'Under assessment',
      comorbidities: basic.comorbidities,
      priorAdmissions: Number(basic.priorAdmissions) || 0,
      icuStay: basic.icuStay,
      attending: state.profile.displayName,
      vitals: [{ ...v.reading, source: 'Admission', by: state.profile.displayName }],
      labs: l.count && !Object.keys(l.errors).length ? [{ t: v.reading.t, values: l.values }] : [],
      notes: [],
      createdAt: Date.now(),
    };
  }, [vitals, labs, basic, newId, state.profile.displayName]);

  const preview = useMemo(() => (draft ? predict(draft, state.settings.thresholds) : null), [draft, state.settings.thresholds]);

  const dirty = !!(basic.name || basic.dob || basic.gender || basic.ward || vitals.hr || vitals.spo2 || vitals.bp);

  const validateBasic = (): boolean => {
    const e: BasicErrors = {};
    const today = Date.now();
    if (basic.name.trim().length < 2) e.name = 'Please enter the patient’s full name';
    if (!basic.dob) e.dob = 'Date of birth is required';
    else {
      const t = parseDateInput(basic.dob);
      if (Number.isNaN(t) || t > today) e.dob = 'Date of birth cannot be in the future';
      else if (ageAt(basic.dob) > 120) e.dob = 'Please check the date of birth';
    }
    if (!basic.gender) e.gender = 'Please select a gender';
    if (!basic.admissionDate) e.admissionDate = 'Admission date is required';
    else {
      const a = parseDateInput(basic.admissionDate);
      if (Number.isNaN(a) || a > today) e.admissionDate = 'Admission date cannot be in the future';
      else if (basic.dob && a < parseDateInput(basic.dob)) e.admissionDate = 'Admission cannot be before date of birth';
    }
    if (!basic.ward) e.ward = 'Please select a ward';
    setBasicErrors(e);
    return !Object.keys(e).length;
  };

  const validateClinical = (): boolean => {
    const v = parseVitals(vitals);
    const errs = { ...v.errors };
    if (v.reading && basic.admissionDate && v.reading.t < parseDateInput(basic.admissionDate)) errs.time = 'Measurement time cannot be before the admission date';
    const l = parseLabs(labs);
    setVitalErrors(errs);
    setLabErrors(l.errors);
    if (Object.keys(errs).length) {
      setClinicalTab('vitals');
      return false;
    }
    if (Object.keys(l.errors).length) {
      setClinicalTab('labs');
      return false;
    }
    return true;
  };

  const goto = (s: number) => {
    setStep(s);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const next = () => {
    if (step === 0 && validateBasic()) goto(1);
    else if (step === 1 && validateClinical()) goto(2);
  };

  const fillSample = () => {
    setBasic({
      name: 'Sarah Lee',
      dob: '1980-05-15',
      gender: 'Female',
      admissionDate: toDateInput(Date.now()),
      ward: 'Ward 2',
      bed: '',
      diagnosis: 'Community-acquired pneumonia (mild)',
      comorbidities: ['Asthma'],
      priorAdmissions: '0',
      icuStay: false,
    });
    setVitals({ hr: '88', spo2: '95', bp: '120/80', rr: '18', temp: '36.8', time: toDateTimeInput(Date.now()), o2: false, avpu: 'Alert' });
    setBasicErrors({});
    setVitalErrors({});
    toast({ kind: 'info', title: 'Sample data filled', description: 'Review the details and continue through the steps.' });
  };

  const save = () => {
    if (!draft) return;
    setSaving(true);
    const patient: Patient = {
      ...draft,
      createdAt: Date.now(),
      notes: [
        {
          id: `n-${Date.now()}`,
          t: Date.now(),
          author: state.profile.fullName,
          type: 'Progress',
          text: `Patient registered for AI risk monitoring. ${basic.diagnosis.trim() ? `Working diagnosis: ${basic.diagnosis.trim()}. ` : ''}Initial observations recorded at ${fmtDateTime(draft.vitals[0].t)}.`,
        },
      ],
    };
    window.setTimeout(() => {
      dispatch({ type: 'ADD_PATIENT', patient });
      toast({ kind: 'success', title: 'New patient added successfully!', description: 'You can now monitor the patient’s data and risk predictions.', duration: 7000 });
      navigate('/', { state: { addedId: patient.id } });
    }, 550);
  };

  const v = parseVitals(vitals).reading;
  const labValues = parseLabs(labs).values;
  const labCount = Object.keys(labValues).length;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Add New Patient"
        subtitle="Enter patient information and initial measurements"
        actions={
          step === 0 ? (
            <Button variant="soft" size="sm" icon={<Sparkles className="h-4 w-4" />} onClick={fillSample}>
              Use sample data
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="min-w-0">
          <div className="border-b border-slate-100 px-4 py-5 sm:px-8">
            <div className="mx-auto max-w-xl">
              <Stepper steps={STEPS} current={step} />
            </div>
          </div>

          <div key={step} className="animate-slide-up p-4 sm:p-6 lg:p-8">
            {step === 0 && (
              <div className="space-y-8">
                <Section title="Basic Information">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Patient ID (Auto-generated)" htmlFor="pid">
                      <Input id="pid" value={newId} disabled className="font-mono font-semibold" />
                    </Field>
                    <Field label="Full Name" htmlFor="name" error={basicErrors.name} required>
                      <Input id="name" placeholder="e.g. Sarah Lee" value={basic.name} onChange={(e) => setB({ name: e.target.value })} invalid={!!basicErrors.name} autoComplete="off" />
                    </Field>
                    <Field label="Date of Birth" htmlFor="dob" error={basicErrors.dob} hint={basic.dob && !basicErrors.dob ? `Age ${ageAt(basic.dob)} years` : undefined} required>
                      <Input id="dob" type="date" max={toDateInput(Date.now())} value={basic.dob} onChange={(e) => setB({ dob: e.target.value })} invalid={!!basicErrors.dob} />
                    </Field>
                    <Field label="Gender" htmlFor="gender" error={basicErrors.gender} required>
                      <Select id="gender" value={basic.gender} onChange={(e) => setB({ gender: e.target.value as Gender })} invalid={!!basicErrors.gender}>
                        <option value="">Select gender</option>
                        <option>Female</option>
                        <option>Male</option>
                        <option>Other</option>
                      </Select>
                    </Field>
                  </div>
                </Section>

                <Section title="Admission Information">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Field label="Admission Date" htmlFor="adm" error={basicErrors.admissionDate} required>
                      <Input id="adm" type="date" max={toDateInput(Date.now())} value={basic.admissionDate} onChange={(e) => setB({ admissionDate: e.target.value })} invalid={!!basicErrors.admissionDate} />
                    </Field>
                    <Field label="Ward" htmlFor="ward" error={basicErrors.ward} required>
                      <Select id="ward" value={basic.ward} onChange={(e) => setB({ ward: e.target.value })} invalid={!!basicErrors.ward}>
                        <option value="">Select ward</option>
                        {WARDS.map((w) => (
                          <option key={w}>{w}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Bed" htmlFor="bed" hint="Optional">
                      <Input id="bed" placeholder="e.g. 2-07" value={basic.bed} onChange={(e) => setB({ bed: e.target.value })} />
                    </Field>
                  </div>
                </Section>

                <Section title="Clinical Background" subtitle="Optional — improves the ICU readmission prediction">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Primary diagnosis" htmlFor="dx">
                      <Input id="dx" placeholder="e.g. Community-acquired pneumonia" value={basic.diagnosis} onChange={(e) => setB({ diagnosis: e.target.value })} />
                    </Field>
                    <Field label="Admissions in the past 12 months" htmlFor="prior">
                      <Select id="prior" value={basic.priorAdmissions} onChange={(e) => setB({ priorAdmissions: e.target.value })}>
                        {['0', '1', '2', '3', '4', '5'].map((n) => (
                          <option key={n} value={n}>
                            {n === '5' ? '5 or more' : n}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <div>
                    <p className="mb-2 text-[13px] font-medium text-slate-700">Comorbidities</p>
                    <div className="flex flex-wrap gap-2">
                      {COMORBIDITY_OPTIONS.map((c) => {
                        const on = basic.comorbidities.includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setB({ comorbidities: on ? basic.comorbidities.filter((x) => x !== c) : [...basic.comorbidities, c] })}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition',
                              on ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50',
                            )}
                            aria-pressed={on}
                          >
                            {on && <Check className="h-3 w-3" strokeWidth={3} />}
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
                    <input type="checkbox" checked={basic.icuStay} onChange={(e) => setB({ icuStay: e.target.checked })} className="h-4 w-4 accent-blue-600" />
                    Stepped down from ICU / HDU during this admission
                  </label>
                </Section>
              </div>
            )}

            {step === 1 && (
              <Section
                title="Initial Clinical Measurements"
                subtitle="Vital signs are required; lab results are optional"
                action={
                  <span className="hidden text-xs text-slate-400 sm:inline">
                    {newId} · {basic.name}
                  </span>
                }
              >
                <Segmented
                  stretch
                  items={[
                    {
                      id: 'vitals',
                      label: (
                        <span className="inline-flex items-center gap-1.5">
                          <HeartPulse className="h-4 w-4" /> Vital Signs
                          {Object.keys(vitalErrors).length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                        </span>
                      ),
                    },
                    {
                      id: 'labs',
                      label: (
                        <span className="inline-flex items-center gap-1.5">
                          <FlaskConical className="h-4 w-4" /> Lab Results
                          {labCount > 0 && <span className="rounded-full bg-blue-100 px-1.5 text-[10px] font-bold text-blue-700">{labCount}</span>}
                          {Object.keys(labErrors).length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                        </span>
                      ),
                    },
                  ]}
                  value={clinicalTab}
                  onChange={setClinicalTab}
                />
                {clinicalTab === 'vitals' ? (
                  <VitalsFields
                    idPrefix="ap"
                    form={vitals}
                    errors={vitalErrors}
                    onChange={(p) => {
                      setVitals((f) => ({ ...f, ...p }));
                      setVitalErrors((e) => {
                        const n = { ...e };
                        (Object.keys(p) as (keyof VitalsForm)[]).forEach((k) => delete n[k]);
                        return n;
                      });
                    }}
                  />
                ) : (
                  <LabFields
                    idPrefix="apl"
                    form={labs}
                    errors={labErrors}
                    onChange={(k, val) => {
                      setLabs((f) => ({ ...f, [k]: val }));
                      setLabErrors((e) => {
                        const n = { ...e };
                        delete n[k];
                        return n;
                      });
                    }}
                  />
                )}
              </Section>
            )}

            {step === 2 && (
              <div className="space-y-7">
                <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 text-sm text-blue-900">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                  <p>
                    <span className="font-semibold">Review Patient Information.</span> Confirm the details below — once saved, the patient appears at the top of the patient list
                    and is continuously monitored by the AI risk engine.
                  </p>
                </div>
                <Section
                  title="Basic Information"
                  action={
                    <button onClick={() => goto(0)} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800">
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                  }
                >
                  <KV
                    items={[
                      ['Patient ID', <span className="font-mono">{newId}</span>],
                      ['Name', basic.name],
                      ['Date of Birth', basic.dob],
                      ['Age', basic.dob ? `${ageAt(basic.dob)} years` : ''],
                      ['Gender', basic.gender],
                    ]}
                  />
                </Section>
                <Section
                  title="Admission Information"
                  action={
                    <button onClick={() => goto(0)} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800">
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                  }
                >
                  <KV
                    items={[
                      ['Admission Date', basic.admissionDate ? fmtDate(parseDateInput(basic.admissionDate)) : ''],
                      ['Ward', basic.ward],
                      ['Bed', draft?.bed ?? basic.bed],
                      ['Diagnosis', basic.diagnosis || 'Under assessment'],
                      ['Prior admissions (12 mo)', basic.priorAdmissions],
                      ['Comorbidities', basic.comorbidities.length ? basic.comorbidities.join(', ') : 'None recorded'],
                    ]}
                  />
                </Section>
                <Section
                  title="Initial Measurements"
                  action={
                    <button onClick={() => goto(1)} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800">
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                  }
                >
                  {v && (
                    <KV
                      items={[
                        ['HR', `${v.hr} bpm`],
                        ['SpO₂', `${v.spo2}%`],
                        ['BP', `${v.sys}/${v.dia} mmHg`],
                        ['RR', `${v.rr} /min`],
                        ['Temp', `${v.temp.toFixed(1)} °C`],
                        ['Measured', fmtDateTime(v.t)],
                        ['Consciousness', v.avpu ?? 'Alert'],
                        ['Oxygen', v.o2 ? 'Supplemental O₂' : 'Room air'],
                      ]}
                    />
                  )}
                  {labCount > 0 && (
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Lab results</p>
                      <div className="flex flex-wrap gap-2">
                        {LAB_KEYS.filter((k) => labValues[k] != null).map((k) => (
                          <span key={k} className="rounded-md bg-white px-2 py-1 text-xs ring-1 ring-slate-200">
                            <span className="text-slate-500">{LAB_META[k].short}</span> <span className="font-semibold text-slate-900">{fmtLab(k, labValues[k] as number)}</span>{' '}
                            <span className="text-slate-400">{LAB_META[k].unit}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </Section>
                <div className="lg:hidden">
                  <PreviewCard preview={preview} />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-4 sm:px-8">
            {step === 0 ? (
              <Button variant="secondary" onClick={() => (dirty ? setConfirmCancel(true) : navigate('/'))}>
                Cancel
              </Button>
            ) : (
              <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => goto(step - 1)} disabled={saving}>
                Back
              </Button>
            )}
            {step < 2 ? (
              <Button onClick={next} className="min-w-28">
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button variant="success" icon={<Save className="h-4 w-4" />} onClick={save} loading={saving} disabled={!draft}>
                {saving ? 'Saving…' : 'Save Patient'}
              </Button>
            )}
          </div>
        </Card>

        <aside className={cn('space-y-4', step === 0 && 'hidden lg:block', step === 2 && 'hidden lg:block')}>
          <PreviewCard preview={preview} />
          <Card className="p-4">
            <p className="text-sm font-semibold text-slate-900">What happens next?</p>
            <ol className="mt-3 space-y-2.5 text-xs text-slate-600">
              {[
                'The patient is added to the top of the patient list.',
                'NEWS2 and AI risk scores are calculated from the initial measurements.',
                'Alerts are raised automatically if risk thresholds are crossed.',
              ].map((t, i) => (
                <li key={t} className="flex gap-2.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>
          </Card>
        </aside>
      </div>

      <Modal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        size="sm"
        title="Discard new patient?"
        description="The information you entered will be lost."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmCancel(false)}>
              Keep editing
            </Button>
            <Button variant="danger" onClick={() => navigate('/')}>
              Discard
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">You can come back and add the patient at any time from the dashboard.</p>
      </Modal>
    </div>
  );
}
