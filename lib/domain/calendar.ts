import { type DateKey, addDays, weekOf } from "./dates";

/** Primo giorno del mese che contiene `key`. */
export function startOfMonth(key: DateKey): DateKey {
  return `${key.slice(0, 7)}-01`;
}

/** Primo giorno del mese successivo (delta = 1) o precedente (delta = -1). */
export function shiftMonth(key: DateKey, delta: number): DateKey {
  const [y, m] = key.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  const year = Math.floor(idx / 12);
  const month = (idx % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/** Settimane (lunedì → domenica) che coprono il mese di `key`; 5 o 6 righe. */
export function monthGrid(key: DateKey): DateKey[][] {
  const first = startOfMonth(key);
  const month = first.slice(0, 7);
  const weeks: DateKey[][] = [];
  let cursor = weekOf(first)[0];
  do {
    weeks.push(weekOf(cursor));
    cursor = addDays(cursor, 7);
  } while (cursor.slice(0, 7) <= month && weeks.length < 6);
  return weeks;
}
