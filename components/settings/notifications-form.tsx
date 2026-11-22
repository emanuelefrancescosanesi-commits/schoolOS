"use client";

import { useState } from "react";
import { updateNotifications } from "@/app/(app)/settings/actions";
import { SaveBar, useSave } from "@/components/settings/save-bar";
import { Toggle } from "@/components/ui/choice";
import { Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { getMessages } from "@/lib/i18n";
import type { SettingsNotificationsInput } from "@/lib/validation/settings";

const DAYS = [1, 2, 3, 5, 7, 14];

/** Quali promemoria compaiono nel centro notifiche e con quanto anticipo. */
export function NotificationsForm({ initial, demo }: { initial: SettingsNotificationsInput; demo: boolean }) {
  const m = getMessages().settings;
  const [n, setN] = useState(initial);
  const { pending, status, save, clear } = useSave(demo);
  const set = (patch: Partial<SettingsNotificationsInput>) => {
    clear();
    setN((d) => ({ ...d, ...patch }));
  };
  const days = DAYS.includes(n.notify_test_days) ? DAYS : [...DAYS, n.notify_test_days].sort((a, b) => a - b);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(() => updateNotifications(n));
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <Toggle id="s-n-overdue" label={m.notifyOverdue} checked={n.notify_overdue} onChange={(v) => set({ notify_overdue: v })} />
        <Toggle id="s-n-soon" label={m.notifyDueSoon} checked={n.notify_due_soon} onChange={(v) => set({ notify_due_soon: v })} />
        <Toggle id="s-n-tests" label={m.notifyTests} checked={n.notify_tests} onChange={(v) => set({ notify_tests: v })} />
      </div>
      <Field label={m.notifyTestDays} htmlFor="s-n-days" className="max-w-xs">
        <Select id="s-n-days" value={n.notify_test_days} disabled={!n.notify_tests} onChange={(e) => set({ notify_test_days: Number(e.target.value) })}>
          {days.map((d) => (
            <option key={d} value={d}>
              {m.notifyDays(d)}
            </option>
          ))}
        </Select>
      </Field>
      <SaveBar pending={pending} status={status} />
    </form>
  );
}
