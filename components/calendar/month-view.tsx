"use client";

import { ChevronLeftIcon, ChevronRightIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { addEvent, deleteEvent, updateEvent } from "@/app/(app)/calendar/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Field, FormMessage } from "@/components/ui/label";
import { monthGrid, shiftMonth, startOfMonth } from "@/lib/domain/calendar";
import type { DateKey } from "@/lib/domain/dates";
import { isoWeekday } from "@/lib/domain/dates";
import { eventsByDay } from "@/lib/domain/events";
import type { CalendarEvent, EventKind, Subject } from "@/lib/domain/model";
import type { Task } from "@/lib/domain/tasks";
import { capitalize, dayOfMonth, formatLongDay, formatMonthYear, formatWeekdayShort } from "@/lib/format";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { EVENT_KINDS, eventInputSchema } from "@/lib/validation/event";

const m = getMessages().calendarPage;
const KIND_DOT: Record<EventKind, string> = {
  test: "bg-critical",
  oral: "bg-warning",
  project: "bg-accent",
  homework: "bg-muted",
  event: "bg-positive",
};
const KIND_TONE = { test: "critical", oral: "warning", project: "accent", homework: "neutral", event: "positive" } as const;
// Lunedì 2026-11-02 come riferimento per le intestazioni dei giorni.
const WEEKDAYS = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"];

interface Props {
  tasks: Task[];
  events: CalendarEvent[];
  subjects: Subject[];
  today: DateKey;
  demo: boolean;
}

interface Item {
  id: string;
  title: string;
  kind: EventKind;
  time?: string;
  subjectId?: string;
  event?: CalendarEvent;
}

interface Draft {
  id: string | null; // null = nuovo impegno
  title: string;
  kind: EventKind;
  date: DateKey;
  time: string;
  subjectId: string;
  notes: string;
}

/** Calendario mensile con scadenze ed eventi: tocca un giorno per vedere cosa c'è, aggiungi o modifica. */
export function MonthView({ tasks, events, subjects, today, demo }: Props) {
  const [month, setMonth] = useState<DateKey>(startOfMonth(today));
  const [selected, setSelected] = useState<DateKey>(today);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Demo: nessun salvataggio, le modifiche restano nel browser. Live: i dati arrivano dal server.
  const [demoEvents, setDemoEvents] = useState<CalendarEvent[]>(events);
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const allEvents = useMemo(() => (demo ? demoEvents : events).filter((e) => !gone.has(e.id)), [demo, demoEvents, events, gone]);

  const byDay = useMemo(() => {
    const map = new Map<DateKey, Item[]>();
    const push = (date: DateKey, item: Item) => map.set(date, [...(map.get(date) ?? []), item]);
    for (const [date, list] of eventsByDay(allEvents)) {
      for (const e of list) push(date, { id: e.id, title: e.title, kind: e.kind, time: e.time, subjectId: e.subjectId, event: e });
    }
    for (const t of tasks) if (!t.done) push(t.due, { id: `task-${t.id}`, title: t.title, kind: t.kind, subjectId: t.subjectId });
    return map;
  }, [allEvents, tasks]);
  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const weeks = useMemo(() => monthGrid(month), [month]);
  const dayItems = byDay.get(selected) ?? [];

  const pick = (day: DateKey) => {
    setSelected(day);
    setDraft(null);
    setError(null);
  };
  const go = (delta: number) => {
    const next = shiftMonth(month, delta);
    setMonth(next);
    pick(next.slice(0, 7) === today.slice(0, 7) ? today : next);
  };
  const goToday = () => {
    setMonth(startOfMonth(today));
    pick(today);
  };

  const openNew = () => {
    setError(null);
    setDraft({ id: null, title: "", kind: "test", date: selected, time: "", subjectId: "", notes: "" });
  };
  const openEdit = (e: CalendarEvent) => {
    setError(null);
    setDraft({ id: e.id, title: e.title, kind: e.kind, date: e.date, time: e.time ?? "", subjectId: e.subjectId ?? "", notes: e.notes ?? "" });
  };
  const patch = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!draft) return;
    setError(null);
    const input = { title: draft.title, kind: draft.kind, starts_on: draft.date, starts_at: draft.time, subject_id: draft.subjectId, notes: draft.notes };
    const parsed = eventInputSchema.safeParse(input);
    if (!parsed.success) return setError(parsed.error.issues[0].message);

    const done = (date: DateKey) => {
      setDraft(null);
      setSelected(date);
      setMonth(startOfMonth(date));
    };
    if (demo) {
      const local: CalendarEvent = {
        id: draft.id ?? crypto.randomUUID(),
        title: parsed.data.title,
        kind: parsed.data.kind,
        date: parsed.data.starts_on,
        time: parsed.data.starts_at || undefined,
        subjectId: parsed.data.subject_id || undefined,
        notes: parsed.data.notes || undefined,
      };
      setDemoEvents((l) => (draft.id ? l.map((e) => (e.id === draft.id ? local : e)) : [...l, local]));
      return done(local.date);
    }
    start(async () => {
      const res = draft.id ? await updateEvent(draft.id, input) : await addEvent(input);
      if (!res.ok) return setError(res.error === "demo" ? m.errorSave : res.error);
      done(parsed.data.starts_on);
    });
  };

  const remove = (e: CalendarEvent) => {
    setError(null);
    if (demo) return setDemoEvents((l) => l.filter((x) => x.id !== e.id));
    setGone((s) => new Set(s).add(e.id));
    start(async () => {
      const res = await deleteEvent(e.id);
      if (!res.ok) {
        setGone((s) => {
          const n = new Set(s);
          n.delete(e.id);
          return n;
        });
        setError(res.error === "demo" ? m.errorDelete : res.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="icon" aria-label={m.prev} onClick={() => go(-1)}>
          <ChevronLeftIcon strokeWidth={1.5} aria-hidden />
        </Button>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-medium" aria-live="polite">
            {capitalize(formatMonthYear(month))}
          </h2>
          {(month !== startOfMonth(today) || selected !== today) && (
            <Button variant="secondary" size="sm" onClick={goToday}>
              {m.today}
            </Button>
          )}
        </div>
        <Button variant="ghost" size="icon" aria-label={m.next} onClick={() => go(1)}>
          <ChevronRightIcon strokeWidth={1.5} aria-hidden />
        </Button>
      </div>

      <Card className="p-2">
        <div role="group" aria-label={capitalize(formatMonthYear(month))} className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d) => (
            <div key={d} aria-hidden className="py-1 text-center text-xs font-medium text-muted">
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
                aria-pressed={isSelected}
                aria-label={`${formatLongDay(day)}${items.length ? `, ${m.count(items.length)}` : ""}`}
                onClick={() => pick(day)}
                className={cn(
                  "relative flex h-12 flex-col items-center justify-center gap-1 rounded-control text-sm transition-colors",
                  inMonth ? "text-fg" : "text-muted",
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
        <div className="flex items-center justify-between gap-2">
          <h3 id="day-title" className="text-sm font-medium text-muted">
            {capitalize(formatLongDay(selected))}
          </h3>
          {!draft && (
            <Button variant="secondary" size="sm" onClick={openNew}>
              <PlusIcon strokeWidth={1.5} aria-hidden /> {m.addButton}
            </Button>
          )}
        </div>
        {dayItems.length === 0 ? (
          <p className="rounded-card border border-border bg-surface p-4 text-sm text-muted">{m.nothing}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {dayItems.map((item) => {
              const s = item.subjectId ? subjectById.get(item.subjectId) : undefined;
              const body = (
                <>
                  <span className={cn("size-2.5 shrink-0 rounded-full", KIND_DOT[item.kind])} aria-hidden />
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="truncate text-xs text-muted">
                      {[item.time ?? (item.event ? m.allDay : m.fromTask), s?.name, item.event?.imported ? m.imported : undefined].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Badge tone={KIND_TONE[item.kind]}>{m.kinds[item.kind]}</Badge>
                </>
              );
              return (
                <li key={item.id}>
                  <Card className="flex-row items-center gap-1 p-1.5 pr-1.5">
                    {item.event && !item.event.imported ? (
                      <button
                        type="button"
                        onClick={() => openEdit(item.event!)}
                        aria-label={m.edit(item.title)}
                        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-control px-2 hover:bg-surface-2"
                      >
                        {body}
                      </button>
                    ) : item.event ? (
                      <div className="flex min-h-11 min-w-0 flex-1 items-center gap-3 px-2" title={m.importedHint}>
                        {body}
                      </div>
                    ) : (
                      <Link href="/tasks" className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-control px-2 hover:bg-surface-2">
                        {body}
                      </Link>
                    )}
                    {item.event && !item.event.imported && (
                      <Button variant="ghost" size="icon" aria-label={m.remove(item.title)} onClick={() => remove(item.event!)} disabled={pending}>
                        <Trash2Icon strokeWidth={1.5} aria-hidden />
                      </Button>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
        {error && !draft && <FormMessage tone="error">{error}</FormMessage>}
      </section>

      {draft && (
        <Card aria-labelledby="event-form-title">
          <CardHeader>
            {draft.id ? (
              <PencilIcon strokeWidth={1.5} className="size-4 text-muted" aria-hidden />
            ) : (
              <PlusIcon strokeWidth={1.5} className="size-4 text-muted" aria-hidden />
            )}
            <CardTitle id="event-form-title">{draft.id ? m.editTitle : m.addTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} noValidate className="flex flex-col gap-4">
              <Field label={m.titleLabel} htmlFor="ev-title">
                <Input id="ev-title" value={draft.title} onChange={(e) => patch({ title: e.target.value })} placeholder={m.titlePlaceholder} maxLength={140} autoFocus />
              </Field>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Field label={m.kind} htmlFor="ev-kind">
                  <Select id="ev-kind" value={draft.kind} onChange={(e) => patch({ kind: e.target.value as EventKind })}>
                    {EVENT_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {m.kinds[k]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={m.date} htmlFor="ev-date">
                  <Input id="ev-date" type="date" value={draft.date} onChange={(e) => patch({ date: e.target.value })} />
                </Field>
                <Field label={m.time} htmlFor="ev-time">
                  <Input id="ev-time" type="time" value={draft.time} onChange={(e) => patch({ time: e.target.value })} />
                </Field>
                <Field label={m.subject} htmlFor="ev-subject">
                  <Select id="ev-subject" value={draft.subjectId} onChange={(e) => patch({ subjectId: e.target.value })}>
                    <option value="">{m.noSubject}</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label={m.notes} htmlFor="ev-notes">
                <Input id="ev-notes" value={draft.notes} onChange={(e) => patch({ notes: e.target.value })} maxLength={500} />
              </Field>
              {error && <FormMessage tone="error">{error}</FormMessage>}
              <div className="flex gap-2">
                <Button type="submit" variant="primary" disabled={pending}>
                  {draft.id ? m.save : m.add}
                </Button>
                <Button variant="ghost" onClick={() => setDraft(null)}>
                  {m.cancel}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
