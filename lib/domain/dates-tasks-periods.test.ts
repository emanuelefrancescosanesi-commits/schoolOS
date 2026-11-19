import { describe, expect, it } from "vitest";
import {
  addDays,
  dateKeyInTimeZone,
  diffDays,
  hourInTimeZone,
  isDateKey,
  isoWeekday,
  weekOf,
} from "./dates";
import { currentPeriod, suggestedPeriods } from "./periods";
import { type Task, priorityOf, priorityScore, sortByPriority, upcomingAssessments } from "./tasks";

describe("dates", () => {
  it("valida le date di calendario", () => {
    expect(isDateKey("2026-02-28")).toBe(true);
    expect(isDateKey("2026-02-30")).toBe(false);
    expect(isDateKey("2026-2-3")).toBe(false);
  });

  it("calcola il giorno nel fuso dell'utente, non del server", () => {
    // 23:30 UTC del 19 nov = 00:30 del 20 nov a Roma.
    const now = new Date("2026-11-19T23:30:00Z");
    expect(dateKeyInTimeZone(now, "UTC")).toBe("2026-11-19");
    expect(dateKeyInTimeZone(now, "Europe/Rome")).toBe("2026-11-20");
    expect(hourInTimeZone(now, "Europe/Rome")).toBe(0);
  });

  it("somma giorni attraverso mesi, anni e cambio d'ora", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(diffDays("2026-10-24", "2026-10-26")).toBe(2);
    expect(diffDays("2026-11-20", "2026-11-19")).toBe(-1);
  });

  it("costruisce la settimana da lunedì a domenica", () => {
    expect(isoWeekday("2026-11-19")).toBe(4); // giovedì
    expect(isoWeekday("2026-11-22")).toBe(7); // domenica
    expect(weekOf("2026-11-19")).toEqual([
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
    ]);
    expect(weekOf("2026-11-22")[0]).toBe("2026-11-16");
  });
});

describe("periods", () => {
  it("propone gli schemi supportati", () => {
    expect(suggestedPeriods("trimestri", 2026)).toHaveLength(3);
    expect(suggestedPeriods("trimestre-pentamestre", 2026).map((p) => p.name)).toEqual(["Trimestre", "Pentamestre"]);
    expect(suggestedPeriods("quadrimestri", 2026)[1].start).toBe("2027-02-01");
  });

  const periods = suggestedPeriods("trimestre-pentamestre", 2026);

  it("trova il periodo corrente, anche durante le vacanze", () => {
    expect(currentPeriod(periods, "2026-11-19")?.id).toBe("p1");
    expect(currentPeriod(periods, "2026-12-28")?.id).toBe("p1");
    expect(currentPeriod(periods, "2027-03-01")?.id).toBe("p2");
    expect(currentPeriod(periods, "2026-08-01")?.id).toBe("p1");
    expect(currentPeriod([], "2026-11-19")).toBeNull();
  });
});

describe("tasks", () => {
  const today = "2026-11-19";
  const t = (id: string, kind: Task["kind"], due: string, extra: Partial<Task> = {}): Task => ({
    id,
    title: id,
    subjectId: "mat",
    kind,
    due,
    done: false,
    ...extra,
  });

  it("una verifica domani è più urgente di un compito domani", () => {
    expect(priorityScore(t("a", "test", "2026-11-20"), { today })).toBeGreaterThan(
      priorityScore(t("b", "homework", "2026-11-20"), { today }),
    );
  });

  it("le scadenze superate restano ad alta priorità", () => {
    expect(priorityOf(t("a", "homework", "2026-11-15"), { today })).toBe("high");
  });

  it("le materie in difficoltà alzano la priorità", () => {
    const task = t("a", "homework", "2026-11-25");
    const base = priorityScore(task, { today });
    const weak = priorityScore(task, { today, weakSubjectIds: new Set(["mat"]) });
    expect(weak).toBeGreaterThan(base);
  });

  it("i compiti completati hanno punteggio zero e spariscono dall'ordinamento", () => {
    const done = t("done", "test", "2026-11-20", { done: true });
    expect(priorityScore(done, { today })).toBe(0);
    const sorted = sortByPriority([t("far", "homework", "2026-12-10"), done, t("near", "test", "2026-11-20")], {
      today,
    });
    expect(sorted.map((x) => x.id)).toEqual(["near", "far"]);
  });

  it("elenca verifiche e interrogazioni future in ordine di data", () => {
    const list = upcomingAssessments(
      [
        t("hw", "homework", "2026-11-20"),
        t("past", "test", "2026-11-18"),
        t("oral", "oral", "2026-11-24"),
        t("test", "test", "2026-11-19"),
        t("late", "test", "2026-12-30"),
      ],
      today,
      14,
    );
    expect(list.map((x) => x.id)).toEqual(["test", "oral"]);
  });
});
