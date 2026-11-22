import { describe, expect, it } from "vitest";
import { buildReminders } from "./reminders";
import type { Task, TaskKind } from "./tasks";

const t = (id: string, kind: TaskKind, due: string, done = false): Task => ({ id, title: id, subjectId: "", kind, due, done });
const today = "2026-11-23";

describe("promemoria", () => {
  it("classifica e ordina per urgenza", () => {
    const res = buildReminders(
      [
        t("domani", "homework", "2026-11-24"),
        t("verifica", "test", "2026-11-26"),
        t("oggi", "homework", "2026-11-23"),
        t("scaduto", "homework", "2026-11-20"),
        t("lontano", "homework", "2026-12-10"),
        t("fatto", "homework", "2026-11-20", true),
        t("verifica-lontana", "test", "2026-11-28"),
      ],
      today,
    );
    expect(res.map((r) => [r.task.id, r.type])).toEqual([
      ["scaduto", "overdue"],
      ["oggi", "today"],
      ["verifica", "soon-test"],
      ["domani", "tomorrow"],
    ]);
  });

  it("una verifica domani è 'soon-test', non 'tomorrow'", () => {
    expect(buildReminders([t("v", "oral", "2026-11-24")], today)[0].type).toBe("soon-test");
  });
});
