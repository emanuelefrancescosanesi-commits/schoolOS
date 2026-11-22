"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { monthGrid, shiftMonth, startOfMonth } from "@/lib/domain/calendar";
import type { DateKey } from "@/lib/domain/dates";
import { isoWeekday } from "@/lib/domain/dates";
import type { Subject } from "@/lib/domain/model";
import type { Task, TaskKind } from "@/lib/domain/tasks";
import { capitalize, dayOfMonth, formatLongDay, formatMonthYear, formatWeekdayShort } from "@/lib/format";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const m = getMessages().calendarPage;
const KIND_DOT: Record<TaskKind, string> = {
  test: "bg-critical",
  oral: "bg-warning",
  project: "bg-accent",
  homework: "bg-muted",
};
// Lunedì 2026-11-02 come riferimento per le intestazioni dei giorni.
const WEEKDAYS = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"];

/** Calendario mensile con le scadenze: tocca un giorno per vedere cosa c'è. */
export function MonthView({ tasks, subjects, today }: { tasks: Task[]; subjects: Subject[]; today: DateKey }) {
  const [month, setMonth] = useState<DateKey>(startOfMonth(today));
  const [selected, setSelected] = useState<DateKey>(today);

  const byDay = useMemo(() => {
    const map = new Map<DateKey, Task[]>();
    for (const t of tasks) if (!t.done) map.set(t.due, [...(map.get(t.due) ?? []), t]);
    return map;
  }, [tasks]);
  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const weeks = useMemo(() => monthGrid(month), [month]);
  const dayTasks = byDay.get(selected) ?? [];

  const go = (delta: number) => {
    const next = shiftMonth(month, delta);
    setMonth(next);
    setSelected(next.slice(0, 7) === today.slice(0, 7) ? today : next);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" aria-label={m.prev} onClick={() => go(-1)}>
          <ChevronLeftIcon strokeWidth={1.5} aria-hidden />
        </Button>
        <h2 className="text-lg font-medium" aria-live="polite">
          {capitalize(formatMonthYear(month))}
        </h2>
        <Button variant="ghost" aria-label={m.next} onClick={() => go(1)}>
          <ChevronRightIcon strokeWidth={1.5} aria-hidden />
        </Button>
      </div>

      <Card className="p-2">
        <div role="grid" aria-label={capitalize(formatMonthYear(month))} className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d) => (
            <div key={d} role="columnheader" className="py-1 text-center text-xs font-medium text-muted">
              {capitalize(formatWeekdayShort(d))}
            </div>
          ))}
          {weeks.flat().map((day) => {
            const items = byDay.get(day) ?? [];
            const inMonth = day.slice(0, 7) === month.slice(0, 7);
            const isSelected = day === selected;
            const kinds = [...new Set(items.map((t) => t.kind))].slice(0, 3);
            return (
              <button
                key={day}
                type="button"
                role="gridcell"
                aria-selected={isSelected}
                aria-label={`${formatLongDay(day)}${items.length ? `, ${m.count(items.length)}` : ""}`}
                onClick={() => setSelected(day)}
                className={cn(
                  "relative flex h-12 flex-col items-center justify-center gap-1 rounded-control text-sm transition-colors",
                  inMonth ? "text-fg" : "text-muted/50",
                  isSelected ? "bg-accent text-accent-fg" : "hover:bg-surface-2",
                  day === today && !isSelected && "ring-1 ring-accent",
                  isoWeekday(day) >= 6 && !isSelected && "text-muted",
                )}
              >
                <span>{dayOfMonth(day)}</span>
                <span className="flex h-1.5 gap-0.5" aria-hidden>
                  {kinds.map((k) => (
                    <span key={k} className={cn("size-1.5 rounded-full", isSelected ? "bg-accent-fg" : KIND_DOT[k])} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <section aria-labelledby="day-title" className="flex flex-col gap-2">
        <h3 id="day-title" className="text-sm font-medium text-muted">
          {capitalize(formatLongDay(selected))}
        </h3>
        {dayTasks.length === 0 ? (
          <p className="rounded-card border border-border bg-surface p-4 text-sm text-muted">{m.nothing}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {dayTasks.map((t) => {
              const s = subjectById.get(t.subjectId);
              return (
                <li key={t.id}>
                  <Card className="flex-row items-center gap-3 p-3">
                    <span className={cn("size-2.5 shrink-0 rounded-full", KIND_DOT[t.kind])} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      {s && <p className="text-xs text-muted">{s.name}</p>}
                    </div>
                    <Badge tone={t.kind === "test" ? "critical" : t.kind === "oral" ? "warning" : "neutral"}>{m.kinds[t.kind]}</Badge>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
