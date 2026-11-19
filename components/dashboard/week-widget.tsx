"use client";

import { CalendarDaysIcon, CalendarOffIcon } from "lucide-react";
import { useState } from "react";
import type { DayCell } from "@/lib/dashboard/view-model";
import { capitalize, dayOfMonth, formatLongDay, formatWeekdayShort } from "@/lib/format";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { EmptyState, SubjectDot, WidgetCard } from "./widget-card";

const KIND_DOT: Record<DayCell["items"][number]["kind"], string> = {
  test: "bg-critical",
  oral: "bg-warning",
  project: "bg-accent-text",
  homework: "bg-muted",
  event: "bg-positive",
};

export function WeekWidget({ week }: { week: DayCell[] }) {
  const m = getMessages();
  const t = m.dashboard.week;
  const todayIndex = Math.max(
    0,
    week.findIndex((d) => d.isToday),
  );
  const [selected, setSelected] = useState(todayIndex);
  const day = week[selected];

  return (
    <WidgetCard id="week" title={m.dashboard.widgets.week} icon={CalendarDaysIcon} href="/calendar">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-7 gap-1" role="group" aria-label={m.dashboard.widgets.week}>
          {week.map((d, i) => {
            const isSelected = i === selected;
            return (
              <button
                key={d.date}
                type="button"
                onClick={() => setSelected(i)}
                aria-pressed={isSelected}
                aria-label={`${capitalize(formatLongDay(d.date))}, ${t.events(d.items.length)}`}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-control py-2 transition-colors duration-150",
                  isSelected ? "bg-accent text-accent-fg" : "hover:bg-surface-2",
                  !isSelected && d.isToday && "text-accent-text",
                )}
              >
                <span className={cn("text-[11px] uppercase", !isSelected && !d.isToday && "text-muted")}>
                  {formatWeekdayShort(d.date)}
                </span>
                <span className="tabular text-base font-medium">{dayOfMonth(d.date)}</span>
                <span className="flex h-1.5 gap-0.5" aria-hidden>
                  {d.items.slice(0, 3).map((item) => (
                    <span
                      key={item.id}
                      className={cn("size-1.5 rounded-full", isSelected ? "bg-accent-fg/80" : KIND_DOT[item.kind])}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        <div aria-live="polite">
          <h3 className="mb-2 text-xs font-medium text-muted">{capitalize(formatLongDay(day.date))}</h3>
          {day.items.length === 0 ? (
            <EmptyState icon={CalendarOffIcon}>{t.empty}</EmptyState>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {day.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-control border border-border bg-surface-2/40 px-3 py-2"
                >
                  <span aria-hidden className={cn("h-6 w-1 shrink-0 rounded-full", KIND_DOT[item.kind])} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{item.title}</span>
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      {item.subject && (
                        <>
                          <SubjectDot color={item.subject.color} />
                          {item.subject.name}
                          <span aria-hidden>·</span>
                        </>
                      )}
                      {item.kind === "event" ? m.nav.calendar : m.dashboard.upcoming.kind[item.kind]}
                    </span>
                  </span>
                  {item.time && <span className="tabular shrink-0 text-xs text-muted">{item.time}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </WidgetCard>
  );
}
