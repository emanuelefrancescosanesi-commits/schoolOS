import "server-only";
import { connection } from "next/server";
import { buildDemoDataset } from "@/lib/demo/dataset";
import { type DateKey, dateKeyInTimeZone, hourInTimeZone } from "@/lib/domain/dates";
import type { SchoolData } from "@/lib/domain/model";
import type { SchoolYearRow } from "@/lib/supabase/database.types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { toSchoolData } from "./mappers";
import { requireOnboardedUser } from "./session";

/**
 * Punto unico di accesso ai dati dello studente.
 * - Senza Supabase configurato: dataset demo (con banner sempre visibile).
 * - Con Supabase: dati dell'utente autenticato, letti sotto RLS.
 */
export function getDataMode(): "demo" | "live" {
  return isSupabaseConfigured() ? "live" : "demo";
}

/** Fuso usato finché non c'è un profilo: l'app è pensata per l'Italia. */
export const DEFAULT_TIME_ZONE = "Europe/Rome";

export interface SchoolContext {
  data: SchoolData;
  today: DateKey;
  hour: number;
  schoolYear: Pick<SchoolYearRow, "id" | "label" | "starts_on" | "ends_on"> | null;
}

/** PostgREST (PGRST205) o Postgres (42P01): la tabella non esiste ancora. */
function isMissingTable(error: { code?: string }): boolean {
  return error.code === "PGRST205" || error.code === "42P01";
}

export async function getSchoolContext(): Promise<SchoolContext> {
  // I dati dipendono dall'ora e dall'utente: sempre a richiesta, mai prerenderizzati.
  await connection();
  const now = new Date();

  if (getDataMode() === "demo") {
    const today = dateKeyInTimeZone(now, DEFAULT_TIME_ZONE);
    const data = buildDemoDataset(today);
    return { data, today, hour: hourInTimeZone(now, data.profile.timeZone), schoolYear: null };
  }

  const { profile } = await requireOnboardedUser();
  const today = dateKeyInTimeZone(now, profile.time_zone);
  const supabase = await createClient();

  // L'anno corrente è l'ultimo già iniziato; prima dell'inizio, il primo disponibile.
  const { data: years, error: yearsError } = await supabase
    .from("school_years")
    .select("id, label, starts_on, ends_on")
    .order("starts_on", { ascending: false });
  if (yearsError) throw new Error(yearsError.message);
  const schoolYear = years.find((y) => y.starts_on <= today) ?? years.at(-1) ?? null;

  if (!schoolYear) {
    const data = toSchoolData({ profile, subjects: [], periods: [], grades: [], assignments: [] });
    return { data, today, hour: hourInTimeZone(now, profile.time_zone), schoolYear: null };
  }

  const [subjects, periods] = await Promise.all([
    supabase.from("subjects").select("*").eq("school_year_id", schoolYear.id),
    supabase.from("periods").select("*").eq("school_year_id", schoolYear.id),
  ]);
  if (subjects.error) throw new Error(subjects.error.message);
  if (periods.error) throw new Error(periods.error.message);
  const subjectIds = subjects.data.map((s) => s.id);

  const [grades, assignments, events, messages] = await Promise.all([
    subjectIds.length
      ? supabase.from("grades").select("*").in("subject_id", subjectIds).order("graded_on", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase.from("assignments").select("*").eq("status", "todo").order("due_on").limit(200),
    supabase.from("events").select("*").order("starts_on").order("starts_at", { nullsFirst: true }).limit(1500),
    supabase.from("inbox_messages").select("*").order("received_at", { ascending: false }).limit(200),
  ]);
  if (grades.error) throw new Error(grades.error.message);
  if (assignments.error) throw new Error(assignments.error.message);
  // Migrazione eventi/Inbox non ancora applicata: calendario e Inbox vuoti invece di un errore.
  if (events.error && !isMissingTable(events.error)) throw new Error(events.error.message);
  if (messages.error && !isMissingTable(messages.error)) throw new Error(messages.error.message);

  const data = toSchoolData({
    profile,
    subjects: subjects.data,
    periods: periods.data,
    grades: grades.data,
    assignments: assignments.data,
    events: events.data ?? [],
    messages: messages.data ?? [],
  });
  return { data, today, hour: hourInTimeZone(now, profile.time_zone), schoolYear };
}
