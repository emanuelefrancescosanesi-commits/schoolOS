"use client";

import { GraduationCapIcon, LoaderCircleIcon, PlusIcon, Trash2Icon, Undo2Icon } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { addGrade, deleteGrade, restoreGrade } from "@/app/(app)/grades/actions";
import { EmptyState, SubjectDot } from "@/components/dashboard/widget-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Field, FormMessage } from "@/components/ui/label";
import { gradeFromRow } from "@/lib/data/mappers";
import { type AverageMethod, type Grade, average, overallAverage, requiredGrade } from "@/lib/domain/averages";
import { type DateKey, isWithin } from "@/lib/domain/dates";
import { type GradingScale, formatAverage, formatGrade, gradeStanding, parseGrade } from "@/lib/domain/grading";
import type { Subject } from "@/lib/domain/model";
import type { Period } from "@/lib/domain/periods";
import { formatDayMonth } from "@/lib/format";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { gradeInputSchema } from "@/lib/validation/grade";

const STANDING_TEXT = { positive: "text-positive", borderline: "text-warning", critical: "text-critical" } as const;
const GRADE_CHIP = {
  positive: "bg-positive-soft text-positive",
  borderline: "bg-warning-soft text-warning",
  critical: "bg-critical-soft text-critical",
} as const;
const WEIGHTS = [0.5, 1, 1.5, 2];
const UNDO_MS = 6000;

interface Props {
  demo: boolean;
  today: DateKey;
  scale: GradingScale;
  averageMethod: AverageMethod;
  subjects: Subject[];
  periods: Period[];
  initialPeriodId: string | null;
  grades: Grade[];
}

export function GradesView(props: Props) {
  const m = getMessages().grades;
  const { demo, scale, averageMethod, subjects, periods } = props;

  // In demo i voti vivono solo qui; con Supabase questo stato si riallinea ai dati del server dopo ogni azione.
  const [grades, setGrades] = useState(props.grades);
  const [serverGrades, setServerGrades] = useState(props.grades);
  if (serverGrades !== props.grades) {
    setServerGrades(props.grades);
    setGrades(props.grades);
  }

  const [periodId, setPeriodId] = useState<string | "all">(props.initialPeriodId ?? "all");
  const [undo, setUndo] = useState<{ grade: Grade; restore: () => void } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(undoTimer.current), []);

  const period = periods.find((p) => p.id === periodId) ?? null;
  const visible = useMemo(
    () => grades.filter((g) => !period || isWithin(g.date, period.start, period.end)),
    [grades, period],
  );

  const overall = overallAverage(visible, averageMethod);
  const perSubject = subjects
    .map((subject) => {
      const list = visible.filter((g) => g.subjectId === subject.id).sort((a, b) => b.date.localeCompare(a.date));
      return { subject, list, avg: average(list, averageMethod) };
    })
    .filter((row) => row.list.length > 0);
  const below = perSubject.filter((r) => r.avg !== null && r.avg < scale.passThreshold).length;

  const showUndo = (grade: Grade, restore: () => void) => {
    clearTimeout(undoTimer.current);
    setUndo({ grade, restore });
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
  };

  const onDelete = async (grade: Grade) => {
    setGrades((gs) => gs.filter((g) => g.id !== grade.id));
    if (demo) {
      showUndo(grade, () => setGrades((gs) => [...gs, grade]));
      return;
    }
    const result = await deleteGrade(grade.id);
    if (!result.ok) {
      setGrades((gs) => [...gs, grade]);
      return;
    }
    const row = result.grade!;
    showUndo(grade, () => {
      setGrades((gs) => [...gs, grade]);
      void restoreGrade(row);
    });
  };

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{m.title}</h1>
            <p className="mt-1 text-sm text-muted">{m.subtitle(visible.length)}</p>
          </div>
          {periods.length > 0 && (
            <div className="flex flex-wrap gap-1 rounded-control border border-border bg-surface p-1" role="group" aria-label={m.periodFilter}>
              {[...periods.map((p) => ({ id: p.id, name: p.name })), { id: "all", name: m.wholeYear }].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={periodId === p.id}
                  onClick={() => setPeriodId(p.id)}
                  className={cn(
                    "h-8 rounded-[6px] px-3 text-sm transition-colors",
                    periodId === p.id ? "bg-surface-2 font-medium text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {demo && <FormMessage tone="notice">{m.demoNotice}</FormMessage>}

        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <Stat label={m.overall} value={overall === null ? "—" : formatAverage(overall)} tone={overall === null ? undefined : gradeStanding(overall, scale)} />
          <Stat label={m.count} value={String(visible.length)} />
          <Stat label={m.below} value={String(below)} tone={below > 0 ? "critical" : undefined} />
        </div>

        <QuickAdd
          demo={demo}
          today={props.today}
          scale={scale}
          subjects={subjects}
          onAdded={(g) => setGrades((gs) => [...gs, g])}
        />

        {perSubject.length === 0 ? (
          <EmptyState icon={GraduationCapIcon}>{subjects.length === 0 ? m.noSubjects : m.empty}</EmptyState>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {perSubject.map(({ subject, list, avg }) => {
              const standing = avg === null ? "positive" : gradeStanding(avg, scale);
              const needed = standing !== "positive" ? requiredGrade(list, scale.passThreshold, scale, averageMethod) : null;
              return (
                <Card key={subject.id} aria-labelledby={`subject-${subject.id}`}>
                  <CardHeader>
                    <SubjectDot color={subject.color} />
                    <CardTitle id={`subject-${subject.id}`}>{subject.name}</CardTitle>
                    <span className={cn("tabular ml-auto text-xl font-medium", STANDING_TEXT[standing])}>
                      {avg === null ? "—" : formatAverage(avg)}
                    </span>
                  </CardHeader>
                  <CardContent>
                    {needed?.status === "reachable" && (
                      <p className={cn("mb-3 text-xs", STANDING_TEXT[standing])}>
                        {getMessages().dashboard.performance.needed(formatGrade(needed.value, scale))}
                      </p>
                    )}
                    <ul className="flex flex-col">
                      <AnimatePresence initial={false}>
                        {list.map((g) => (
                          <motion.li
                            key={g.id}
                            layout
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="group flex items-center gap-3 border-t border-border py-2 first:border-t-0">
                              <span
                                className={cn(
                                  "tabular flex h-8 min-w-10 items-center justify-center rounded-control px-1.5 text-sm font-medium",
                                  GRADE_CHIP[gradeStanding(g.value, scale)],
                                )}
                              >
                                {formatGrade(g.value, scale)}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm">{g.description ?? m.kind[g.kind]}</span>
                                <span className="text-xs text-muted">
                                  {formatDayMonth(g.date)} · {m.kind[g.kind]}
                                  {averageMethod === "weighted" && g.weight !== 1 && ` · ${m.weightLabel(String(g.weight).replace(".", ","))}`}
                                </span>
                              </span>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => onDelete(g)}
                                aria-label={m.delete(`${formatGrade(g.value, scale)} ${subject.name}`)}
                                className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                              >
                                <Trash2Icon strokeWidth={1.5} />
                              </Button>
                            </div>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {undo && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-sm items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 shadow-lg lg:bottom-6"
          >
            <span className="flex-1 text-sm">{m.deleted}</span>
            <Button
              size="sm"
              onClick={() => {
                undo.restore();
                setUndo(null);
              }}
            >
              <Undo2Icon strokeWidth={1.5} />
              {m.undo}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: keyof typeof STANDING_TEXT }) {
  return (
    <div className="min-w-0 rounded-card border border-border bg-surface px-3 py-3 sm:px-5 sm:py-4">
      <p className="truncate text-xs text-muted">{label}</p>
      <p className={cn("tabular mt-1 text-xl font-medium sm:text-3xl", tone ? STANDING_TEXT[tone] : "text-fg")}>{value}</p>
    </div>
  );
}

function QuickAdd({
  demo,
  today,
  scale,
  subjects,
  onAdded,
}: {
  demo: boolean;
  today: DateKey;
  scale: GradingScale;
  subjects: Subject[];
  onAdded: (g: Grade) => void;
}) {
  const m = getMessages().grades;
  const t = m.add;
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [value, setValue] = useState("");
  const [kind, setKind] = useState<Grade["kind"]>("written");
  const [date, setDate] = useState(today);
  const [weight, setWeight] = useState("1");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const valueRef = useRef<HTMLInputElement>(null);

  if (subjects.length === 0) return null;

  const preview = value.trim() ? parseGrade(value, scale) : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(null);
    const input = { subject_id: subjectId, value, weight, kind, graded_on: date, description };
    const parsed = gradeInputSchema(scale).safeParse(input);
    if (!parsed.success) return setError(parsed.error.issues[0].message);

    const subjectName = subjects.find((s) => s.id === subjectId)?.name ?? "";
    const done = (grade: Grade) => {
      onAdded(grade);
      setSaved(t.saved(formatGrade(grade.value, scale), subjectName));
      setValue("");
      setDescription("");
      valueRef.current?.focus();
    };

    if (demo) {
      done({
        id: crypto.randomUUID(),
        subjectId,
        value: parsed.data.value,
        weight: parsed.data.weight,
        kind: parsed.data.kind,
        date: parsed.data.graded_on,
        description: parsed.data.description || undefined,
      });
      return;
    }
    startTransition(async () => {
      const result = await addGrade(input);
      if (!result.ok) setError(result.error === "demo" ? m.errorSave : result.error);
      else if (result.grade) done(gradeFromRow(result.grade));
    });
  };

  return (
    <Card aria-labelledby="quick-add-title">
      <CardHeader>
        <PlusIcon strokeWidth={1.5} className="size-4 text-muted" aria-hidden />
        <CardTitle id="quick-add-title">{t.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-[1.4fr_0.8fr_1fr_1fr_0.7fr]">
            <Field label={t.subject} htmlFor="g-subject" className="col-span-2 md:col-span-1">
              <Select id="g-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={t.value}
              htmlFor="g-value"
              hint={preview?.ok ? t.interpreted(formatAverage(preview.value)) : undefined}
            >
              <Input
                id="g-value"
                ref={valueRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={t.valuePlaceholder}
                inputMode="decimal"
                autoComplete="off"
                className="tabular"
                aria-invalid={preview ? !preview.ok : undefined}
                aria-describedby={preview?.ok ? "g-value-hint" : undefined}
              />
            </Field>
            <Field label={t.kind} htmlFor="g-kind">
              <Select id="g-kind" value={kind} onChange={(e) => setKind(e.target.value as Grade["kind"])}>
                {(["written", "oral", "practical"] as const).map((k) => (
                  <option key={k} value={k}>
                    {m.kind[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.date} htmlFor="g-date">
              <Input id="g-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={t.weight} htmlFor="g-weight">
              <Select id="g-weight" value={weight} onChange={(e) => setWeight(e.target.value)}>
                {WEIGHTS.map((w) => (
                  <option key={w} value={w}>
                    {String(w).replace(".", ",")}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label={t.description} htmlFor="g-desc" className="flex-1">
              <Input
                id="g-desc"
                value={description}
                maxLength={200}
                placeholder={t.descriptionPlaceholder}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : <PlusIcon strokeWidth={1.5} />}
              {t.submit}
            </Button>
          </div>
          {error && <FormMessage tone="error">{error}</FormMessage>}
          {saved && !error && (
            <p role="status" className="text-sm text-positive">
              <Badge tone="positive">{saved}</Badge>
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
