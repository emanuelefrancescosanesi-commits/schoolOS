import { type DateKey, isoWeekday } from "./dates";

/** Una lezione ricorrente. Orari "HH:MM", giorno 1 = lunedì … 6 = sabato. */
export interface TimetableSlot {
  id: string;
  weekday: number;
  start: string;
  end: string;
  subjectId?: string;
  room?: string;
}

export const WEEKDAYS = [1, 2, 3, 4, 5, 6] as const;

export const isTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

/** Il database restituisce "HH:MM:SS": la UI usa "HH:MM". */
export const trimTime = (t: string) => t.slice(0, 5);

/** Lezioni del giorno, in ordine di inizio. */
export function slotsOfDay(slots: readonly TimetableSlot[], weekday: number): TimetableSlot[] {
  return slots.filter((s) => s.weekday === weekday).sort((a, b) => a.start.localeCompare(b.start));
}

/** Giorni con almeno una lezione (lun–ven sempre, sabato solo se serve). */
export function visibleWeekdays(slots: readonly TimetableSlot[]): number[] {
  return slots.some((s) => s.weekday === 6) ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
}

/** Lezione in corso o, se non ce n'è, la prossima di oggi. Domenica: nessuna. */
export function currentOrNext(
  slots: readonly TimetableSlot[],
  today: DateKey,
  nowTime: string,
): { slot: TimetableSlot; state: "now" | "next" } | null {
  const day = slotsOfDay(slots, isoWeekday(today));
  const running = day.find((s) => s.start <= nowTime && nowTime < s.end);
  if (running) return { slot: running, state: "now" };
  const next = day.find((s) => s.start > nowTime);
  return next ? { slot: next, state: "next" } : null;
}
