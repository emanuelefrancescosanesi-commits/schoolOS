import { describe, expect, it } from "vitest";
import { DEFAULT_NOTIFICATIONS } from "./model";
import { buildReminders } from "./reminders";
import type { Task, TaskKind } from "./tasks";

const t = (id: string, kind: TaskKind, due: string): Task => ({ id, title: id, subjectId: "", kind, due, done: false });
const today = "2026-11-23";
const tasks = [
  t("scaduto", "homework", "2026-11-20"),
  t("oggi", "homework", "2026-11-23"),
  t("domani", "homework", "2026-11-24"),
  t("verifica", "test", "2026-11-26"),
  t("verifica-lontana", "test", "2026-12-01"),
];
const ids = (prefs = DEFAULT_NOTIFICATIONS) => buildReminders(tasks, today, prefs).map((r) => r.task.id);

describe("promemoria con preferenze", () => {
  it("senza preferenze esplicite usa quelle predefinite", () => {
    expect(buildReminders(tasks, today).map((r) => r.task.id)).toEqual(ids());
  });
  it("si può togliere solo gli scaduti", () => {
    expect(ids({ ...DEFAULT_NOTIFICATIONS, overdue: false })).toEqual(["oggi", "verifica", "domani"]);
  });
  it("si possono togliere le scadenze di oggi e domani senza toccare le verifiche", () => {
    expect(ids({ ...DEFAULT_NOTIFICATIONS, dueSoon: false })).toEqual(["scaduto", "verifica"]);
  });
  it("si possono togliere le verifiche", () => {
    expect(ids({ ...DEFAULT_NOTIFICATIONS, tests: false })).toEqual(["scaduto", "oggi", "domani"]);
  });
  it("l'anticipo delle verifiche è configurabile", () => {
    expect(ids({ ...DEFAULT_NOTIFICATIONS, testDays: 14 })).toContain("verifica-lontana");
    expect(ids({ ...DEFAULT_NOTIFICATIONS, testDays: 1 })).not.toContain("verifica");
  });
  it("una verifica di oggi segue la preferenza delle verifiche, non quella dei compiti", () => {
    const only = [t("v", "test", today)];
    expect(buildReminders(only, today, { ...DEFAULT_NOTIFICATIONS, dueSoon: false })).toHaveLength(1);
    expect(buildReminders(only, today, { ...DEFAULT_NOTIFICATIONS, tests: false })).toHaveLength(0);
  });
  it("tutto spento: nessun promemoria", () => {
    expect(ids({ overdue: false, dueSoon: false, tests: false, testDays: 3 })).toEqual([]);
  });
});
