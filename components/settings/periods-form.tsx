"use client";

import { useState } from "react";
import { updatePeriods } from "@/app/(app)/settings/actions";
import { SaveBar, useSave } from "@/components/settings/save-bar";
import { ChoiceCard } from "@/components/ui/choice";
import { Input } from "@/components/ui/input";
import { Field, FormMessage } from "@/components/ui/label";
import { getMessages } from "@/lib/i18n";
import { type OnboardingInput, PERIOD_SCHEMES } from "@/lib/validation/onboarding";
import { schoolYearStart, yearForScheme } from "@/lib/validation/onboarding-defaults";
import type { DateKey } from "@/lib/domain/dates";

type Year = OnboardingInput["year"];

/** Schema dei periodi, date dell'anno e di ogni periodo. */
export function PeriodsForm({ initial, today, demo }: { initial: Year; today: DateKey; demo: boolean }) {
  const m = getMessages();
  const f = m.onboarding.fields;
  const [year, setYear] = useState<Year>(initial);
  const [schemeChanged, setSchemeChanged] = useState(false);
  const { pending, status, save, clear } = useSave(demo);
  const patch = (next: Partial<Year>) => {
    clear();
    setYear((y) => ({ ...y, ...next }));
  };
  const setPeriod = (i: number, key: "name" | "starts_on" | "ends_on", value: string) =>
    patch({ periods: year.periods.map((p, j) => (j === i ? { ...p, [key]: value } : p)) });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(() => updatePeriods(year));
      }}
      className="flex flex-col gap-5"
    >
      <fieldset>
        <legend className="sr-only">{m.settings.periodsTitle}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {PERIOD_SCHEMES.map((scheme) => (
            <ChoiceCard
              key={scheme}
              name="s_period_scheme"
              value={scheme}
              checked={year.period_scheme === scheme}
              onChange={() => {
                if (scheme === year.period_scheme) return;
                setSchemeChanged(true);
                // Mantiene l'etichetta e le date dell'anno già scelte: cambiano solo i periodi.
                const fresh = yearForScheme(scheme, schoolYearStart(year.school_year.starts_on || today));
                patch({ period_scheme: scheme, periods: fresh.periods });
              }}
              label={m.onboarding.schemes[scheme].label}
              body={m.onboarding.schemes[scheme].body}
            />
          ))}
        </div>
      </fieldset>

      {schemeChanged && <FormMessage tone="notice">{m.settings.periodsReset}</FormMessage>}

      <div className="grid grid-cols-2 gap-3">
        <Field label={f.yearStart} htmlFor="s-year-start">
          <Input id="s-year-start" type="date" value={year.school_year.starts_on} onChange={(e) => patch({ school_year: { ...year.school_year, starts_on: e.target.value } })} />
        </Field>
        <Field label={f.yearEnd} htmlFor="s-year-end">
          <Input id="s-year-end" type="date" value={year.school_year.ends_on} onChange={(e) => patch({ school_year: { ...year.school_year, ends_on: e.target.value } })} />
        </Field>
      </div>

      <ol className="flex flex-col gap-3">
        {year.periods.map((p, i) => (
          <li key={i} className="grid grid-cols-1 gap-2 rounded-control border border-border p-3 sm:grid-cols-[1fr_auto_auto]">
            <Field label={f.periodName} htmlFor={`s-period-${i}-name`}>
              <Input id={`s-period-${i}-name`} value={p.name} maxLength={40} onChange={(e) => setPeriod(i, "name", e.target.value)} />
            </Field>
            <Field label={f.periodStart} htmlFor={`s-period-${i}-start`}>
              <Input id={`s-period-${i}-start`} type="date" value={p.starts_on} onChange={(e) => setPeriod(i, "starts_on", e.target.value)} />
            </Field>
            <Field label={f.periodEnd} htmlFor={`s-period-${i}-end`}>
              <Input id={`s-period-${i}-end`} type="date" value={p.ends_on} onChange={(e) => setPeriod(i, "ends_on", e.target.value)} />
            </Field>
          </li>
        ))}
      </ol>

      <SaveBar pending={pending} status={status} />
    </form>
  );
}
