"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { addTask, deleteTask, setTaskDone } from "@/app/(app)/tasks/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Select } from "@/components/ui/input";
import { Field, FormMessage } from "@/components/ui/label";
import { type DateKey, addDays, diffDays } from "@/lib/domain/dates";
import type { Subject } from "@/lib/domain/model";
import { groupTasks } from "@/lib/domain/task-groups";
import { type Task, type TaskKind, priorityOf } from "@/lib/domain/tasks";
import { formatDayMonth } from "@/lib/format";
import { getMessages } from "@/lib/i18n";
import { taskInputSchema } from "@/lib/validation/task";

const m = getMessages().tasksPage;
const KINDS: TaskKind[] = ["homework", "test", "oral", "project"];

interface Props {
  tasks: Task[];
  subjects: Subject[];
  today: DateKey;
  demo: boolean;
}

/** Compiti, verifiche e interrogazioni: aggiungi in pochi secondi, spunta, elimina. */
export function TaskBoard({ tasks, subjects, today, demo }: Props) {
  const [demoTasks, setDemoTasks] = useState<Task[]>([]);
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [kind, setKind] = useState<TaskKind>("homework");
  const [due, setDue] = useState<DateKey>(addDays(today, 1));

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const all = useMemo(() => [...tasks, ...demoTasks].filter((t) => !gone.has(t.id)), [tasks, demoTasks, gone]);
  const groups = useMemo(() => groupTasks(all, { today }), [all, today]);

  const hide = (id: string) => setGone((s) => new Set(s).add(id));
  const show = (id: string) =>
    setGone((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const input = { title, subject_id: subjectId, kind, due_on: due };
    const parsed = taskInputSchema.safeParse(input);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    const reset = () => {
      setTitle("");
      setError(null);
    };
    if (demo) {
      setDemoTasks((l) => [...l, { id: crypto.randomUUID(), title: parsed.data.title, subjectId, kind, due, done: false }]);
      return reset();
    }
    start(async () => {
      const res = await addTask(input);
      if (!res.ok) return setError(res.error === "demo" ? m.errorSave : res.error);
      reset();
    });
  };

  const complete = (task: Task) => {
    hide(task.id);
    if (demo) return;
    start(async () => {
      const res = await setTaskDone(task.id, true);
      if (!res.ok) {
        show(task.id);
        setError(res.error);
      }
    });
  };

  const remove = (task: Task) => {
    hide(task.id);
    if (demo) return;
    start(async () => {
      const res = await deleteTask(task.id);
      if (!res.ok) {
        show(task.id);
        setError(res.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card aria-labelledby="task-add-title">
        <CardHeader>
          <PlusIcon strokeWidth={1.5} className="size-4 text-muted" aria-hidden />
          <CardTitle id="task-add-title">{m.addTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <Field label={m.titleLabel} htmlFor="t-title">
              <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={m.titlePlaceholder} maxLength={140} />
            </Field>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Field label={m.subject} htmlFor="t-subject">
                <Select id="t-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                  <option value="">{m.noSubject}</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={m.kind} htmlFor="t-kind">
                <Select id="t-kind" value={kind} onChange={(e) => setKind(e.target.value as TaskKind)}>
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {m.kinds[k]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={m.due} htmlFor="t-due" className="col-span-2 md:col-span-1">
                <Input id="t-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              </Field>
            </div>
            {error && <FormMessage tone="error">{error}</FormMessage>}
            <div>
              <Button type="submit" variant="primary" disabled={pending}>
                <PlusIcon strokeWidth={1.5} aria-hidden /> {m.add}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {groups.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-6 text-center text-sm text-muted">{m.empty}</p>
      ) : (
        groups.map((g) => (
          <section key={g.key} aria-labelledby={`g-${g.key}`} className="flex flex-col gap-2">
            <h2 id={`g-${g.key}`} className={g.key === "overdue" ? "text-sm font-medium text-critical" : "text-sm font-medium text-muted"}>
              {m.groups[g.key]} · {g.tasks.length}
            </h2>
            <ul className="flex flex-col gap-2">
              {g.tasks.map((task) => {
                const subject = subjectById.get(task.subjectId);
                const priority = priorityOf(task, { today });
                const days = diffDays(today, task.due);
                return (
                  <li key={task.id}>
                    <Card className="flex-row items-center gap-3 p-3">
                      <Checkbox aria-label={getMessages().dashboard.tasks.markDone(task.title)} checked={false} onCheckedChange={() => complete(task)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{task.title}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                          {subject && (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="size-2 rounded-full" style={{ backgroundColor: `var(--subject-${subject.color})` }} aria-hidden />
                              {subject.name}
                            </span>
                          )}
                          <span>{formatDayMonth(task.due)}</span>
                          {days < 0 && <Badge tone="critical">{m.overdueBy(-days)}</Badge>}
                          {task.kind !== "homework" && <Badge tone={task.kind === "project" ? "neutral" : "accent"}>{m.kinds[task.kind]}</Badge>}
                          {priority === "high" && days >= 0 && <Badge tone="warning">{m.priorityHigh}</Badge>}
                        </p>
                      </div>
                      <Button variant="ghost" aria-label={m.remove(task.title)} onClick={() => remove(task)}>
                        <Trash2Icon strokeWidth={1.5} aria-hidden />
                      </Button>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

