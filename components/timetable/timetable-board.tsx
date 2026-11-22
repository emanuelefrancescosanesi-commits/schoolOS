"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { addSlot, deleteSlot } from "@/app/(app)/timetable/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Field, FormMessage } from "@/components/ui/label";
import { type DateKey, isoWeekday } from "@/lib/domain/dates";
import type { Subject } from "@/lib/domain/model";
import { type TimetableSlot, WEEKDAYS, currentOrNext, slotsOfDay, visibleWeekdays } from "@/lib/domain/timetable";
import { getMessages } from "@/lib/i18n";
import { slotInputSchema } from "@/lib/validation/timetable";

const m = getMessages().timetablePage;

interface Props {
  slots: TimetableSlot[];
  subjects: Subject[];
  today: DateKey;
  nowTime: string;
  demo: boolean;
}

/** Orario settimanale: un blocco per giorno, il giorno di oggi in evidenza. */
export function TimetableBoard({ slots, subjects, today, nowTime, demo }: Props) {
  const [demoSlots, setDemoSlots] = useState<TimetableSlot[]>([]);
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [weekday, setWeekday] = useState(Math.min(isoWeekday(today), 5));
  const [from, setFrom] = useState("08:00");
  const [to, setTo] = useState("09:00");
  const [subjectId, setSubjectId] = useState("");
  const [room, setRoom] = useState("");

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const all = useMemo(() => [...slots, ...demoSlots].filter((s) => !gone.has(s.id)), [slots, demoSlots, gone]);
  const highlight = useMemo(() => currentOrNext(all, today, nowTime), [all, today, nowTime]);
  const todayDay = isoWeekday(today);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const input = { weekday, starts_at: from, ends_at: to, subject_id: subjectId, room };
    const parsed = slotInputSchema.safeParse(input);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    if (demo) {
      setDemoSlots((l) => [...l, { id: crypto.randomUUID(), weekday: parsed.data.weekday, start: from, end: to, subjectId: subjectId || undefined, room: room || undefined }]);
      return;
    }
    start(async () => {
      const res = await addSlot(input);
      if (!res.ok) return setError(res.error === "demo" ? m.errorSave : res.error);
      setRoom("");
    });
  };

  const remove = (slot: TimetableSlot) => {
    setGone((s) => new Set(s).add(slot.id));
    if (demo || slot.id.startsWith("demo-")) return;
    start(async () => {
      const res = await deleteSlot(slot.id);
      if (!res.ok) {
        setGone((s) => {
          const n = new Set(s);
          n.delete(slot.id);
          return n;
        });
        setError(res.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {WEEKDAYS.filter((d) => visibleWeekdays(all).includes(d)).map((d) => {
        const day = slotsOfDay(all, d);
        return (
          <section key={d} aria-labelledby={`d-${d}`} className="flex flex-col gap-2">
            <h2 id={`d-${d}`} className={d === todayDay ? "text-sm font-medium text-accent-text" : "text-sm font-medium text-muted"}>
              {m.days[d]}
            </h2>
            {day.length === 0 ? (
              <p className="rounded-card border border-border bg-surface p-3 text-sm text-muted">{m.empty}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {day.map((slot) => {
                  const subject = slot.subjectId ? subjectById.get(slot.subjectId) : undefined;
                  const label = `${subject?.name ?? "—"} ${slot.start}`;
                  const state = highlight?.slot.id === slot.id ? highlight.state : null;
                  return (
                    <li key={slot.id}>
                      <Card className="flex-row items-center gap-3 p-3">
                        <p className="w-24 shrink-0 text-sm tabular-nums text-muted">
                          {slot.start}–{slot.end}
                        </p>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 truncate text-sm font-medium">
                            {subject && <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: `var(--subject-${subject.color})` }} aria-hidden />}
                            <span className="truncate">{subject?.name ?? "—"}</span>
                            {state && <Badge tone={state === "now" ? "accent" : "neutral"}>{state === "now" ? m.now : m.next}</Badge>}
                          </p>
                          {slot.room && <p className="mt-0.5 text-xs text-muted">{slot.room}</p>}
                        </div>
                        <Button variant="ghost" aria-label={m.remove(label)} onClick={() => remove(slot)}>
                          <Trash2Icon strokeWidth={1.5} aria-hidden />
                        </Button>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      <Card aria-labelledby="slot-add-title">
        <CardHeader>
          <PlusIcon strokeWidth={1.5} className="size-4 text-muted" aria-hidden />
          <CardTitle id="slot-add-title">{m.addTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Field label={m.day} htmlFor="s-day">
                <Select id="s-day" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
                  {WEEKDAYS.map((d) => (
                    <option key={d} value={d}>
                      {m.days[d]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={m.from} htmlFor="s-from">
                <Input id="s-from" type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label={m.to} htmlFor="s-to">
                <Input id="s-to" type="time" value={to} onChange={(e) => setTo(e.target.value)} />
              </Field>
              <Field label={m.subject} htmlFor="s-subject">
                <Select id="s-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                  <option value="">{m.noSubject}</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={m.room} htmlFor="s-room">
                <Input id="s-room" value={room} onChange={(e) => setRoom(e.target.value)} placeholder={m.roomPlaceholder} maxLength={40} />
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
    </div>
  );
}
