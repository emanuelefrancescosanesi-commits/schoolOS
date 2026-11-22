import { type DateKey, addDays, diffDays, isDateKey, isoWeekday } from "@/lib/domain/dates";
import { firstDue } from "./recurrence";
import type { Recurrence, TodoPriority } from "./types";

/**
 * Aggiunta rapida in italiano naturale: "studiare storia domani alle 15 p1 #scuola @ripasso +storia".
 *
 * Tutto deterministico e locale (nessuna AI, quindi gratis per tutti). Riconosce:
 *  - date: oggi, domani, dopodomani, stasera, tra 3 giorni/2 settimane, lunedì, 15/12, 15 dicembre, il 15
 *  - orari: alle 15, alle 15:30, ore 9.30, 18:00
 *  - ricorrenze: ogni giorno, ogni 2 giorni, ogni settimana, ogni lunedì e giovedì, ogni mese, nei giorni feriali
 *  - priorità: p1…p4 oppure !1…!4 (1 = urgente)
 *  - #lista, @etichetta, +materia (per nome o prefisso)
 * Quello che non riconosce resta nel titolo: nessuna parola sparisce senza essere mostrata.
 */

export interface QuickAddContext {
  today: DateKey;
  projects: ReadonlyArray<{ id: string; name: string }>;
  subjects: ReadonlyArray<{ id: string; name: string }>;
}

export type DetectedKind = "date" | "time" | "recurrence" | "priority" | "project" | "label" | "subject";

export interface Detected {
  kind: DetectedKind;
  /** Testo digitato dallo studente. */
  raw: string;
}

export interface QuickAddResult {
  title: string;
  due: DateKey | null;
  time: string | null;
  priority: TodoPriority | null;
  recurrence: Recurrence | null;
  projectId: string | null;
  subjectId: string | null;
  labels: string[];
  detected: Detected[];
}

const B = "(?<![\\p{L}\\p{N}])";
const E = "(?![\\p{L}\\p{N}])";

const WEEKDAY_SRC = "(luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica)";
const WEEKDAYS: Record<string, number> = {
  lunedi: 1, martedi: 2, mercoledi: 3, giovedi: 4, venerdi: 5, sabato: 6, domenica: 7,
};
const MONTHS: Record<string, number> = {
  gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6, lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12,
};

const SMALL_NUMBERS: Record<string, number> = { un: 1, una: 1, uno: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7 };

export function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

const weekdayNumber = (word: string) => WEEKDAYS[normalize(word)] ?? 0;
const slug = (text: string) => normalize(text).replace(/[^\p{L}\p{N}]/gu, "");

function num(word: string): number {
  return SMALL_NUMBERS[word.toLowerCase()] ?? Number(word);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function validDate(y: number, m: number, d: number): DateKey | null {
  const key = `${String(y).padStart(4, "0")}-${pad(m)}-${pad(d)}`;
  return isDateKey(key) ? key : null;
}

/** Prima occorrenza di giorno/mese da oggi in poi (senza anno: quest'anno, o il prossimo se già passata). */
function upcomingDate(today: DateKey, month: number, day: number): DateKey | null {
  const year = Number(today.slice(0, 4));
  const thisYear = validDate(year, month, day);
  if (thisYear && thisYear >= today) return thisYear;
  return validDate(year + 1, month, day);
}

function nextWeekday(today: DateKey, isoDay: number): DateKey {
  const delta = ((isoDay - isoWeekday(today) + 6) % 7) + 1; // sempre nel futuro
  return addDays(today, delta);
}

export function parseQuickAdd(input: string, ctx: QuickAddContext): QuickAddResult {
  let text = ` ${input} `;
  const detected: Detected[] = [];

  /** Cerca la prima corrispondenza, la toglie dal testo e la registra. */
  const take = (re: RegExp, kind: DetectedKind): RegExpExecArray | null => {
    const m = re.exec(text);
    if (!m) return null;
    text = `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`;
    detected.push({ kind, raw: m[0].trim() });
    return m;
  };

  let due: DateKey | null = null;
  let time: string | null = null;
  let recurrence: Recurrence | null = null;

  // 1. Ricorrenza (prima delle date: "ogni lunedì" non è "lunedì").
  const every = take(new RegExp(`${B}ogni\\s+${WEEKDAY_SRC}((?:\\s*(?:,|e)\\s*${WEEKDAY_SRC})*)${E}`, "iu"), "recurrence");
  if (every) {
    const days = new Set<number>([weekdayNumber(every[1])]);
    for (const w of every[0].matchAll(new RegExp(WEEKDAY_SRC, "giu"))) days.add(weekdayNumber(w[1]));
    recurrence = { freq: "week", interval: 1, weekdays: [...days].sort((a, b) => a - b) };
  } else if (take(new RegExp(`${B}(?:nei\\s+giorni\\s+feriali|ogni\\s+giorno\\s+feriale|dal\\s+luned[iì]\\s+al\\s+venerd[iì])${E}`, "iu"), "recurrence")) {
    recurrence = { freq: "week", interval: 1, weekdays: [1, 2, 3, 4, 5] };
  } else {
    const unit = take(
      new RegExp(`${B}(?:ogni\\s+(?:(\\d{1,3}|due|tre|quattro)\\s+)?(giorn[oi]|settiman[ae]|mes[ei])|tutti\\s+i\\s+giorni)${E}`, "iu"),
      "recurrence",
    );
    if (unit) {
      const interval = unit[1] ? num(unit[1]) : 1;
      const u = (unit[2] ?? "giorno").toLowerCase();
      const freq = u.startsWith("giorn") ? "day" : u.startsWith("sett") ? "week" : "month";
      recurrence = interval >= 1 && interval <= 365 ? { freq, interval } : null;
      if (!recurrence) detected.pop();
    }
  }

  // 2. Data.
  const dated = (re: string, f: (m: RegExpExecArray) => DateKey | null): boolean => {
    const m = new RegExp(re, "iu").exec(text);
    if (!m) return false;
    const value = f(m);
    if (!value) return false;
    take(new RegExp(re, "iu"), "date");
    due = value;
    return true;
  };

  const prefix = "(?:entro\\s+(?:il\\s+)?|il\\s+)?";
  // Le forme sono provate dalla più specifica alla più generica: la prima che combacia vince.
  const attempts: Array<() => boolean> = [
    () => dated(`${B}dopodomani${E}`, () => addDays(ctx.today, 2)),
    () => dated(`${B}${prefix}domani${E}`, () => addDays(ctx.today, 1)),
    () => dated(`${B}(?:entro\\s+)?(?:oggi|stasera|stanotte)${E}`, () => ctx.today),
    () => dated(`${B}(?:tra|fra)\\s+(\\d{1,3}|un|una|due|tre|quattro|cinque|sei|sette)\\s+(giorn[oi]|settiman[ae]|mes[ei])${E}`, (m) => {
      const n = num(m[1]);
      const u = m[2].toLowerCase();
      return addDays(ctx.today, n * (u.startsWith("giorn") ? 1 : u.startsWith("sett") ? 7 : 30));
    }),
    () => dated(`${B}(?:entro\\s+(?:il\\s+)?|il\\s+|prossim[oa]\\s+|questo\\s+|questa\\s+)?${WEEKDAY_SRC}${E}`, (m) =>
      nextWeekday(ctx.today, weekdayNumber(m[1])),
    ),
    () => dated(`${B}${prefix}(\\d{1,2})[/-](\\d{1,2})(?:[/-](\\d{4}|\\d{2}))?${E}`, (m) => {
      const [d, mo] = [Number(m[1]), Number(m[2])];
      if (m[3]) {
        const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
        return validDate(y, mo, d);
      }
      return upcomingDate(ctx.today, mo, d);
    }),
    () => dated(`${B}${prefix}(\\d{1,2})\\s+(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)[a-zà-ù]*${E}`, (m) =>
      upcomingDate(ctx.today, MONTHS[m[2].toLowerCase()], Number(m[1])),
    ),
    () => dated(`${B}(?:entro\\s+)?il\\s+(\\d{1,2})(?![\\p{L}\\p{N}:.,/])`, (m) => {
      const day = Number(m[1]);
      const [y, mo] = [Number(ctx.today.slice(0, 4)), Number(ctx.today.slice(5, 7))];
      for (let i = 0; i < 13; i++) {
        const month = ((mo - 1 + i) % 12) + 1;
        const year = y + Math.floor((mo - 1 + i) / 12);
        const key = validDate(year, month, day);
        if (key && key >= ctx.today) return key;
      }
      return null;
    }),
  ];
  attempts.some((attempt) => attempt());

  // 3. Orario.
  const setTime = (h: number, min: number): boolean => {
    if (h > 23 || min > 59) return false;
    time = `${pad(h)}:${pad(min)}`;
    return true;
  };
  const timed = /(?<![\p{L}\p{N}])(?:alle|ore|h)\s*(\d{1,2})(?:[:.](\d{2}))?(?![\p{L}\p{N}])/iu.exec(text);
  if (timed && setTime(Number(timed[1]), Number(timed[2] ?? 0))) {
    take(/(?<![\p{L}\p{N}])(?:alle|ore|h)\s*(\d{1,2})(?:[:.](\d{2}))?(?![\p{L}\p{N}])/iu, "time");
  } else {
    const clock = /(?<![\p{L}\p{N}:.])(\d{1,2}):(\d{2})(?![\p{L}\p{N}:])/u.exec(text);
    if (clock && setTime(Number(clock[1]), Number(clock[2]))) take(/(?<![\p{L}\p{N}:.])(\d{1,2}):(\d{2})(?![\p{L}\p{N}:])/u, "time");
  }
  if (!time && /(?<![\p{L}\p{N}])stasera(?![\p{L}\p{N}])/iu.test(input)) time = "20:00";

  // 4. Priorità.
  let priority: TodoPriority | null = null;
  const prio = take(/(?<![\p{L}\p{N}!])(?:!|p)([1-4])(?![\p{L}\p{N}])/iu, "priority");
  if (prio) priority = Number(prio[1]) as TodoPriority;

  // 5. #lista, @etichetta, +materia.
  let projectId: string | null = null;
  const proj = /(?<![\p{L}\p{N}])#([\p{L}\p{N}_-]+)/u.exec(text);
  if (proj) {
    const match = bestMatch(ctx.projects, proj[1]);
    if (match) {
      projectId = match.id;
      take(/(?<![\p{L}\p{N}])#([\p{L}\p{N}_-]+)/u, "project");
    }
  }

  let subjectId: string | null = null;
  const subj = /(?<![\p{L}\p{N}])\+([\p{L}\p{N}_-]+)/u.exec(text);
  if (subj) {
    const match = bestMatch(ctx.subjects, subj[1]);
    if (match) {
      subjectId = match.id;
      take(/(?<![\p{L}\p{N}])\+([\p{L}\p{N}_-]+)/u, "subject");
    }
  }

  const labels: string[] = [];
  for (const m of text.matchAll(/(?<![\p{L}\p{N}])@([\p{L}\p{N}_-]{1,30})/gu)) {
    if (labels.length < 5 && !labels.some((l) => l.toLowerCase() === m[1].toLowerCase())) labels.push(m[1]);
    detected.push({ kind: "label", raw: m[0] });
  }
  text = text.replace(/(?<![\p{L}\p{N}])@[\p{L}\p{N}_-]{1,30}/gu, " ");

  // 6. Coerenza: ora senza data = oggi; ricorrenza senza data = prima occorrenza utile.
  if (!due && time) due = ctx.today;
  if (recurrence && !due) due = firstDue(recurrence, ctx.today);
  if (!due) time = null;
  if (recurrence && recurrence.freq === "week" && !recurrence.weekdays && due) recurrence = { ...recurrence };
  if (due && diffDays(ctx.today, due) > 366 * 5) due = null;

  let title = text.replace(/\s+/g, " ").trim();
  if (due || time || recurrence) title = title.replace(/\s+(?:entro|il|alle|ore|di|per|a|da|in|dal)$/iu, "").trim();
  title = title.replace(/^[,;:-]\s*|\s*[,;:]$/g, "").trim();

  return { title, due, time, priority, recurrence, projectId, subjectId, labels, detected };
}

/** Corrispondenza per nome: esatta, poi per prefisso (la più corta vince). Ignora maiuscole, accenti e spazi. */
function bestMatch<T extends { name: string }>(items: readonly T[], token: string): T | null {
  const t = slug(token);
  if (!t) return null;
  const exact = items.find((i) => slug(i.name) === t);
  if (exact) return exact;
  const prefixed = items.filter((i) => slug(i.name).startsWith(t)).sort((a, b) => a.name.length - b.name.length);
  return prefixed[0] ?? null;
}
