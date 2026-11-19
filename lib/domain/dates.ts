/**
 * Date "di calendario" (senza ora) rappresentate come stringhe ISO `YYYY-MM-DD`.
 *
 * Perché stringhe: una verifica "il 3 dicembre" è il 3 dicembre per lo studente,
 * indipendentemente dal fuso del server. Usare `Date` porterebbe a slittamenti
 * di un giorno quando il server gira in UTC e l'utente è in Europe/Rome.
 */

export type DateKey = string;

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export function isDateKey(value: string): value is DateKey {
  const m = DATE_KEY.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

function toUtcMs(key: DateKey): number {
  if (!isDateKey(key)) throw new RangeError(`Data non valida: ${key}`);
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): DateKey {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Il giorno di calendario di `now` nel fuso orario dell'utente. */
export function dateKeyInTimeZone(now: Date, timeZone: string): DateKey {
  // en-CA formatta come YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Ora (0–23) di `now` nel fuso orario dell'utente. */
export function hourInTimeZone(now: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(now);
  return Number(hour);
}

export function addDays(key: DateKey, days: number): DateKey {
  return fromUtcMs(toUtcMs(key) + days * DAY_MS);
}

/** Giorni da `from` a `to` (positivo se `to` è nel futuro). */
export function diffDays(from: DateKey, to: DateKey): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

/** Giorno della settimana ISO: 1 = lunedì … 7 = domenica. */
export function isoWeekday(key: DateKey): number {
  const day = new Date(toUtcMs(key)).getUTCDay();
  return day === 0 ? 7 : day;
}

/** I sette giorni (lunedì → domenica) della settimana che contiene `key`. */
export function weekOf(key: DateKey): DateKey[] {
  const monday = addDays(key, 1 - isoWeekday(key));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function isWithin(key: DateKey, start: DateKey, end: DateKey): boolean {
  return key >= start && key <= end;
}

/** Converte una DateKey in un `Date` a mezzogiorno UTC, sicuro per la formattazione. */
export function dateKeyToDate(key: DateKey): Date {
  return new Date(toUtcMs(key) + DAY_MS / 2);
}
