import { type DateKey, addDays, diffDays, isoWeekday } from "@/lib/domain/dates";
import type { Recurrence } from "./types";

/**
 * Ricorrenza stile Todoist, ma senza duplicare le attività: completando un'attività ricorrente
 * la scadenza si sposta alla prossima occorrenza. La prossima occorrenza è sempre successiva
 * sia alla scadenza attuale sia a oggi: completare in ritardo non genera arretrati.
 */

const DAY_NAMES = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"] as const;

export function weekdayName(isoDay: number): string {
  return DAY_NAMES[isoDay - 1] ?? "";
}

function ymd(key: DateKey): [number, number, number] {
  return [Number(key.slice(0, 4)), Number(key.slice(5, 7)), Number(key.slice(8, 10))];
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

/** Somma mesi mantenendo il giorno del mese di partenza; il 31 in un mese corto cade nell'ultimo giorno. */
function addMonthsFrom(anchor: DateKey, months: number, dayOfMonth: number): DateKey {
  const [y, m] = ymd(anchor);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${pad(year, 4)}-${pad(month)}-${pad(Math.min(dayOfMonth, daysInMonth(year, month)))}`;
}

const MAX_STEPS = 4000;

/** Prossima scadenza dopo il completamento. `due` è la scadenza attuale, `today` il giorno del completamento. */
export function nextDue(rule: Recurrence, due: DateKey, today: DateKey): DateKey {
  const threshold = due > today ? due : today;
  const interval = Math.max(1, Math.floor(rule.interval));

  if (rule.freq === "day") {
    const gap = diffDays(due, threshold);
    return addDays(due, (Math.floor(gap / interval) + 1) * interval);
  }

  if (rule.freq === "week") {
    const weekdays = rule.weekdays?.length ? new Set(rule.weekdays) : new Set([isoWeekday(due)]);
    // Le settimane si contano dal lunedì della settimana della scadenza originale.
    const anchorMonday = addDays(due, 1 - isoWeekday(due));
    for (let i = 1; i <= MAX_STEPS; i++) {
      const candidate = addDays(threshold, i);
      if (!weekdays.has(isoWeekday(candidate))) continue;
      const weeks = Math.floor(diffDays(anchorMonday, candidate) / 7);
      if (weeks % interval === 0) return candidate;
    }
    return addDays(threshold, 7 * interval);
  }

  const dom = Number(due.slice(8, 10));
  for (let k = 1; k <= MAX_STEPS; k++) {
    const candidate = addMonthsFrom(due, k * interval, dom);
    if (candidate > threshold) return candidate;
  }
  return addMonthsFrom(due, interval, dom);
}

/** Prima data ≥ `from` compatibile con la regola (serve alla creazione: "ogni lunedì" → il prossimo lunedì). */
export function firstDue(rule: Recurrence, from: DateKey): DateKey {
  if (rule.freq === "week" && rule.weekdays?.length) {
    const set = new Set(rule.weekdays);
    for (let i = 0; i < 7; i++) {
      const d = addDays(from, i);
      if (set.has(isoWeekday(d))) return d;
    }
  }
  return from;
}

function joinItalian(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`;
}

/** "Ogni giorno", "Ogni 2 settimane", "Ogni lunedì e giovedì", "Ogni mese". */
export function describeRecurrence(rule: Recurrence): string {
  const n = rule.interval;
  if (rule.freq === "day") return n === 1 ? "Ogni giorno" : `Ogni ${n} giorni`;
  if (rule.freq === "month") return n === 1 ? "Ogni mese" : `Ogni ${n} mesi`;
  const days = [...new Set(rule.weekdays ?? [])].sort((a, b) => a - b);
  if (days.length === 0) return n === 1 ? "Ogni settimana" : `Ogni ${n} settimane`;
  if (days.length === 5 && days.every((d, i) => d === i + 1) && n === 1) return "Nei giorni feriali";
  const names = joinItalian(days.map(weekdayName));
  return n === 1 ? `Ogni ${names}` : `Ogni ${n} settimane: ${names}`;
}

/** Valida un valore sconosciuto (letto dal database o da un'azione) e lo riporta in forma canonica. */
export function parseRecurrence(value: unknown): Recurrence | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.freq !== "day" && v.freq !== "week" && v.freq !== "month") return null;
  const interval = Number(v.interval);
  if (!Number.isInteger(interval) || interval < 1 || interval > 365) return null;
  const rule: Recurrence = { freq: v.freq, interval };
  if (v.freq === "week" && Array.isArray(v.weekdays)) {
    const days = [...new Set(v.weekdays.map(Number))].filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
    if (days.length) rule.weekdays = days.sort((a, b) => a - b);
  }
  return rule;
}
