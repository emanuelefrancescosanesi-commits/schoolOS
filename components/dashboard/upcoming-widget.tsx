import { CalendarCheckIcon, CalendarClockIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TaskRow } from "@/lib/dashboard/view-model";
import { dayOfMonth, formatWeekdayShort } from "@/lib/format";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { EmptyState, SubjectDot, WidgetCard } from "./widget-card";

export function UpcomingWidget({ rows }: { rows: TaskRow[] }) {
  const m = getMessages();
  const t = m.dashboard.upcoming;

  return (
    <WidgetCard id="upcoming" title={m.dashboard.widgets.upcoming} icon={CalendarClockIcon} href="/calendar">
      {rows.length === 0 ? (
        <EmptyState icon={CalendarCheckIcon}>{t.empty}</EmptyState>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.slice(0, 5).map(({ task, subject, daysLeft }) => {
            const soon = daysLeft <= 2;
            return (
              <li key={task.id} className="flex items-center gap-3 rounded-control py-1.5">
                <div
                  className={cn(
                    "flex size-11 shrink-0 flex-col items-center justify-center rounded-control border",
                    soon ? "border-transparent bg-warning-soft text-warning" : "border-border text-fg",
                  )}
                >
                  <span className="text-[11px] leading-none uppercase">{formatWeekdayShort(task.due)}</span>
                  <span className="tabular text-base leading-tight font-medium">{dayOfMonth(task.due)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{task.title}</p>
                  <p className="flex items-center gap-1.5 text-xs text-muted">
                    {subject && <SubjectDot color={subject.color} />}
                    <span className="truncate">{subject?.name}</span>
                    <span aria-hidden>·</span>
                    <span className="shrink-0">{t.kind[task.kind]}</span>
                  </p>
                </div>
                <Badge tone={soon ? "warning" : "neutral"} className="shrink-0">
                  {m.common.inDays(daysLeft)}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}
