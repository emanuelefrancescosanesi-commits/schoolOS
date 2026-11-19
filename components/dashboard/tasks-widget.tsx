"use client";

import { CircleCheckBigIcon, ListChecksIcon } from "lucide-react";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import type { TaskRow } from "@/lib/dashboard/view-model";
import type { Priority } from "@/lib/domain/tasks";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { EmptyState, SubjectDot, WidgetCard } from "./widget-card";

const PRIORITY_STYLE: Record<Priority, string> = {
  high: "bg-critical",
  medium: "bg-warning",
  low: "bg-muted/50",
};

const VISIBLE = 6;

/**
 * Compiti aperti in ordine di priorità. In demo lo stato "fatto" vive solo
 * nella pagina; con Supabase diventerà un'azione server con aggiornamento ottimistico.
 */
export function TasksWidget({ rows }: { rows: TaskRow[] }) {
  const m = getMessages();
  const t = m.dashboard.tasks;
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const visible = rows.slice(0, VISIBLE);

  const toggle = (id: string, checked: boolean) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <WidgetCard
      id="tasks"
      title={m.dashboard.widgets.tasks}
      icon={ListChecksIcon}
      href="/tasks"
      action={
        done.size > 0 ? (
          <span className="text-xs text-positive" aria-live="polite">
            {t.completed(done.size)}
          </span>
        ) : null
      }
    >
      {visible.length === 0 ? (
        <EmptyState icon={CircleCheckBigIcon}>{t.empty}</EmptyState>
      ) : (
        <ul className="flex flex-col">
          {visible.map(({ task, subject, priority, daysLeft }) => {
            const isDone = done.has(task.id);
            const inputId = `task-${task.id}`;
            return (
              <li key={task.id} className="flex items-start gap-3 py-2">
                <Checkbox
                  id={inputId}
                  className="mt-0.5"
                  checked={isDone}
                  onCheckedChange={(v) => toggle(task.id, v === true)}
                  aria-label={isDone ? t.markUndone(task.title) : t.markDone(task.title)}
                />
                <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
                  <span
                    className={cn(
                      "block truncate text-sm transition-colors",
                      isDone ? "text-muted line-through" : "text-fg",
                    )}
                  >
                    {task.title}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    {subject && <SubjectDot color={subject.color} />}
                    <span className="truncate">{subject?.name}</span>
                    <span aria-hidden>·</span>
                    <span className={cn("shrink-0", daysLeft < 0 && !isDone && "font-medium text-critical")}>
                      {daysLeft < 0 ? t.overdue : m.common.inDays(daysLeft)}
                    </span>
                    {task.estimatedMinutes ? (
                      <>
                        <span aria-hidden>·</span>
                        <span className="shrink-0">{m.common.minutes(task.estimatedMinutes)}</span>
                      </>
                    ) : null}
                  </span>
                </label>
                <span className="mt-1.5 flex shrink-0 items-center gap-1.5 text-xs text-muted">
                  <span aria-hidden className={cn("size-1.5 rounded-full", PRIORITY_STYLE[priority])} />
                  <span className="hidden sm:inline">{t.priority[priority]}</span>
                  <span className="sr-only sm:hidden">{t.priority[priority]}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}
