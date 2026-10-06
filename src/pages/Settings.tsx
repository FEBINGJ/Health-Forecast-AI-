import { useMemo, useState } from 'react';
import { BellRing, BrainCircuit, Database, LayoutList, RotateCcw, Save, SlidersHorizontal, UserRound } from 'lucide-react';
import { DEFAULT_SETTINGS, createSeed, useApp } from '../store/AppStore';
import { useToast } from '../components/Toast';
import { Button, Card, CardHeader, DoctorAvatar, Field, Input, Modal, PageHeader, Segmented, Switch } from '../components/ui';
import { MODEL_INFO } from '../lib/model';
import { fmtDateTime } from '../lib/format';

export default function Settings() {
  const { state, dispatch, predictions } = useApp();
  const toast = useToast();
  const [profile, setProfile] = useState(state.profile);
  const [th, setTh] = useState(state.settings.thresholds);
  const [confirmReset, setConfirmReset] = useState(false);

  const profileDirty = JSON.stringify(profile) !== JSON.stringify(state.profile);
  const thDirty = th.moderate !== state.settings.thresholds.moderate || th.high !== state.settings.thresholds.high;

  const preview = useMemo(() => {
    let det = 0;
    let readm = 0;
    let any = 0;
    for (const pr of predictions.values()) {
      if (!pr) continue;
      const d = pr.deterioration.percent >= th.high;
      const r = pr.readmission.percent >= th.high;
      if (d) det++;
      if (r) readm++;
      if (d || r) any++;
    }
    return { det, readm, any };
  }, [predictions, th]);

  const saveProfile = () => {
    if (!profile.fullName.trim() || !profile.displayName.trim()) {
      toast({ kind: 'error', title: 'Name fields cannot be empty' });
      return;
    }
    dispatch({ type: 'UPDATE_PROFILE', profile });
    toast({ kind: 'success', title: 'Profile updated' });
  };

  const saveThresholds = () => {
    dispatch({ type: 'UPDATE_SETTINGS', settings: { thresholds: th } });
    toast({ kind: 'success', title: 'Risk thresholds saved', description: `Moderate ≥ ${th.moderate}%, High ≥ ${th.high}%. Risk levels have been recalculated.` });
  };

  const prefs = state.settings.alerts;
  const setPref = (k: keyof typeof prefs, v: boolean) => dispatch({ type: 'UPDATE_SETTINGS', settings: { alerts: { ...prefs, [k]: v } } });

  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" subtitle="Manage your profile, AI risk thresholds and notification preferences" />

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        <div className="space-y-4 sm:space-y-5">
          <Card>
            <CardHeader title="Profile" subtitle="Shown on the dashboard and on clinical notes" icon={<UserRound className="h-4 w-4" />} />
            <div className="space-y-4 p-4 sm:p-5">
              <div className="flex items-center gap-4">
                <DoctorAvatar className="h-16 w-16 ring-4 ring-blue-50" />
                <div>
                  <p className="font-semibold text-slate-900">{state.profile.fullName}</p>
                  <p className="text-sm text-slate-500">
                    {state.profile.role} · {state.profile.department}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">Signed in as {state.profile.username}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Full name" htmlFor="s-full">
                  <Input id="s-full" value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} />
                </Field>
                <Field label="Display name" htmlFor="s-display" hint="Used in “Welcome, …”">
                  <Input id="s-display" value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} />
                </Field>
                <Field label="Role" htmlFor="s-role">
                  <Input id="s-role" value={profile.role} onChange={(e) => setProfile({ ...profile, role: e.target.value })} />
                </Field>
                <Field label="Department" htmlFor="s-dept">
                  <Input id="s-dept" value={profile.department} onChange={(e) => setProfile({ ...profile, department: e.target.value })} />
                </Field>
                <Field label="Email" htmlFor="s-email" className="sm:col-span-2">
                  <Input id="s-email" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
                </Field>
              </div>
              <div className="flex justify-end gap-2">
                {profileDirty && (
                  <Button variant="ghost" onClick={() => setProfile(state.profile)}>
                    Discard
                  </Button>
                )}
                <Button icon={<Save className="h-4 w-4" />} onClick={saveProfile} disabled={!profileDirty}>
                  Save profile
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="AI Risk Thresholds" subtitle="Probability cut-offs used to classify Low, Moderate and High risk" icon={<SlidersHorizontal className="h-4 w-4" />} />
            <div className="space-y-5 p-4 sm:p-5">
              <div>
                <div className="relative flex h-3 overflow-hidden rounded-full">
                  <div className="bg-emerald-400" style={{ width: `${th.moderate}%` }} />
                  <div className="bg-orange-400" style={{ width: `${th.high - th.moderate}%` }} />
                  <div className="flex-1 bg-red-500" />
                </div>
                <div className="mt-1.5 flex justify-between text-[11px] font-medium text-slate-500">
                  <span>0%</span>
                  <span className="text-emerald-700">Low &lt; {th.moderate}%</span>
                  <span className="text-orange-700">
                    Moderate {th.moderate}–{th.high - 1}%
                  </span>
                  <span className="text-red-700">High ≥ {th.high}%</span>
                  <span>100%</span>
                </div>
              </div>
              <Field label={`Moderate risk threshold: ${th.moderate}%`} htmlFor="th-mod">
                <input
                  id="th-mod"
                  type="range"
                  min={10}
                  max={50}
                  value={th.moderate}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setTh((t) => ({ moderate: Math.min(v, t.high - 5), high: t.high }));
                  }}
                  className="w-full"
                />
              </Field>
              <Field label={`High risk threshold: ${th.high}%`} htmlFor="th-high">
                <input
                  id="th-high"
                  type="range"
                  min={40}
                  max={90}
                  value={th.high}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setTh((t) => ({ moderate: t.moderate, high: Math.max(v, t.moderate + 5) }));
                  }}
                  className="w-full"
                />
              </Field>
              <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-center">
                <div>
                  <p className="text-lg font-bold text-red-600">{preview.any}</p>
                  <p className="text-[11px] text-slate-500">High risk (any)</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-orange-500">{preview.det}</p>
                  <p className="text-[11px] text-slate-500">Deterioration</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-indigo-600">{preview.readm}</p>
                  <p className="text-[11px] text-slate-500">Readmission</p>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setTh(DEFAULT_SETTINGS.thresholds)}>
                  Defaults ({DEFAULT_SETTINGS.thresholds.moderate}/{DEFAULT_SETTINGS.thresholds.high})
                </Button>
                <Button icon={<Save className="h-4 w-4" />} onClick={saveThresholds} disabled={!thDirty}>
                  Save thresholds
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4 sm:space-y-5">
          <Card>
            <CardHeader title="Alert Preferences" subtitle="Changes apply immediately to new observations" icon={<BellRing className="h-4 w-4" />} />
            <div className="space-y-5 p-4 sm:p-5">
              <Switch checked={prefs.vitals} onChange={(v) => setPref('vitals', v)} label="Vital-sign threshold alerts" description="SpO₂ < 92%, HR > 120, systolic BP < 90, RR > 24, fever ≥ 38.5 °C" />
              <Switch checked={prefs.risk} onChange={(v) => setPref('risk', v)} label="AI risk alerts" description="Raised when a patient crosses into Moderate or High predicted risk" />
              <Switch checked={prefs.toasts} onChange={(v) => setPref('toasts', v)} label="Pop-up notifications" description="Show an on-screen notification for new critical and warning alerts" />
            </div>
          </Card>

          <Card>
            <CardHeader title="Display" icon={<LayoutList className="h-4 w-4" />} />
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div>
                <p className="text-sm font-medium text-slate-800">Rows per page</p>
                <p className="text-xs text-slate-500">Patient lists on the dashboard and patients page</p>
              </div>
              <Segmented
                items={[
                  { id: '5', label: '5' },
                  { id: '10', label: '10' },
                  { id: '20', label: '20' },
                  { id: '50', label: '50' },
                ]}
                value={String(state.settings.pageSize)}
                onChange={(v) => dispatch({ type: 'UPDATE_SETTINGS', settings: { pageSize: Number(v) } })}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Data Management" subtitle="All data is stored locally in this browser" icon={<Database className="h-4 w-4" />} />
            <div className="space-y-3 p-4 sm:p-5">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-lg font-bold text-slate-900">{state.patients.length}</p>
                  <p className="text-[11px] text-slate-500">Patients</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-lg font-bold text-slate-900">{state.patients.reduce((s, p) => s + p.vitals.length, 0)}</p>
                  <p className="text-[11px] text-slate-500">Observations</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-lg font-bold text-slate-900">{state.alerts.length}</p>
                  <p className="text-[11px] text-slate-500">Alerts</p>
                </div>
              </div>
              <p className="text-xs text-slate-500">Demo data generated {fmtDateTime(state.seededAt)}. Resetting regenerates the 120-patient cohort relative to the current time.</p>
              <Button variant="danger" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setConfirmReset(true)}>
                Reset demo data
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="About the AI model" icon={<BrainCircuit className="h-4 w-4" />} />
            <div className="space-y-2 p-4 text-sm text-slate-600 sm:p-5">
              <p>
                <span className="font-semibold text-slate-800">
                  {MODEL_INFO.name} {MODEL_INFO.version}
                </span>{' '}
                combines the NEWS2 early-warning score with 12-hour vital-sign trends, laboratory markers (WBC, lactate, CRP, creatinine, haemoglobin, sodium) and
                patient history to estimate deterioration risk over the {MODEL_INFO.deteriorationHorizon} and ICU readmission risk within {MODEL_INFO.readmissionHorizon}.
              </p>
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                Demonstration software using simulated data. Predictions support — but never replace — clinical judgement.
              </p>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        size="sm"
        title="Reset demo data?"
        description="All patients you added, recorded observations, notes and acknowledgements will be replaced with a fresh demo cohort."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={<RotateCcw className="h-4 w-4" />}
              onClick={() => {
                dispatch({ type: 'RESET_DATA', seed: createSeed() });
                setConfirmReset(false);
                toast({ kind: 'success', title: 'Demo data reset', description: '120 patients regenerated with up-to-date observations.' });
              }}
            >
              Reset data
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Your profile and preferences are kept.</p>
      </Modal>
    </div>
  );
}
