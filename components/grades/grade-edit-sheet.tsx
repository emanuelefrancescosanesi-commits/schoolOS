"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { updateGrade } from "@/app/(app)/grades/actions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field, FormMessage } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { gradeFromRow } from "@/lib/data/mappers";
import type { Grade } from "@/lib/domain/averages";
import type { DateKey } from "@/lib/domain/dates";
import { type GradingScale, formatGrade, parseGrade, formatAverage } from "@/lib/domain/grading";
import type { Subject } from "@/lib/domain/model";
import { getMessages } from "@/lib/i18n";
import { gradeInputSchema } from "@/lib/validation/grade";

const WEIGHTS = [0.5, 1, 1.5, 2];

interface Props {
  grade: Grade | null;
  demo: boolean;
  today: DateKey;
  scale: GradingScale;
  subjects: Subject[];
  onClose: () => void;
  onSaved: (grade: Grade) => void;
}

/** Modifica di un voto: pannello dal basso, leggibile e comodo sia su telefono sia su PC. */
export function GradeEditSheet(props: Props) {
  const { grade, onClose } = props;
  return (
    <Sheet open={grade !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent closeLabel={getMessages().grades.edit.close} className="mx-auto max-w-lg sm:bottom-6 sm:rounded-card sm:border">
        {/* La chiave azzera il modulo ogni volta che si apre un voto diverso. */}
        {grade && <EditForm key={grade.id} {...props} grade={grade} />}
      </SheetContent>
    </Sheet>
  );
}

function EditForm({ grade, demo, today, scale, subjects, onClose, onSaved }: Props & { grade: Grade }) {
  const m = getMessages().grades;
  const t = m.edit;
  const [subjectId, setSubjectId] = useState(grade.subjectId);
  const [value, setValue] = useState(formatGrade(grade.value, scale));
  const [kind, setKind] = useState<Grade["kind"]>(grade.kind);
  const [date, setDate] = useState<string>(grade.date);
  const [weight, setWeight] = useState(String(grade.weight));
  const [description, setDescription] = useState(grade.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const preview = value.trim() ? parseGrade(value, scale) : null;
  const weights = WEIGHTS.includes(grade.weight) ? WEIGHTS : [...WEIGHTS, grade.weight].sort((a, b) => a - b);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const input = { subject_id: subjectId, value, weight, kind, graded_on: date, description };
    const parsed = gradeInputSchema(scale).safeParse(input);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    if (parsed.data.graded_on > today) return setError(t.futureDate);

    const done = (next: Grade) => {
      onSaved(next);
      onClose();
    };
    if (demo) {
      done({
        ...grade,
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
      const result = await updateGrade(grade.id, input);
      if (!result.ok) setError(result.error === "demo" ? m.errorSave : result.error);
      else if (result.grade) done(gradeFromRow(result.grade));
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 p-5 pr-14">
      <div>
        <SheetTitle className="text-lg font-semibold">{t.title}</SheetTitle>
        <SheetDescription className="mt-1 text-sm text-muted">{t.hint}</SheetDescription>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={m.add.subject} htmlFor="e-subject" className="col-span-2">
          <Select id="e-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={m.add.value} htmlFor="e-value" hint={preview?.ok ? m.add.interpreted(formatAverage(preview.value)) : undefined}>
          <Input
            id="e-value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
            className="tabular"
            aria-invalid={preview ? !preview.ok : undefined}
          />
        </Field>
        <Field label={m.add.kind} htmlFor="e-kind">
          <Select id="e-kind" value={kind} onChange={(e) => setKind(e.target.value as Grade["kind"])}>
            {(["written", "oral", "practical"] as const).map((k) => (
              <option key={k} value={k}>
                {m.kind[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={m.add.date} htmlFor="e-date">
          <Input id="e-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={m.add.weight} htmlFor="e-weight">
          <Select id="e-weight" value={weight} onChange={(e) => setWeight(e.target.value)}>
            {weights.map((w) => (
              <option key={w} value={String(w)}>
                {String(w).replace(".", ",")}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={m.add.description} htmlFor="e-desc" className="col-span-2">
          <Input id="e-desc" value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <div className="flex gap-3">
        <Button type="submit" variant="primary" disabled={pending} className="flex-1 sm:flex-none">
          {pending && <LoaderCircleIcon className="animate-spin" aria-hidden />}
          {pending ? t.saving : t.save}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}
