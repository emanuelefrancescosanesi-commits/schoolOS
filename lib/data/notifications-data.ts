import "server-only";
import { cache } from "react";
import { buildReminders } from "@/lib/domain/reminders";
import type { NotificationState } from "@/lib/notifications/types";
import { createClient } from "@/lib/supabase/server";
import { getSchoolContext } from "./school-data";

/**
 * Promemoria dello studente + quali ha già letto. Calcolati a ogni richiesta (nessun invio
 * esterno); in demo non si salva nulla, quindi nulla risulta letto lato server.
 */
export const getNotificationState = cache(async (): Promise<NotificationState> => {
  const { data, today } = await getSchoolContext();
  const prefs = data.profile.notifications;
  const subjectName = new Map(data.subjects.map((s) => [s.id, s.name]));
  const reminders = buildReminders(data.tasks, today, prefs).map((r) => ({
    id: r.id,
    type: r.type,
    days: r.days,
    title: r.task.title,
    kind: r.task.kind,
    subjectName: subjectName.get(r.task.subjectId) ?? null,
    due: r.task.due,
  }));
  const allOff = !prefs.overdue && !prefs.dueSoon && !prefs.tests;

  let readIds: string[] = [];
  if (!data.isDemo && reminders.length > 0) {
    const supabase = await createClient();
    const { data: rows, error } = await supabase
      .from("notification_reads")
      .select("reminder_id")
      .in("reminder_id", reminders.map((r) => r.id));
    // Migrazione non ancora applicata: i promemoria si vedono, solo non si possono segnare come letti.
    if (error && error.code !== "PGRST205" && error.code !== "42P01") throw new Error(error.message);
    readIds = (rows ?? []).map((r) => r.reminder_id);
  }
  return { reminders, readIds, allOff };
});
