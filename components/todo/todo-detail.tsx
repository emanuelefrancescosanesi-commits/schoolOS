"use client";

import { PlusIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { addDays, isoWeekday } from "@/lib/domain/dates";
import type { Subject } from "@/lib/domain/model";
import { getMessages } from "@/lib/i18n";
import { describeRecurrence } from "@/lib/todo/recurrence";
import type { Recurrence, Todo, TodoLabel, TodoPriority, TodoProject } from "@/lib/todo/types";
import { PRIORITIES } from "@/lib/todo/types";
import { cn } from "@/lib/utils";
import type { NewTodoInput, useTodoStore } from "./use-todo-store";

const t = getMessages().todo.detail;
const common = getMessages().common;
const tt = getMessages().todo;

type Store = ReturnType<typeof useTodoStore>;

const PRESETS: ReadonlyArray<{ key: string; label: string; rule: Recurrence }> = [
  { key: "day", label: t.repeatOptions.day, rule: { freq: "day", interval: 1 } },
  { key: "weekdays", label: t.repeatOptions.weekdays, rule: { freq: "week", interval: 1, weekdays: [1, 2, 3, 4, 5] } },
  { key: "week", label: t.repeatOptions.week, rule: { freq: "week", interval: 1 } },
  { key: "biweek", label: t.repeatOptions.biweek, rule: { freq: "week", interval: 2 } },
  { key: "month", label: t.repeatOptions.month, rule: { freq: "month", interval: 1 } },
];

const PRIORITY_STYLE: Record<TodoPriority, string> = {
  1: "data-[on=true]:border-critical data-[on=true]:bg-critical-soft data-[on=true]:text-critical",
  2: "data-[on=true]:border-warning data-[on=true]:bg-warning-soft data-[on=true]:text-warning",
  3: "data-[on=true]:border-accent-text data-[on=true]:bg-accent-soft data-[on=true]:text-accent-text",
  4: "data-[on=true]:border-muted data-[on=true]:bg-surface-2 data-[on=true]:text-fg",
};

function ruleKey(rule: Recurrence | null): string {
  if (!rule) return "";
  const text = JSON.stringify(rule);
  return PRESETS.find((p) => JSON.stringify(p.rule) === text)?.key ?? "custom";
}

interface Props {
  todo: Todo | null;
  onClose: () => void;
  store: Store;
  today: string;
  projects: readonly TodoProject[];
  subjects: readonly Subject[];
  labels: readonly TodoLabel[];
  subtasks: readonly Todo[];
}

/** Pannello di modifica: dal basso su telefono, laterale su PC. Ogni modifica si salva subito. */
export function TodoDetail({ todo, onClose, store, today, projects, subjects, labels, subtasks }: Props) {
  return (
    <Sheet open={todo !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        closeLabel={common.close}
        className="px-4 pt-5 pb-6 md:inset-x-auto md:top-0 md:right-0 md:bottom-0 md:max-h-none md:w-[26rem] md:rounded-none md:border-t-0 md:border-l md:data-[state=closed]:slide-out-to-right md:data-[state=open]:slide-in-from-right"
        aria-describedby="todo-detail-desc"
      >
        <SheetTitle className="pr-10 text-base font-semibold">{t.title}</SheetTitle>
        <SheetDescription id="todo-detail-desc" className="sr-only">
          {todo?.title}
        </SheetDescription>
        {todo && (
          <Body
            key={todo.id}
            todo={todo}
            onClose={onClose}
            store={store}
            today={today}
            projects={projects}
            subjects={subjects}
            labels={labels}
            subtasks={subtasks}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Body({ todo, onClose, store, today, projects, subjects, labels, subtasks }: Omit<Props, "todo"> & { todo: Todo }) {
  const [title, setTitle] = useState(todo.title);
  const [notes, setNotes] = useState(todo.notes ?? "");
  const [subtask, setSubtask] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isSub = todo.parentId !== null;
  const done = todo.completedAt !== null;

  const patch = (p: Parameters<Store["update"]>[1]) => void store.update(todo.id, p);
  const labelNames = todo.labelIds.map((id) => labels.find((l) => l.id === id)?.name).filter((n): n is string => !!n);
  const toggleLabel = (name: string) =>
    patch({ labels: labelNames.some((n) => n.toLowerCase() === name.toLowerCase()) ? labelNames.filter((n) => n.toLowerCase() !== name.toLowerCase()) : [...labelNames, name] });

  const nextMonday = addDays(today, ((8 - isoWeekday(today)) % 7) || 7);
  // Se il prossimo lunedì è già domani (si è di domenica) il suggerimento sarebbe doppio.
  const quickDates: ReadonlyArray<[string, string]> = [
    [t.today, today],
    [t.tomorrow, addDays(today, 1)],
    ...(nextMonday === addDays(today, 1) ? [] : ([[t.nextWeek, nextMonday]] as Array<[string, string]>)),
  ];
  const key = ruleKey(todo.recurrence);

  return (
    <div className="mt-4 flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <Checkbox
          checked={done}
          onCheckedChange={() => void store.toggle(todo.id)}
          aria-label={done ? tt.markUndone(todo.title) : tt.markDone(todo.title)}
          className="mt-2.5 size-5 rounded-full border-2"
        />
        <div className="flex-1">
          <Label htmlFor="todo-title" className="sr-only">
            {t.titleLabel}
          </Label>
          <Input
            id="todo-title"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title.trim() !== todo.title && patch({ title })}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="font-medium"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="todo-notes">{t.notes}</Label>
        <textarea
          id="todo-notes"
          value={notes}
          maxLength={4000}
          rows={3}
          placeholder={t.notesPlaceholder}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== (todo.notes ?? "") && patch({ notes: notes.trim() ? notes : null })}
          className="min-h-20 w-full resize-y rounded-control border border-border bg-surface p-3 text-sm text-fg placeholder:text-muted/80 hover:border-muted/50 focus-visible:border-accent-text"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="todo-due">{t.date}</Label>
        <div className="flex flex-wrap gap-2">
          {quickDates.map(([label, date]) => (
            <Button key={label} size="sm" variant={todo.due === date ? "primary" : "secondary"} onClick={() => patch({ due: date })}>
              {label}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => patch({ due: null })} disabled={!todo.due}>
            {t.noDate}
          </Button>
        </div>
        <div className="flex gap-2">
          <Input id="todo-due" type="date" value={todo.due ?? ""} onChange={(e) => patch({ due: e.target.value || null })} aria-label={t.date} className="flex-1" />
          <Input
            type="time"
            value={todo.time ?? ""}
            onChange={(e) => patch({ time: e.target.value || null })}
            disabled={!todo.due}
            aria-label={t.time}
            className="w-32"
          />
        </div>
      </div>

      {!isSub && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="todo-repeat">{t.repeat}</Label>
          <Select
            id="todo-repeat"
            value={key}
            disabled={!todo.due}
            onChange={(e) => patch({ recurrence: PRESETS.find((p) => p.key === e.target.value)?.rule ?? null })}
          >
            <option value="">{t.repeatNone}</option>
            {PRESETS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
            {key === "custom" && todo.recurrence && <option value="custom">{describeRecurrence(todo.recurrence)}</option>}
          </Select>
          {!todo.due && <p className="text-xs text-muted">{t.repeatNeedsDate}</p>}
        </div>
      )}

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">{t.priority}</legend>
        <div className="grid grid-cols-4 gap-2">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              data-on={todo.priority === p}
              aria-pressed={todo.priority === p}
              onClick={() => patch({ priority: p })}
              className={cn(
                "h-9 pointer-coarse:h-11 rounded-control border border-border text-sm transition-colors hover:bg-surface-2",
                PRIORITY_STYLE[p],
              )}
            >
              P{p}
              <span className="sr-only"> {tt.priorityName[p]}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        {!isSub && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="todo-project">{t.list}</Label>
            <Select id="todo-project" value={todo.projectId ?? ""} onChange={(e) => patch({ projectId: e.target.value || null })}>
              <option value="">{t.listNone}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="todo-subject">{t.subject}</Label>
          <Select id="todo-subject" value={todo.subjectId ?? ""} onChange={(e) => patch({ subjectId: e.target.value || null })}>
            <option value="">{t.subjectNone}</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t.labels}</span>
        <div className="flex flex-wrap gap-2">
          {labels.map((l) => {
            const on = todo.labelIds.includes(l.id);
            return (
              <button
                key={l.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleLabel(l.name)}
                className={cn(
                  "h-8 pointer-coarse:h-11 rounded-full border px-3 text-xs",
                  on ? "border-accent-text bg-accent-soft font-medium text-accent-text" : "border-border text-muted hover:bg-surface-2",
                )}
              >
                @{l.name}
              </button>
            );
          })}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = newLabel.trim().replace(/^@/, "").replace(/\s+/g, "-");
            if (!name) return;
            if (!labelNames.some((n) => n.toLowerCase() === name.toLowerCase())) patch({ labels: [...labelNames, name].slice(0, 8) });
            setNewLabel("");
          }}
        >
          <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} maxLength={30} placeholder={t.newLabel} aria-label={t.newLabel} />
          <Button type="submit" variant="secondary" size="icon" aria-label={t.addLabel}>
            <PlusIcon aria-hidden />
          </Button>
        </form>
      </div>

      {!isSub && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t.subtasks}</span>
          <ul className="flex flex-col">
            {subtasks.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-1.5">
                <Checkbox
                  checked={s.completedAt !== null}
                  onCheckedChange={() => void store.toggle(s.id)}
                  aria-label={s.completedAt ? tt.markUndone(s.title) : tt.markDone(s.title)}
                  className="size-[18px] rounded-full border-2"
                />
                <span className={cn("min-w-0 flex-1 break-words text-sm", s.completedAt && "text-muted line-through")}>{s.title}</span>
                <Button variant="ghost" size="icon-sm" onClick={() => void store.remove(s.id)} aria-label={`${t.delete}: ${s.title}`}>
                  <TrashIcon aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const text = subtask.trim();
              if (!text) return;
              setSubtask("");
              const input: NewTodoInput = { title: text, parentId: todo.id, due: null };
              void store.addTodo(input);
            }}
          >
            <Input value={subtask} onChange={(e) => setSubtask(e.target.value)} maxLength={200} placeholder={t.subtaskPlaceholder} aria-label={t.addSubtask} />
            <Button type="submit" variant="secondary" size="icon" aria-label={t.addSubtask}>
              <PlusIcon aria-hidden />
            </Button>
          </form>
        </div>
      )}

      {todo.assignmentId && <p className="rounded-control bg-surface-2 p-3 text-xs text-muted">{t.fromSchool}</p>}

      <div className="border-t border-border pt-4">
        {confirmDelete ? (
          <div className="flex gap-2">
            <Button
              variant="primary"
              className="bg-critical hover:bg-critical/90"
              onClick={() => {
                void store.remove(todo.id);
                onClose();
              }}
            >
              <TrashIcon aria-hidden />
              {t.deleteConfirm}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              {tt.cancel}
            </Button>
          </div>
        ) : (
          <Button variant="ghost" className="text-critical hover:text-critical" onClick={() => setConfirmDelete(true)}>
            <TrashIcon aria-hidden />
            {t.delete}
          </Button>
        )}
      </div>
    </div>
  );
}
