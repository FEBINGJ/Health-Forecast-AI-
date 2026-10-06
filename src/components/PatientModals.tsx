import { useEffect, useState } from 'react';
import { FlaskConical, HeartPulse, Save } from 'lucide-react';
import type { LabKey, Patient, VitalReading } from '../types';
import { useApp } from '../store/AppStore';
import { predict } from '../lib/model';
import { toDateTimeInput } from '../lib/format';
import { Button, Field, Input, Modal } from './ui';
import { useToast } from './Toast';
import { LabFields, VitalsFields, emptyLabs, emptyVitals, parseLabs, parseVitals, type LabsForm, type VitalsErrors, type VitalsForm } from './ClinicalForms';

export function RecordVitalsModal({ open, onClose, patient }: { open: boolean; onClose: () => void; patient: Patient }) {
  const { state, dispatch } = useApp();
  const toast = useToast();
  const [form, setForm] = useState<VitalsForm>(() => emptyVitals(toDateTimeInput(Date.now())));
  const [errors, setErrors] = useState<VitalsErrors>({});

  useEffect(() => {
    if (open) {
      setForm(emptyVitals(toDateTimeInput(Date.now())));
      setErrors({});
    }
  }, [open]);

  const last = patient.vitals[patient.vitals.length - 1];

  const submit = () => {
    const res = parseVitals(form);
    setErrors(res.errors);
    if (!res.reading) return;
    const reading: VitalReading = { ...res.reading, source: 'Manual', by: state.profile.displayName };
    dispatch({ type: 'ADD_VITALS', patientId: patient.id, reading });
    const pred = predict({ ...patient, vitals: [...patient.vitals, reading].sort((a, b) => a.t - b.t) }, state.settings.thresholds);
    toast({
      kind: 'success',
      title: 'Vital signs recorded',
      description: pred
        ? `Risk updated — deterioration ${pred.deterioration.percent}% (${pred.deterioration.level}), readmission ${pred.readmission.percent}% (${pred.readmission.level}).`
        : undefined,
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record vital signs"
      description={`${patient.id} · ${patient.name} — the AI risk prediction updates instantly.`}
      icon={
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-50 text-red-500">
          <HeartPulse className="h-5 w-5" />
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} icon={<Save className="h-4 w-4" />}>
            Save & update risk
          </Button>
        </>
      }
    >
      <VitalsFields
        idPrefix="rv"
        form={form}
        errors={errors}
        onChange={(p) => setForm((f) => ({ ...f, ...p }))}
        placeholders={
          last
            ? { hr: `Last: ${last.hr}`, spo2: `Last: ${last.spo2}`, bp: `Last: ${last.sys}/${last.dia}`, rr: `Last: ${last.rr}`, temp: `Last: ${last.temp.toFixed(1)}` }
            : undefined
        }
      />
    </Modal>
  );
}

export function AddLabsModal({ open, onClose, patient }: { open: boolean; onClose: () => void; patient: Patient }) {
  const { state, dispatch } = useApp();
  const toast = useToast();
  const [form, setForm] = useState<LabsForm>(emptyLabs);
  const [time, setTime] = useState(() => toDateTimeInput(Date.now()));
  const [errors, setErrors] = useState<Partial<Record<LabKey, string>>>({});
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(emptyLabs());
      setTime(toDateTimeInput(Date.now()));
      setErrors({});
      setFormError('');
    }
  }, [open]);

  const submit = () => {
    const res = parseLabs(form);
    setErrors(res.errors);
    const t = new Date(time).getTime();
    if (Object.keys(res.errors).length) return;
    if (!res.count) {
      setFormError('Enter at least one result.');
      return;
    }
    if (!time || Number.isNaN(t) || t > Date.now() + 5 * 60_000) {
      setFormError('Enter a valid collection time (not in the future).');
      return;
    }
    setFormError('');
    const panel = { t, values: res.values };
    dispatch({ type: 'ADD_LABS', patientId: patient.id, panel });
    const pred = predict({ ...patient, labs: [...patient.labs, panel] }, state.settings.thresholds);
    toast({
      kind: 'success',
      title: `${res.count} lab result${res.count > 1 ? 's' : ''} added`,
      description: pred ? `Deterioration risk now ${pred.deterioration.percent}% (${pred.deterioration.level}).` : undefined,
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Add lab results"
      description={`${patient.id} · ${patient.name} — leave fields empty if not measured.`}
      icon={
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-600">
          <FlaskConical className="h-5 w-5" />
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} icon={<Save className="h-4 w-4" />}>
            Save results
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {formError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}
        <Field label="Collection time" htmlFor="lab-time" className="sm:max-w-xs">
          <Input id="lab-time" type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        <LabFields idPrefix="ml" form={form} errors={errors} onChange={(k, v) => setForm((f) => ({ ...f, [k]: v }))} />
      </div>
    </Modal>
  );
}
