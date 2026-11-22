"use client";

import { useState } from "react";
import { updateScale } from "@/app/(app)/settings/actions";
import { SaveBar, useSave } from "@/components/settings/save-bar";
import { ChoiceCard, Toggle } from "@/components/ui/choice";
import { Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { type GradingScale, formatGrade, isAllowedGrade } from "@/lib/domain/grading";
import { getMessages } from "@/lib/i18n";
import type { SettingsScaleInput } from "@/lib/validation/settings";

/** Scala dei voti (mezzi voti, +/−, sufficienza) e metodo di media. */
export function ScaleForm({ initial, demo }: { initial: SettingsScaleInput; demo: boolean }) {
  const f = getMessages().onboarding.fields;
  const [s, setS] = useState(initial);
  const { pending, status, save, clear } = useSave(demo);
  const set = (patch: Partial<SettingsScaleInput>) => {
    clear();
    setS((d) => ({ ...d, ...patch }));
  };
  const scale: GradingScale = {
    min: s.grade_min,
    max: s.grade_max,
    allowHalf: s.allow_half,
    allowPlusMinus: s.allow_plus_minus,
    passThreshold: s.pass_threshold,
  };
  const examples = [5.75, 6, 6.25, 6.5, 7, 7.75].filter((v) => isAllowedGrade(v, scale));
  const withCurrent = (base: number[], current: number) => (base.includes(current) ? base : [...base, current].sort((a, b) => a - b));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(() => updateScale(s));
      }}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        <Toggle id="s-half" label={f.allowHalf} checked={s.allow_half} onChange={(v) => set({ allow_half: v })} />
        <Toggle id="s-pm" label={f.allowPlusMinus} checked={s.allow_plus_minus} onChange={(v) => set({ allow_plus_minus: v })} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={f.minGrade} htmlFor="s-min">
          <Select id="s-min" value={s.grade_min} onChange={(e) => set({ grade_min: Number(e.target.value) })}>
            {withCurrent([0, 1, 2, 3], s.grade_min).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={f.passThreshold} htmlFor="s-pass">
          <Select id="s-pass" value={s.pass_threshold} onChange={(e) => set({ pass_threshold: Number(e.target.value) })}>
            {withCurrent([5, 5.5, 6], s.pass_threshold).map((v) => (
              <option key={v} value={v}>
                {formatGrade(v)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">{f.averageMethod}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <ChoiceCard name="average_method" value="weighted" checked={s.average_method === "weighted"} onChange={() => set({ average_method: "weighted" })} label={f.weighted} body={f.weightedHint} />
          <ChoiceCard name="average_method" value="arithmetic" checked={s.average_method === "arithmetic"} onChange={() => set({ average_method: "arithmetic" })} label={f.arithmetic} body={f.arithmeticHint} />
        </div>
      </fieldset>

      <div>
        <p className="mb-2 text-xs text-muted">{f.preview}</p>
        <div className="flex flex-wrap gap-2">
          {examples.map((v) => (
            <span key={v} className="tabular rounded-control bg-surface-2 px-2.5 py-1 text-sm">
              {formatGrade(v, scale)}
            </span>
          ))}
        </div>
      </div>

      <SaveBar pending={pending} status={status} />
    </form>
  );
}
