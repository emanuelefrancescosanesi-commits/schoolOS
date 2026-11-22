"use client";

import { AlignLeftIcon, CalendarIcon, ListChecksIcon, RepeatIcon, SchoolIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { Subject } from "@/lib/domain/model";
import { getMessages } from "@/lib/i18n";
import { dueLabel } from "@/lib/todo/format";
import { describeRecurrence } from "@/lib/todo/recurrence";
import type { TodoLabel, TodoPriority, TodoProject } from "@/lib/todo/types";
import type { TodoNode } from "@/lib/todo/views";
import { cn } from "@/lib/utils";

const t = getMessages().todo;

/** Colore del cerchio per priorità: oltre al colore, il nome è sempre nel testo accessibile. */
const PRIORITY_RING: Record<TodoPriority, string> = {
  1: "border-critical data-[state=checked]:bg-critical data-[state=checked]:border-critical",
  2: "border-warning data-[state=checked]:bg-warning data-[state=checked]:border-warning",
  3: "border-accent-text data-[state=checked]:bg-accent data-[state=checked]:border-accent",
  4: "border-muted/60",
};

const TONE: Record<string, string> = {
  overdue: "text-critical",
  today: "text-positive",
  soon: "text-warning",
  later: "text-muted",
};

export interface RowContext {
  today: string;
  subjects: ReadonlyMap<string, Subject>;
  projects: ReadonlyMap<string, TodoProject>;
  labels: ReadonlyMap<string, TodoLabel>;
  /** Mostra la lista di appartenenza (nelle viste che non sono già una lista). */
  showProject: boolean;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
}

export function TodoRow({ node, ctx, parentTitle }: { node: TodoNode; ctx: RowContext; parentTitle?: string }) {
  const { todo } = node;
  const done = todo.completedAt !== null;
  const subject = todo.subjectId ? ctx.subjects.get(todo.subjectId) : undefined;
  const project = ctx.showProject && todo.projectId ? ctx.projects.get(todo.projectId) : undefined;
  const labels = todo.labelIds.map((id) => ctx.labels.get(id)).filter((l): l is TodoLabel => !!l);
  const due = todo.due ? dueLabel(todo.due, todo.time, ctx.today, done) : null;

  return (
    <li className="group flex items-start gap-3 border-b border-border/60 py-2.5 last:border-b-0">
      <Checkbox
        checked={done}
        onCheckedChange={() => ctx.onToggle(todo.id)}
        aria-label={`${done ? t.markUndone(todo.title) : t.markDone(todo.title)}${todo.priority < 4 ? ` (${t.priorityName[todo.priority]})` : ""}`}
        className={cn("mt-0.5 size-5 rounded-full border-2", PRIORITY_RING[todo.priority])}
      />
      <button
        type="button"
        onClick={() => ctx.onOpen(todo.id)}
        className="min-w-0 flex-1 rounded-control text-left outline-offset-4"
      >
        {parentTitle && <span className="block truncate text-xs text-muted">{parentTitle}</span>}
        <span className={cn("block break-words text-sm font-medium", done && "text-muted line-through")}>{todo.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          {due && (
            <span className={cn("inline-flex items-center gap-1", !done && TONE[due.tone])}>
              <CalendarIcon className="size-3.5" aria-hidden />
              {due.text}
              {todo.recurrence && (
                <>
                  <RepeatIcon className="size-3.5" aria-hidden />
                  <span className="sr-only">{describeRecurrence(todo.recurrence)}</span>
                </>
              )}
            </span>
          )}
          {todo.priority < 4 && (
            <span className="font-medium" title={t.priorityName[todo.priority]}>
              P{todo.priority}
            </span>
          )}
          {subject && (
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full" style={{ backgroundColor: `var(--subject-${subject.color})` }} aria-hidden />
              {subject.name}
            </span>
          )}
          {project && (
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full" style={{ backgroundColor: `var(--subject-${project.color})` }} aria-hidden />
              {project.name}
            </span>
          )}
          {labels.map((l) => (
            <span key={l.id}>@{l.name}</span>
          ))}
          {node.children.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <ListChecksIcon className="size-3.5" aria-hidden />
              {t.subtasks(node.doneChildren, node.children.length)}
            </span>
          )}
          {todo.notes && <AlignLeftIcon className="size-3.5" aria-label="Con note" />}
          {todo.assignmentId && <SchoolIcon className="size-3.5" aria-label="Dalla scuola" />}
        </span>
      </button>
    </li>
  );
}
