"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { requireOnboardedUser, requireUser } from "@/lib/data/session";
import { dateKeyInTimeZone } from "@/lib/domain/dates";
import { type GradingScale, countGradesOutsideScale } from "@/lib/domain/grading";
import { firstIssue } from "@/lib/validation/onboarding";
import {
  settingsNotificationsSchema,
  settingsPeriodsSchema,
  settingsProfileSchema,
  settingsScaleSchema,
} from "@/lib/validation/settings";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const DELETE_PHRASE = "ELIMINA";

/** Elimina l'account e tutti i dati dello studente (cascade nel database), poi esce. */
export async function deleteAccount(phrase: string): Promise<{ error: string } | never> {
  if (!isSupabaseConfigured()) return { error: "Non disponibile in modalità demo." };
  await requireUser("/settings");
  if (phrase.trim().toUpperCase() !== DELETE_PHRASE) return { error: `Scrivi ${DELETE_PHRASE} per confermare.` };
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { error: "Non sono riuscito a eliminare l'account. Riprova tra poco." };
  await supabase.auth.signOut().catch(() => {});
  redirect("/login");
}

export type SettingsResult = { ok: true } | { ok: false; error: string };

const DEMO: SettingsResult = { ok: false, error: "Non disponibile in modalità demo." };
const GENERIC: SettingsResult = { ok: false, error: "Non siamo riusciti a salvare. Riprova tra poco." };

/** Nome, scuola, classe e registro. */
export async function updateProfile(input: unknown): Promise<SettingsResult> {
  const parsed = settingsProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  if (!isSupabaseConfigured()) return DEMO;
  const user = await requireUser("/settings");
  const { first_name, school_name, class_name, registro } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ first_name, school_name: school_name || null, class_name: class_name || null, registro })
    .eq("id", user.id);
  if (error) return GENERIC;
  refresh();
  return { ok: true };
}

/**
 * Scala dei voti e metodo di media. Se esistono già voti che la nuova scala non ammette
 * (es. 6½ dopo aver tolto i mezzi voti) si rifiuta la modifica e si dice quanti sono:
 * meglio che renderli silenziosamente invalidi.
 */
export async function updateScale(input: unknown): Promise<SettingsResult> {
  const parsed = settingsScaleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  if (!isSupabaseConfigured()) return DEMO;
  const user = await requireUser("/settings");
  const s = parsed.data;
  const scale: GradingScale = {
    min: s.grade_min,
    max: s.grade_max,
    allowHalf: s.allow_half,
    allowPlusMinus: s.allow_plus_minus,
    passThreshold: s.pass_threshold,
  };
  const supabase = await createClient();
  const { data: grades, error: readError } = await supabase.from("grades").select("value");
  if (readError) return GENERIC;
  const outside = countGradesOutsideScale(
    grades.map((g) => Number(g.value)),
    scale,
  );
  if (outside > 0) {
    return {
      ok: false,
      error:
        outside === 1
          ? "Hai 1 voto che questa scala non ammette. Modificalo o eliminalo, poi riprova."
          : `Hai ${outside} voti che questa scala non ammette. Modificali o eliminali, poi riprova.`,
    };
  }
  const { error } = await supabase
    .from("profiles")
    .update({
      grade_min: s.grade_min,
      grade_max: s.grade_max,
      allow_half: s.allow_half,
      allow_plus_minus: s.allow_plus_minus,
      pass_threshold: s.pass_threshold,
      average_method: s.average_method,
    })
    .eq("id", user.id);
  if (error) return GENERIC;
  refresh();
  return { ok: true };
}

/** Schema dei periodi, date dell'anno e periodi, in un'unica transazione. I voti non cambiano. */
export async function updatePeriods(input: unknown): Promise<SettingsResult> {
  const parsed = settingsPeriodsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  if (!isSupabaseConfigured()) return DEMO;
  const { profile } = await requireOnboardedUser();
  const supabase = await createClient();
  const today = dateKeyInTimeZone(new Date(), profile.time_zone);
  // Stessa regola di getSchoolContext: l'anno in corso è l'ultimo già iniziato.
  const { data: years, error: yearsError } = await supabase
    .from("school_years")
    .select("id, starts_on")
    .order("starts_on", { ascending: false });
  if (yearsError) return GENERIC;
  const year = years.find((y) => y.starts_on <= today) ?? years.at(-1);
  if (!year) return { ok: false, error: "Nessun anno scolastico: completa prima la configurazione." };
  const { period_scheme, school_year, periods } = parsed.data;
  const { error } = await supabase.rpc("replace_periods", {
    p_year_id: year.id,
    p_scheme: period_scheme,
    p_year: school_year,
    p_periods: periods,
  });
  if (error) {
    if (error.message.includes("esce dall")) return { ok: false, error: error.message };
    if (error.message.includes("periods_school_year_id_daterange_excl") || error.code === "23P01") {
      return { ok: false, error: "Due periodi si sovrappongono." };
    }
    return GENERIC;
  }
  refresh();
  return { ok: true };
}

/** Quali promemoria mostrare nelle Notifiche. */
export async function updateNotifications(input: unknown): Promise<SettingsResult> {
  const parsed = settingsNotificationsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  if (!isSupabaseConfigured()) return DEMO;
  const user = await requireUser("/settings");
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);
  if (error) return GENERIC;
  refresh();
  return { ok: true };
}
