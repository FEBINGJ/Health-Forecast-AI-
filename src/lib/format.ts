export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

const pad = (n: number) => String(n).padStart(2, '0');

export function fmtDate(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fmtTime(t: number): string {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtDateTime(t: number): string {
  return `${fmtDate(t)} ${fmtTime(t)}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDayMonth(t: number): string {
  const d = new Date(t);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function fmtTick(t: number, spanHours: number): string {
  if (spanHours > 48) return fmtDayMonth(t);
  const d = new Date(t);
  if (d.getHours() === 0 && d.getMinutes() === 0) return fmtDayMonth(t);
  return fmtTime(t);
}

export function timeAgo(t: number, now: number = Date.now()): string {
  const s = Math.max(0, now - t) / 1000;
  if (s < 45) return 'just now';
  const m = s / 60;
  if (m < 60) return `${Math.max(1, Math.round(m))} min ago`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)} h ago`;
  const d = h / 24;
  return `${Math.floor(d)} d ago`;
}

export function toDateInput(t: number): string {
  return fmtDate(t);
}

export function toDateTimeInput(t: number): string {
  return `${fmtDate(t)}T${fmtTime(t)}`;
}

export function parseDateInput(s: string): number {
  return new Date(`${s}T00:00:00`).getTime();
}

export function parseDateTimeInput(s: string): number {
  return new Date(s).getTime();
}

export function ageAt(dob: string, t: number = Date.now()): number {
  const d = new Date(`${dob}T00:00:00`);
  const n = new Date(t);
  let a = n.getFullYear() - d.getFullYear();
  const m = n.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--;
  return Math.max(0, a);
}

export function losDays(admittedAt: number, t: number = Date.now()): number {
  return Math.max(0, Math.floor((t - admittedAt) / DAY));
}

export function initials(name: string): string {
  const parts = name.replace(/^Dr\.?\s+/i, '').trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
