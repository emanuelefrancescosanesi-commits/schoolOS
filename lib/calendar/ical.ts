import ICAL from "ical.js";
import { type DateKey, addDays, dateKeyInTimeZone, diffDays, timeInTimeZone } from "@/lib/domain/dates";
import type { EventKind } from "@/lib/domain/model";

export interface ImportedEvent {
  /** Identificativo stabile (UID + eventuale occorrenza): evita duplicati a ogni sincronizzazione. */
  externalId: string;
  title: string;
  date: DateKey;
  time?: string;
  kind: EventKind;
  notes?: string;
}

export interface ParseOptions {
  timeZone: string;
  /** Finestra di import: eventi tra `from` e `to` (inclusi). */
  from: DateKey;
  to: DateKey;
  /** Tetto di sicurezza sul numero di eventi restituiti. */
  max?: number;
}

/** «Verifica di storia» → verifica, «Interrogazione» → interrogazione; il resto è un evento. */
export function classifyTitle(title: string): EventKind {
  if (/\b(verifica|compito in classe|test|prova scritta|scritto)\b/i.test(title)) return "test";
  if (/\b(interrogazion[ei]|orale|esame)\b/i.test(title)) return "oral";
  if (/\b(consegna|progetto|relazione|ricerca)\b/i.test(title)) return "project";
  return "event";
}

const clean = (s: unknown, max: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const pad = (n: number) => String(n).padStart(2, "0");

/** Giorno e ora di un istante iCal nel fuso dello studente; le date «tutto il giorno» restano come sono. */
function placeOf(t: ICAL.Time, timeZone: string): { date: DateKey; time?: string } {
  if (t.isDate) return { date: `${t.year}-${pad(t.month)}-${pad(t.day)}` };
  // Orario «fluttuante» (senza fuso): è già l'ora sulla parete, non va convertito.
  if (t.zone === ICAL.Timezone.localTimezone) {
    return { date: `${t.year}-${pad(t.month)}-${pad(t.day)}`, time: `${pad(t.hour)}:${pad(t.minute)}` };
  }
  const js = t.toJSDate();
  return { date: dateKeyInTimeZone(js, timeZone), time: timeInTimeZone(js, timeZone) };
}

/**
 * Legge un file iCal (.ics) e restituisce gli eventi nella finestra richiesta, con le ripetizioni
 * (RRULE) già espanse e le eccezioni applicate. Un file illeggibile solleva un errore.
 */
export function parseIcal(text: string, opts: ParseOptions): ImportedEvent[] {
  const max = opts.max ?? 600;
  let root: ICAL.Component;
  try {
    root = new ICAL.Component(ICAL.parse(text));
  } catch {
    throw new Error("Il file non è un calendario iCal valido.");
  }
  if (root.name !== "vcalendar") throw new Error("Il file non è un calendario iCal valido.");

  for (const tz of root.getAllSubcomponents("vtimezone")) {
    const id = tz.getFirstPropertyValue("tzid");
    if (typeof id === "string" && !ICAL.TimezoneService.has(id)) ICAL.TimezoneService.register(tz);
  }

  // Master (senza RECURRENCE-ID) per UID, poi le eccezioni collegate al loro master.
  const masters = new Map<string, ICAL.Event>();
  const exceptions: ICAL.Event[] = [];
  const singles: ICAL.Event[] = [];
  for (const comp of root.getAllSubcomponents("vevent")) {
    const ev = new ICAL.Event(comp);
    if (!ev.startDate) continue;
    if (ev.isRecurrenceException()) exceptions.push(ev);
    else if (ev.isRecurring()) masters.set(ev.uid, ev);
    else singles.push(ev);
  }
  for (const ex of exceptions) masters.get(ex.uid)?.relateException(ex);

  const out: ImportedEvent[] = [];
  const seen = new Set<string>();
  const push = (e: ImportedEvent) => {
    if (out.length >= max || seen.has(e.externalId) || e.date < opts.from || e.date > opts.to) return;
    seen.add(e.externalId);
    out.push(e);
  };

  const emit = (ev: ICAL.Event, start: ICAL.Time, end: ICAL.Time | null, idSuffix: string) => {
    const title = clean(ev.summary, 140) || "Evento";
    const notes = clean(ev.description, 500) || undefined;
    const first = placeOf(start, opts.timeZone);
    const base = { title, notes, kind: classifyTitle(title) };
    // Evento «tutto il giorno» su più giorni (DTEND esclusivo): un evento per giorno, fino a 14.
    const last = start.isDate && end ? addDays(placeOf(end, opts.timeZone).date, -1) : first.date;
    const days = Math.min(Math.max(diffDays(first.date, last), 0), 13);
    for (let i = 0; i <= days; i++) {
      push({
        ...base,
        externalId: `${ev.uid}${idSuffix}${i ? `#${i}` : ""}`.slice(0, 300),
        date: addDays(first.date, i),
        time: i === 0 ? first.time : undefined,
      });
    }
  };

  for (const ev of singles) emit(ev, ev.startDate, ev.endDate ?? null, "");

  const windowStart = ICAL.Time.fromDateString(opts.from);
  const windowEnd = ICAL.Time.fromDateString(addDays(opts.to, 1));
  for (const ev of masters.values()) {
    const it = ev.iterator();
    for (let n = 0; n < 1500 && out.length < max; n++) {
      const next = it.next();
      if (!next) break;
      if (next.compare(windowEnd) > 0) break;
      const det = ev.getOccurrenceDetails(next);
      const endsBefore = det.endDate.compare(windowStart) < 0;
      if (endsBefore) continue;
      emit(det.item, det.startDate, det.endDate, `@${det.recurrenceId.toString()}`);
    }
  }

  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
}
