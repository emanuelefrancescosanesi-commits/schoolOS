import { describe, expect, it } from "vitest";
import { groupKeyFor, groupTasks } from "./task-groups";
import type { Task } from "./tasks";

const today = "2026-11-20";
const t = (id: string, due: string, kind: Task["kind"] = "homework", done = false): Task => ({ id, title: id, subjectId: "s", kind, due, done });

describe("groupKeyFor", () => {
  it("assegna la fascia dalla distanza in giorni", () => {
    expect(groupKeyFor("2026-11-19", today)).toBe("overdue");
    expect(groupKeyFor("2026-11-20", today)).toBe("today");
    expect(groupKeyFor("2026-11-21", today)).toBe("tomorrow");
    expect(groupKeyFor("2026-11-27", today)).toBe("week");
    expect(groupKeyFor("2026-11-28", today)).toBe("later");
  });
});

describe("groupTasks", () => {
  it("omette i completati e le fasce vuote, in ordine di urgenza", () => {
    const groups = groupTasks([t("a", "2026-12-10"), t("b", "2026-11-18"), t("c", "2026-11-21", "homework", true), t("d", "2026-11-20")], { today });
    expect(groups.map((g) => g.key)).toEqual(["overdue", "today", "later"]);
  });
  it("nella stessa data mette prima la verifica del compito", () => {
    const [g] = groupTasks([t("compito", "2026-11-21"), t("verifica", "2026-11-21", "test")], { today });
    expect(g.tasks.map((x) => x.id)).toEqual(["verifica", "compito"]);
  });
});
