export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, total));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Intervalos semiabertos [início, fim): 08:00–09:00 e 09:00–10:00 não se sobrepõem. */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd);
}

export function formatTime(time: string): string {
  const [h, m] = time.split(':');
  return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

export function formatRange(start: string, end: string): string {
  return `${start}–${end}`;
}

export function durationMinutes(start: string, end: string): number {
  return toMinutes(end) - toMinutes(start);
}
