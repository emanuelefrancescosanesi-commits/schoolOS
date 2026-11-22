import type { DateKey } from "./dates";
import type { CalendarEvent } from "./model";
import type { Task } from "./tasks";

/** Prefisso degli id dei Task ricavati da un evento: serve a capire da dove arrivano. */
export const EVENT_TASK_PREFIX = "event:";

/**
 * Gli eventi con una scadenza "da studente" (verifica, interrogazione, progetto, compito)
 * contano come impegni: li vedono Dashboard e Notifiche come se fossero compiti aperti.
 * Gli eventi generici (assemblea, uscita) restano solo sul calendario.
 */
export function eventsAsTasks(events: readonly CalendarEvent[]): Task[] {
  return events
    .filter((e): e is CalendarEvent & { kind: Task["kind"] } => e.kind !== "event")
    .map((e) => ({
      id: `${EVENT_TASK_PREFIX}${e.id}`,
      title: e.title,
      subjectId: e.subjectId ?? "",
      kind: e.kind,
      due: e.date,
      done: false,
    }));
}

export const isEventTask = (task: Pick<Task, "id">) => task.id.startsWith(EVENT_TASK_PREFIX);

/** Ordina per data, poi per ora (gli eventi «tutto il giorno» vengono prima). */
export function sortEvents<T extends { date: DateKey; time?: string }>(events: readonly T[]): T[] {
  return [...events].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
}

export function eventsByDay(events: readonly CalendarEvent[]): Map<DateKey, CalendarEvent[]> {
  const map = new Map<DateKey, CalendarEvent[]>();
  for (const e of sortEvents(events)) map.set(e.date, [...(map.get(e.date) ?? []), e]);
  return map;
}
