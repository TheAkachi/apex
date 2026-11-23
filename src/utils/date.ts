export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function offsetLocalDate(base: Date, daysDelta: number): string {
  const copy = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  copy.setDate(copy.getDate() + daysDelta);
  return formatLocalDate(copy);
}

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function formatMinutesHuman(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatStopwatch(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatDateLongPt(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

export function formatMonthYearPt(year: number, monthIndex: number): string {
  const date = new Date(year, monthIndex, 1);
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function uid(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

export function minutesToTime(totalMinutes: number): string {
  const wrapped = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function addMinutesToTime(hhmm: string, deltaMinutes: number): string {
  return minutesToTime(timeToMinutes(hhmm) + deltaMinutes);
}

export function diffTimeMinutes(startHHMM: string, endHHMM: string): number {
  const start = timeToMinutes(startHHMM);
  const end = timeToMinutes(endHHMM);
  if (end > start) return end - start;
  if (end < start) return 1440 - start + end; // Virada de dia (ex: 23:30 -> 00:30 = 60 min)
  return 0;
}

export function crossesMidnight(startHHMM: string, endHHMM: string): boolean {
  return timeToMinutes(endHHMM) < timeToMinutes(startHHMM);
}
