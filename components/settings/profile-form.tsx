"use client";

import { useState } from "react";
import { updateProfile } from "@/app/(app)/settings/actions";
import { SaveBar, useSave } from "@/components/settings/save-bar";
import { ChoiceCard } from "@/components/ui/choice";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { getMessages } from "@/lib/i18n";
import { REGISTRO_OPTIONS, type SettingsProfileInput } from "@/lib/validation/settings";

/** Nome, scuola, classe e registro elettronico (le stesse scelte dell'onboarding). */
export function ProfileForm({ initial, demo }: { initial: SettingsProfileInput; demo: boolean }) {
  const m = getMessages();
  const f = m.onboarding.fields;
  const [data, setData] = useState(initial);
  const { pending, status, save, clear } = useSave(demo);
  const set = (patch: Partial<SettingsProfileInput>) => {
    clear();
    setData((d) => ({ ...d, ...patch }));
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(() => updateProfile(data));
      }}
      className="flex flex-col gap-5"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={f.firstName} htmlFor="s-first-name">
          <Input id="s-first-name" value={data.first_name} maxLength={60} autoComplete="given-name" onChange={(e) => set({ first_name: e.target.value })} />
        </Field>
        <Field label={f.className} htmlFor="s-class">
          <Input id="s-class" value={data.class_name} maxLength={20} placeholder={f.classPlaceholder} onChange={(e) => set({ class_name: e.target.value })} />
        </Field>
        <Field label={f.school} htmlFor="s-school" className="sm:col-span-2">
          <Input id="s-school" value={data.school_name} maxLength={120} placeholder={f.schoolPlaceholder} onChange={(e) => set({ school_name: e.target.value })} />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">{m.settings.registroTitle}</legend>
        <p className="mb-3 text-xs text-muted">{m.settings.registroBody}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {REGISTRO_OPTIONS.map((r) => (
            <ChoiceCard
              key={r}
              name="registro"
              value={r}
              checked={data.registro === r}
              onChange={() => set({ registro: r })}
              label={m.onboarding.registri[r].label}
              body={m.onboarding.registri[r].body}
            />
          ))}
        </div>
      </fieldset>

      <SaveBar pending={pending} status={status} disabled={!data.first_name.trim()} />
    </form>
  );
}
