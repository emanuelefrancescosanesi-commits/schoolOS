"use client";

import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, LoaderCircleIcon, PlusIcon, XIcon } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import type { z } from "zod";
import { completeOnboarding } from "@/app/onboarding/actions";
import { SubjectDot } from "@/components/dashboard/widget-card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field, FormMessage } from "@/components/ui/label";
import type { DateKey } from "@/lib/domain/dates";
import { type GradingScale, formatGrade, isAllowedGrade } from "@/lib/domain/grading";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  type OnboardingInput,
  PERIOD_SCHEMES,
  REGISTRO_OPTIONS,
  profileStepSchema,
  registroStepSchema,
  scaleStepSchema,
  schoolYearStepSchema,
  subjectsStepSchema,
} from "@/lib/validation/onboarding";
import { COMMON_SUBJECTS, initialOnboarding, schoolYearStart, yearForScheme } from "@/lib/validation/onboarding-defaults";

const STEPS = ["name", "school", "class", "year", "subjects", "scale", "registro", "summary"] as const;
type Step = (typeof STEPS)[number];
const TOTAL = 7; // il riepilogo non conta come passo

export function OnboardingWizard({
  demo,
  today,
  initialFirstName,
}: {
  demo: boolean;
  today: DateKey;
  initialFirstName: string;
}) {
  const m = getMessages().onboarding;
  const router = useRouter();
  const [data, setData] = useState<OnboardingInput>(() => initialOnboarding(today, initialFirstName));
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const step: Step = STEPS[index];

  const validate = (): string | null => {
    const check = (schema: z.ZodType, value: unknown) => {
      const r = schema.safeParse(value);
      return r.success ? null : (r.error.issues[0]?.message ?? "Dati non validi");
    };
    switch (step) {
      case "name":
      case "school":
      case "class":
        return check(profileStepSchema, data.profile);
      case "year":
        return check(schoolYearStepSchema, data.year);
      case "subjects":
        return check(subjectsStepSchema, data.subjects);
      case "scale":
        return check(scaleStepSchema, data.scale);
      case "registro":
        return check(registroStepSchema, data.registro);
      default:
        return null;
    }
  };

  const go = (delta: 1 | -1) => {
    setError(null);
    if (delta === 1) {
      const problem = validate();
      if (problem) return setError(problem);
    }
    setDirection(delta);
    setIndex((i) => Math.min(Math.max(i + delta, 0), STEPS.length - 1));
  };

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await completeOnboarding(data);
      if (result.error) setError(result.error);
      else if (result.demo) {
        setNotice(m.demoDone);
        setTimeout(() => router.push("/dashboard"), 1200);
      }
    });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === "summary") submit();
    else go(1);
  };

  const stepInfo = m.steps[step];
  const stepNumber = Math.min(index + 1, TOTAL);

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        {demo && <FormMessage tone="notice">{m.demoNotice}</FormMessage>}

        <div>
          <div className="mb-2 flex justify-between text-xs text-muted">
            <span>{step === "summary" ? m.steps.summary.title : m.stepOf(stepNumber, TOTAL)}</span>
          </div>
          <div
            className="h-1 overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={TOTAL}
            aria-valuenow={step === "summary" ? TOTAL : index}
            aria-label={m.title}
          >
            <motion.div
              className="h-full rounded-full bg-accent"
              animate={{ width: `${((step === "summary" ? TOTAL : index) / TOTAL) * 100}%` }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.section
            key={step}
            custom={direction}
            initial={{ opacity: 0, x: direction * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -24 }}
            aria-labelledby="step-title"
            className="flex flex-col gap-5"
          >
            <div>
              <h1 id="step-title" className="text-3xl font-semibold tracking-tight" tabIndex={-1}>
                {stepInfo.title}
              </h1>
              <p className="mt-2 text-sm text-muted">{stepInfo.body}</p>
            </div>

            <div className="rounded-card border border-border bg-surface p-5">
              {step === "name" && <NameStep data={data} setData={setData} />}
              {step === "school" && <SchoolStep data={data} setData={setData} />}
              {step === "class" && <ClassStep data={data} setData={setData} />}
              {step === "year" && <YearStep data={data} setData={setData} today={today} />}
              {step === "subjects" && <SubjectsStep data={data} setData={setData} />}
              {step === "scale" && <ScaleStep data={data} setData={setData} />}
              {step === "registro" && <RegistroStep data={data} setData={setData} />}
              {step === "summary" && <Summary data={data} />}
            </div>
          </motion.section>
        </AnimatePresence>

        {error && <FormMessage tone="error">{error}</FormMessage>}
        {notice && <FormMessage tone="notice">{notice}</FormMessage>}

        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => go(-1)} disabled={index === 0 || pending} className={cn(index === 0 && "invisible")}>
            <ArrowLeftIcon strokeWidth={1.5} />
            {m.back}
          </Button>
          <Button type="submit" variant="primary" disabled={pending || Boolean(notice)}>
            {pending ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : null}
            {step === "summary" ? (pending ? m.saving : m.finish) : m.next}
            {step !== "summary" && <ArrowRightIcon strokeWidth={1.5} />}
          </Button>
        </div>
      </form>
    </MotionConfig>
  );
}

type StepProps = { data: OnboardingInput; setData: React.Dispatch<React.SetStateAction<OnboardingInput>> };

function profileFieldSetter(setData: StepProps["setData"], key: keyof OnboardingInput["profile"]) {
  return (e: React.ChangeEvent<HTMLInputElement>) =>
    setData((d) => ({ ...d, profile: { ...d.profile, [key]: e.target.value } }));
}

function NameStep({ data, setData }: StepProps) {
  const m = getMessages().onboarding.fields;
  return (
    <Field label={m.firstName} htmlFor="first_name">
      <Input
        id="first_name"
        autoFocus
        autoComplete="given-name"
        maxLength={60}
        value={data.profile.first_name}
        onChange={profileFieldSetter(setData, "first_name")}
      />
    </Field>
  );
}

function SchoolStep({ data, setData }: StepProps) {
  const m = getMessages().onboarding.fields;
  return (
    <Field label={m.school} htmlFor="school_name">
      <Input
        id="school_name"
        autoFocus
        autoComplete="organization"
        maxLength={120}
        placeholder={m.schoolPlaceholder}
        value={data.profile.school_name}
        onChange={profileFieldSetter(setData, "school_name")}
      />
    </Field>
  );
}

function ClassStep({ data, setData }: StepProps) {
  const m = getMessages().onboarding.fields;
  return (
    <Field label={m.className} htmlFor="class_name">
      <Input
        id="class_name"
        autoFocus
        maxLength={20}
        placeholder={m.classPlaceholder}
        value={data.profile.class_name}
        onChange={profileFieldSetter(setData, "class_name")}
      />
    </Field>
  );
}

function ChoiceCard({
  name,
  value,
  checked,
  onChange,
  label,
  body,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  body: string;
}) {
  return (
    <label
      className={cn(
        "relative flex cursor-pointer flex-col gap-0.5 rounded-control border px-3.5 py-3 transition-colors",
        checked ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-2",
      )}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
      <span className={cn("text-sm font-medium", checked ? "text-accent-text" : "text-fg")}>{label}</span>
      <span className="text-xs text-muted">{body}</span>
      {checked && <CheckIcon className="absolute top-3 right-3 size-4 text-accent-text" aria-hidden />}
    </label>
  );
}

function YearStep({ data, setData, today }: StepProps & { today: DateKey }) {
  const m = getMessages().onboarding;
  const { year } = data;
  const setYear = (patch: Partial<OnboardingInput["year"]>) => setData((d) => ({ ...d, year: { ...d.year, ...patch } }));
  const setPeriod = (i: number, key: "name" | "starts_on" | "ends_on", value: string) =>
    setYear({ periods: year.periods.map((p, j) => (j === i ? { ...p, [key]: value } : p)) });

  return (
    <div className="flex flex-col gap-5">
      <fieldset>
        <legend className="sr-only">{m.steps.year.title}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {PERIOD_SCHEMES.map((scheme) => (
            <ChoiceCard
              key={scheme}
              name="period_scheme"
              value={scheme}
              checked={year.period_scheme === scheme}
              onChange={() => setYear(yearForScheme(scheme, schoolYearStart(today)))}
              label={m.schemes[scheme].label}
              body={m.schemes[scheme].body}
            />
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field label={m.fields.yearStart} htmlFor="year_start">
          <Input
            id="year_start"
            type="date"
            value={year.school_year.starts_on}
            onChange={(e) => setYear({ school_year: { ...year.school_year, starts_on: e.target.value } })}
          />
        </Field>
        <Field label={m.fields.yearEnd} htmlFor="year_end">
          <Input
            id="year_end"
            type="date"
            value={year.school_year.ends_on}
            onChange={(e) => setYear({ school_year: { ...year.school_year, ends_on: e.target.value } })}
          />
        </Field>
      </div>

      <ol className="flex flex-col gap-3">
        {year.periods.map((p, i) => (
          <li key={i} className="grid grid-cols-1 gap-2 rounded-control border border-border p-3 sm:grid-cols-[1fr_auto_auto]">
            <Field label={m.fields.periodName} htmlFor={`period-${i}-name`}>
              <Input id={`period-${i}-name`} value={p.name} maxLength={40} onChange={(e) => setPeriod(i, "name", e.target.value)} />
            </Field>
            <Field label={m.fields.periodStart} htmlFor={`period-${i}-start`}>
              <Input id={`period-${i}-start`} type="date" value={p.starts_on} onChange={(e) => setPeriod(i, "starts_on", e.target.value)} />
            </Field>
            <Field label={m.fields.periodEnd} htmlFor={`period-${i}-end`}>
              <Input id={`period-${i}-end`} type="date" value={p.ends_on} onChange={(e) => setPeriod(i, "ends_on", e.target.value)} />
            </Field>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SubjectsStep({ data, setData }: StepProps) {
  const m = getMessages().onboarding.fields;
  const [custom, setCustom] = useState("");
  const inputId = useId();
  const subjects = data.subjects.subjects;
  const selected = new Set(subjects.map((s) => s.name.toLocaleLowerCase("it-IT")));
  const setSubjects = (next: OnboardingInput["subjects"]["subjects"]) => setData((d) => ({ ...d, subjects: { subjects: next } }));

  const nextColor = () => (subjects.length % 8) + 1;
  const add = (name: string) => {
    const clean = name.trim();
    if (!clean || selected.has(clean.toLocaleLowerCase("it-IT"))) return;
    setSubjects([...subjects, { name: clean, color: nextColor(), teacher_name: "" }]);
  };
  const remove = (name: string) => setSubjects(subjects.filter((s) => s.name !== name));
  const toggle = (name: string) => (selected.has(name.toLocaleLowerCase("it-IT")) ? remove(name) : add(name));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {COMMON_SUBJECTS.map((name) => {
          const on = selected.has(name.toLocaleLowerCase("it-IT"));
          return (
            <button
              key={name}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(name)}
              className={cn(
                "inline-flex h-8 pointer-coarse:h-11 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
                on ? "border-accent bg-accent-soft text-accent-text" : "border-border text-fg hover:bg-surface-2",
              )}
            >
              {on ? <CheckIcon className="size-3.5" aria-hidden /> : <PlusIcon className="size-3.5 text-muted" aria-hidden />}
              {name}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          {m.addSubject}
        </label>
        <Input
          id={inputId}
          value={custom}
          maxLength={60}
          placeholder={m.addSubjectPlaceholder}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(custom);
              setCustom("");
            }
          }}
        />
        <Button
          onClick={() => {
            add(custom);
            setCustom("");
          }}
          disabled={!custom.trim()}
        >
          <PlusIcon strokeWidth={1.5} />
          {m.addSubject}
        </Button>
      </div>

      {subjects.length > 0 && (
        <div>
          <p className="mb-2 text-xs text-muted">{m.selected(subjects.length)}</p>
          <ul className="flex flex-col gap-2">
            {subjects.map((s, i) => (
              <li key={s.name} className="flex items-center gap-2 rounded-control border border-border px-2.5 py-2">
                <button
                  type="button"
                  onClick={() =>
                    setSubjects(subjects.map((x, j) => (j === i ? { ...x, color: (x.color % 8) + 1 } : x)))
                  }
                  aria-label={m.changeColor(s.name)}
                  className="inline-flex size-7 pointer-coarse:size-11 items-center justify-center rounded-control hover:bg-surface-2"
                >
                  <SubjectDot color={s.color} className="size-3" />
                </button>
                <span className="min-w-0 flex-1 truncate text-sm">{s.name}</span>
                <Input
                  aria-label={`${m.teacher}: ${s.name}`}
                  placeholder={m.teacher}
                  value={s.teacher_name}
                  maxLength={80}
                  className="h-8 max-w-44"
                  onChange={(e) =>
                    setSubjects(subjects.map((x, j) => (j === i ? { ...x, teacher_name: e.target.value } : x)))
                  }
                />
                <Button variant="ghost" size="icon-sm" onClick={() => remove(s.name)} aria-label={m.removeSubject(s.name)}>
                  <XIcon strokeWidth={1.5} />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Toggle({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-4 py-1">
      <span className="text-sm">{label}</span>
      <span className="relative inline-flex">
        <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-6 w-10 rounded-full bg-surface-2 ring-1 ring-border transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-text" />
        <span className="absolute top-1 left-1 size-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

function ScaleStep({ data, setData }: StepProps) {
  const m = getMessages().onboarding.fields;
  const s = data.scale;
  const set = (patch: Partial<OnboardingInput["scale"]>) => setData((d) => ({ ...d, scale: { ...d.scale, ...patch } }));
  const scale: GradingScale = {
    min: s.grade_min,
    max: s.grade_max,
    allowHalf: s.allow_half,
    allowPlusMinus: s.allow_plus_minus,
    passThreshold: s.pass_threshold,
  };
  const examples = [5.75, 6, 6.25, 6.5, 7, 7.75].filter((v) => isAllowedGrade(v, scale));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Toggle id="allow_half" label={m.allowHalf} checked={s.allow_half} onChange={(v) => set({ allow_half: v })} />
        <Toggle id="allow_pm" label={m.allowPlusMinus} checked={s.allow_plus_minus} onChange={(v) => set({ allow_plus_minus: v })} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={m.minGrade} htmlFor="grade_min">
          <Select id="grade_min" value={s.grade_min} onChange={(e) => set({ grade_min: Number(e.target.value) })}>
            {[0, 1, 2, 3].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={m.passThreshold} htmlFor="pass_threshold">
          <Select id="pass_threshold" value={s.pass_threshold} onChange={(e) => set({ pass_threshold: Number(e.target.value) })}>
            {[5, 5.5, 6].map((v) => (
              <option key={v} value={v}>
                {formatGrade(v)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{m.averageMethod}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <ChoiceCard
            name="average_method"
            value="weighted"
            checked={s.average_method === "weighted"}
            onChange={() => set({ average_method: "weighted" })}
            label={m.weighted}
            body={m.weightedHint}
          />
          <ChoiceCard
            name="average_method"
            value="arithmetic"
            checked={s.average_method === "arithmetic"}
            onChange={() => set({ average_method: "arithmetic" })}
            label={m.arithmetic}
            body={m.arithmeticHint}
          />
        </div>
      </fieldset>

      <div>
        <p className="mb-2 text-xs text-muted">{m.preview}</p>
        <div className="flex flex-wrap gap-2">
          {examples.map((v) => (
            <span key={v} className="tabular rounded-control bg-surface-2 px-2.5 py-1 text-sm">
              {formatGrade(v, scale)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function RegistroStep({ data, setData }: StepProps) {
  const m = getMessages().onboarding;
  return (
    <fieldset>
      <legend className="sr-only">{m.steps.registro.title}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {REGISTRO_OPTIONS.map((r) => (
          <ChoiceCard
            key={r}
            name="registro"
            value={r}
            checked={data.registro.registro === r}
            onChange={() => setData((d) => ({ ...d, registro: { registro: r } }))}
            label={m.registri[r].label}
            body={m.registri[r].body}
          />
        ))}
      </div>
    </fieldset>
  );
}

function Summary({ data }: { data: OnboardingInput }) {
  const m = getMessages().onboarding;
  const s = m.summary;
  const student = [data.profile.first_name, data.profile.class_name, data.profile.school_name].filter(Boolean).join(" · ");
  const scaleParts = [
    `${data.scale.grade_min}–${data.scale.grade_max}`,
    data.scale.allow_half && s.half,
    data.scale.allow_plus_minus && s.plusMinus,
    s.pass(formatGrade(data.scale.pass_threshold)),
  ].filter(Boolean);

  const rows: [string, React.ReactNode][] = [
    [s.student, student],
    [s.year, `${data.year.school_year.label} · ${data.year.periods.map((p) => p.name).join(", ")}`],
    [
      s.subjects,
      <span key="s" className="flex flex-wrap gap-x-3 gap-y-1">
        {data.subjects.subjects.map((x) => (
          <span key={x.name} className="inline-flex items-center gap-1.5">
            <SubjectDot color={x.color} />
            {x.name}
          </span>
        ))}
      </span>,
    ],
    [s.scale, `${scaleParts.join(", ")} · ${data.scale.average_method === "weighted" ? m.fields.weighted : m.fields.arithmetic}`],
    [s.registro, m.registri[data.registro.registro].label],
  ];

  return (
    <div className="flex flex-col gap-5">
      <dl className="flex flex-col divide-y divide-border">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 py-2.5 sm:grid-cols-[8rem_1fr]">
            <dt className="text-xs text-muted sm:pt-0.5">{label}</dt>
            <dd className="text-sm">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="rounded-control bg-surface-2 px-3.5 py-3">
        <p className="text-sm font-medium">{s.integrations}</p>
        <p className="mt-1 text-xs text-muted">{s.integrationsBody}</p>
      </div>
    </div>
  );
}
