"use client";

import { ChoiceCard } from "@/components/ui/choice";
import { useTheme } from "@/hooks/use-preferences";
import { getMessages } from "@/lib/i18n";
import type { ThemePreference } from "@/lib/preferences";

const OPTIONS: ThemePreference[] = ["system", "light", "dark"];

/** Tema chiaro/scuro/sistema. Si applica subito ed è salvato sul dispositivo, non sull'account. */
export function ThemePicker() {
  const m = getMessages().theme;
  const { theme, setTheme } = useTheme();
  return (
    <fieldset>
      <legend className="sr-only">{m.label}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {OPTIONS.map((o) => (
          <ChoiceCard key={o} name="s_theme" value={o} checked={theme === o} onChange={() => setTheme(o)} label={m[o]} body={m.hint[o]} />
        ))}
      </div>
    </fieldset>
  );
}
