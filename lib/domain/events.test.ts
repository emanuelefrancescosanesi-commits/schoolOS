import { describe, expect, it } from "vitest";
import { EVENT_TASK_PREFIX, eventsAsTasks, eventsByDay, isEventTask, sortEvents } from "./events";
import type { CalendarEvent } from "./model";

const ev = (id: string, date: string, kind: CalendarEvent["kind"], time?: string): CalendarEvent => ({ id, title: id, date, kind, time });

describe("eventsAsTasks", () => {
  it("trasforma verifiche, interrogazioni, progetti e compiti in impegni, non gli eventi generici", () => {
    const tasks = eventsAsTasks([ev("a", "2026-12-01", "test"), ev("b", "2026-12-02", "event"), ev("c", "2026-12-03", "oral")]);
    expect(tasks.map((t) => t.id)).toEqual([`${EVENT_TASK_PREFIX}a`, `${EVENT_TASK_PREFIX}c`]);
    expect(tasks.every((t) => !t.done)).toBe(true);
    expect(tasks.every(isEventTask)).toBe(true);
    expect(tasks[0]).toMatchObject({ due: "2026-12-01", kind: "test", subjectId: "" });
  });
});

describe("sortEvents / eventsByDay", () => {
  it("ordina per data e ora, con «tutto il giorno» prima", () => {
    const sorted = sortEvents([ev("tardi", "2026-12-01", "event", "15:00"), ev("giorno", "2026-12-01", "event"), ev("presto", "2026-12-01", "event", "08:00"), ev("prima", "2026-11-30", "event", "20:00")]);
    expect(sorted.map((e) => e.id)).toEqual(["prima", "giorno", "presto", "tardi"]);
  });

  it("raggruppa per giorno", () => {
    const map = eventsByDay([ev("a", "2026-12-01", "test"), ev("b", "2026-12-01", "event", "10:00"), ev("c", "2026-12-02", "oral")]);
    expect(map.get("2026-12-01")?.map((e) => e.id)).toEqual(["a", "b"]);
    expect(map.get("2026-12-02")).toHaveLength(1);
    expect(map.get("2026-12-03")).toBeUndefined();
  });
});
