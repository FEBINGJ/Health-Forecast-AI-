import { useState } from 'react';
import { NotebookPen, Save, Trash } from 'lucide-react';
import type { NoteType, Patient } from '../../types';
import { useApp } from '../../store/AppStore';
import { useToast } from '../../components/Toast';
import { Button, Card, CardHeader, EmptyState, InitialsAvatar, Segmented, Select, Textarea } from '../../components/ui';
import { fmtDateTime, timeAgo } from '../../lib/format';
import { cn } from '../../utils/cn';

const TYPES: NoteType[] = ['Progress', 'Nursing', 'Plan', 'Handover'];
const TYPE_STYLES: Record<NoteType, string> = {
  Progress: 'bg-blue-50 text-blue-700',
  Nursing: 'bg-emerald-50 text-emerald-700',
  Plan: 'bg-violet-50 text-violet-700',
  Handover: 'bg-amber-50 text-amber-700',
};
const TEMPLATES = ['Reviewed AI risk alert at bedside.', 'Observations increased to hourly.', 'Escalated to critical-care outreach.', 'Family updated on plan.'];

export default function NotesTab({ patient }: { patient: Patient }) {
  const { state, dispatch } = useApp();
  const toast = useToast();
  const [type, setType] = useState<NoteType>('Progress');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | NoteType>('all');

  const save = () => {
    if (text.trim().length < 3) {
      setError('Please write a short note before saving.');
      return;
    }
    const now = Date.now();
    dispatch({ type: 'ADD_NOTE', patientId: patient.id, note: { id: `n-${now}`, t: now, author: state.profile.fullName, type, text: text.trim() } });
    setText('');
    setError('');
    toast({ kind: 'success', title: 'Note saved', description: `${type} note added to ${patient.name}'s record.` });
  };

  const notes = [...patient.notes].sort((a, b) => b.t - a.t).filter((n) => filter === 'all' || n.type === filter);

  return (
    <div className="grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <Card className="self-start p-4 sm:p-5 lg:sticky lg:top-24">
        <h3 className="text-[15px] font-semibold text-slate-900">Add clinical note</h3>
        <p className="mt-0.5 text-xs text-slate-500">Signed as {state.profile.fullName}</p>
        <div className="mt-4 space-y-3">
          <Segmented items={TYPES.map((t) => ({ id: t, label: t }))} value={type} onChange={setType} stretch />
          <Textarea
            rows={6}
            maxLength={2000}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError('');
            }}
            invalid={!!error}
            placeholder="Document assessment, plan or handover…"
            aria-label="Note text"
          />
          {error && <p className="text-xs font-medium text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setText((x) => (x ? `${x.trimEnd()} ${t}` : t))}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-200"
              >
                + {t}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-400">{text.length}/2000</span>
            <Button onClick={save} icon={<Save className="h-4 w-4" />}>
              Save note
            </Button>
          </div>
        </div>
      </Card>

      <Card className="min-w-0">
        <CardHeader
          title="Clinical Notes"
          subtitle={`${patient.notes.length} entr${patient.notes.length === 1 ? 'y' : 'ies'}`}
          icon={<NotebookPen className="h-4 w-4" />}
          action={
            <div className="w-36">
              <Select value={filter} onChange={(e) => setFilter(e.target.value as 'all' | NoteType)} aria-label="Filter notes" className="h-9 text-xs">
                <option value="all">All types</option>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
          }
        />
        {notes.length ? (
          <ol className="space-y-1 p-4 sm:p-5">
            {notes.map((n, i) => (
              <li key={n.id} className="relative flex gap-3 pb-4">
                {i < notes.length - 1 && <span className="absolute bottom-0 left-[17px] top-10 w-px bg-slate-200" />}
                <InitialsAvatar name={n.author} className="h-9 w-9" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-semibold text-slate-900">{n.author}</span>
                    <span className={cn('rounded px-1.5 py-px text-[10px] font-bold uppercase', TYPE_STYLES[n.type])}>{n.type}</span>
                    <span className="text-xs text-slate-400" title={fmtDateTime(n.t)}>
                      {fmtDateTime(n.t)} · {timeAgo(n.t)}
                    </span>
                    {n.author === state.profile.fullName && n.t > state.seededAt && (
                      <button
                        onClick={() => dispatch({ type: 'DELETE_NOTE', patientId: patient.id, noteId: n.id })}
                        className="ml-auto rounded p-1 text-slate-300 transition hover:bg-red-50 hover:text-red-600"
                        aria-label="Delete note"
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2.5 text-sm leading-relaxed text-slate-700">{n.text}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState icon={<NotebookPen className="h-5 w-5" />} title="No notes" description={filter === 'all' ? 'Add the first clinical note for this patient.' : `No ${filter.toLowerCase()} notes yet.`} />
        )}
      </Card>
    </div>
  );
}
