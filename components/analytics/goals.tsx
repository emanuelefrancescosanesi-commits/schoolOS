"use client";

import { useState, useTransition } from "react";
import { setGoal } from "@/app/(app)/analytics/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { goalStatus } from "@/lib/domain/analytics";
import { type AverageMethod, type Grade, average } from "@/lib/domain/averages";
import { type GradingScale, formatAverage, formatGrade } from "@/lib/domain/grading";
import type { Subject } from "@/lib/domain/model";
import { getMessages } from "@/lib/i18n";
import type { GoalsData } from "@/lib/data/goals-data";

const m = getMessages().analyticsPage.goals;

interface Props {
  grades: Grade[];
  subjects: Subject[];
  scale: GradingScale;
  method: AverageMethod;
  initial: GoalsData;
}

/** Obiettivi di media: uno generale e uno per materia, con quanto manca e il voto che serve. */
export function Goals({ grades, subjects, scale, method, initial }: Props) {
  const withGrades = subjects.filter((s) => grades.some((g) => g.subjectId === s.id));
  const [goals, setGoals] = useState<GoalsData>(initial);

  if (withGrades.length === 0) {
    return (
      <Shell>
        <p className="text-sm text-muted">{m.empty}</p>
      </Shell>
    );
  }
  const overall = average(
    withGrades.map((s) => ({ value: average(grades.filter((g) => g.subjectId === s.id), method) ?? 0, weight: 1 })),
    "arithmetic",
  );
  const overallGrades = overall === null ? [] : [{ value: overall, weight: 1 }];

  return (
    <Shell>
      <ul className="flex flex-col divide-y divide-border">
        <GoalRow
          key="overall"
          id="overall"
          label={m.overall}
          color={null}
          avg={overall}
          target={goals.overall}
          scale={scale}
          status={overall === null || goals.overall === null ? null : goalStatus(overallGrades, goals.overall, scale, "arithmetic")}
          onChange={(t) => setGoals((g) => ({ ...g, overall: t }))}
          subjectId={null}
          showNeed={false}
        />
        {withGrades.map((s) => {
          const own = grades.filter((g) => g.subjectId === s.id);
          const target = goals.bySubject[s.id] ?? null;
          return (
            <GoalRow
              key={s.id}
              id={s.id}
              label={s.name}
              color={s.color}
              avg={average(own, method)}
              target={target}
              scale={scale}
              status={target === null ? null : goalStatus(own, target, scale, method)}
              onChange={(t) =>
                setGoals((g) => {
                  const bySubject = { ...g.bySubject };
                  if (t === null) delete bySubject[s.id];
                  else bySubject[s.id] = t;
                  return { ...g, bySubject };
                })
              }
              subjectId={s.id}
              showNeed
            />
          );
        })}
      </ul>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <Card aria-labelledby="goals-title">
      <CardHeader>
        <CardTitle id="goals-title">{m.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted">{m.intro}</p>
        {children}
      </CardContent>
    </Card>
  );
}

type Status = ReturnType<typeof goalStatus> | null;

function GoalRow(props: {
  id: string;
  label: string;
  color: number | null;
  avg: number | null;
  target: number | null;
  scale: GradingScale;
  status: Status;
  subjectId: string | null;
  showNeed: boolean;
  onChange: (t: number | null) => void;
}) {
  const { id, label, color, avg, target, scale, status, subjectId, showNeed, onChange } = props;
  const [text, setText] = useState(target === null ? "" : String(target).replace(".", ","));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function save(next: number | null) {
    setMessage(null);
    start(async () => {
      const res = await setGoal({ subjectId, target: next }).catch(() => ({ ok: false as const, error: m.error }));
      if (res.ok) {
        onChange(next);
        if (next === null) setText("");
        setMessage({ ok: true, text: next === null ? m.removed : m.saved });
      } else {
        setMessage({ ok: false, text: res.error });
      }
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(text.trim().replace(",", "."));
    if (text.trim() === "") return save(null);
    if (!Number.isFinite(n) || n < scale.min || n > scale.max) {
      return setMessage({ ok: false, text: m.invalid(formatGrade(scale.min, scale), formatGrade(scale.max, scale)) });
    }
    save(n);
  }

  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-2 text-sm">
        {color !== null && <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: `var(--subject-${color})` }} aria-hidden />}
        <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
        <span className="tabular text-muted">{avg === null ? m.noAverage : formatAverage(avg)}</span>
      </div>
      <form onSubmit={submit} className="flex items-center gap-2">
        <label htmlFor={`goal-${id}`} className="sr-only">
          {m.target}: {label}
        </label>
        <Input id={`goal-${id}`} inputMode="decimal" placeholder={m.noGoal} value={text} onChange={(e) => setText(e.target.value)} className="w-32" aria-describedby={`goal-msg-${id}`} />
        <Button type="submit" size="sm" disabled={pending}>
          {m.save}
        </Button>
        {target !== null && (
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => save(null)}>
            {m.remove}
          </Button>
        )}
      </form>
      <p id={`goal-msg-${id}`} role="status" className="min-h-4 text-xs text-muted">
        {message ? (
          <span className={message.ok ? "text-positive" : "text-critical"}>{message.text}</span>
        ) : status?.kind === "reached" ? (
          m.reached(formatAverage(status.margin))
        ) : status?.kind === "missing" ? (
          <>
            {m.missing(formatAverage(status.gap))}{" "}
            {showNeed && (status.next.status === "reachable" ? m.need(formatGrade(status.next.value, scale)) : status.next.status === "unreachable" ? m.unreachable : null)}
          </>
        ) : null}
      </p>
    </li>
  );
}
