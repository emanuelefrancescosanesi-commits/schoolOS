import { type DateKey, diffDays } from "@/lib/domain/dates";
import { formatDayMonth, formatWeekdayShort } from "@/lib/format";

export type DueTone = "overdue" | "today" | "soon" | "later";

export interface DueLabel {
  text: string;
  tone: DueTone;
}

/** "Oggi 17:30", "Domani", "ven", "27 nov", "Scaduta · 20 nov": la scadenza come la legge uno studente. */
export function dueLabel(due: DateKey, time: string | null, today: DateKey, done = false): DueLabel {
  const days = diffDays(today, due);
  const at = time ? ` ${time}` : "";
  if (days < 0) return { text: `${days === -1 ? "Ieri" : formatDayMonth(due)}${at}`, tone: done ? "later" : "overdue" };
  if (days === 0) return { text: `Oggi${at}`, tone: "today" };
  if (days === 1) return { text: `Domani${at}`, tone: "soon" };
  if (days < 7) return { text: `${formatWeekdayShort(due)}${at}`, tone: "soon" };
  const sameYear = due.slice(0, 4) === today.slice(0, 4);
  return { text: `${formatDayMonth(due)}${sameYear ? "" : ` ${due.slice(0, 4)}`}${at}`, tone: "later" };
}

/** Intestazione di un gruppo di giorni: "Oggi · giovedì 19 novembre". */
export function dayHeading(date: DateKey, today: DateKey, longDay: string): string {
  const days = diffDays(today, date);
  const cap = longDay.charAt(0).toUpperCase() + longDay.slice(1);
  if (days === 0) return `Oggi · ${longDay}`;
  if (days === 1) return `Domani · ${longDay}`;
  return cap;
}
