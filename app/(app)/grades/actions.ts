"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { scaleFromProfile } from "@/lib/data/mappers";
import { getProfile, requireUser } from "@/lib/data/session";
import type { GradeRow } from "@/lib/supabase/database.types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { gradeInputSchema } from "@/lib/validation/grade";

export type GradeActionResult = { ok: true; grade?: GradeRow } | { ok: false; error: string };

const DEMO: GradeActionResult = { ok: false, error: "demo" };

export async function addGrade(input: Record<string, unknown>): Promise<GradeActionResult> {
  if (!isSupabaseConfigured()) return DEMO;
  const user = await requireUser("/grades");
  const profile = await getProfile(user.id);
  if (!profile) return { ok: false, error: "Profilo non trovato." };

  // La scala è quella dello studente, letta dal server: il client non può allargarla.
  const parsed = gradeInputSchema(scaleFromProfile(profile)).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (!z.uuid().safeParse(parsed.data.subject_id).success) return { ok: false, error: "Scegli una materia" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grades")
    .insert({ ...parsed.data, description: parsed.data.description || null })
    .select("*")
    .single();
  if (error) return { ok: false, error: "Non siamo riusciti a salvare il voto. Riprova." };

  refresh();
  return { ok: true, grade: data };
}

/** Modifica un voto esistente: stessa validazione dell'inserimento, scala letta dal server. */
export async function updateGrade(id: string, input: Record<string, unknown>): Promise<GradeActionResult> {
  if (!isSupabaseConfigured()) return DEMO;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Voto non valido." };
  const user = await requireUser("/grades");
  const profile = await getProfile(user.id);
  if (!profile) return { ok: false, error: "Profilo non trovato." };

  const parsed = gradeInputSchema(scaleFromProfile(profile)).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (!z.uuid().safeParse(parsed.data.subject_id).success) return { ok: false, error: "Scegli una materia" };

  const supabase = await createClient();
  // La RLS limita la modifica ai voti dello studente: un id altrui non trova nessuna riga.
  const { data, error } = await supabase
    .from("grades")
    .update({ ...parsed.data, description: parsed.data.description || null })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, error: "Non siamo riusciti a salvare le modifiche. Riprova." };
  if (!data) return { ok: false, error: "Voto non trovato: forse è stato eliminato." };

  refresh();
  return { ok: true, grade: data };
}

export async function deleteGrade(id: string): Promise<GradeActionResult> {
  if (!isSupabaseConfigured()) return DEMO;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Voto non valido." };
  await requireUser("/grades");

  const supabase = await createClient();
  // La RLS limita la cancellazione ai voti dello studente; restituiamo la riga per l'annullamento.
  const { data, error } = await supabase.from("grades").delete().eq("id", id).select("*").maybeSingle();
  if (error || !data) return { ok: false, error: "Voto non trovato." };

  refresh();
  return { ok: true, grade: data };
}

/** Annulla un'eliminazione reinserendo la stessa riga (stesso id). */
export async function restoreGrade(grade: GradeRow): Promise<GradeActionResult> {
  if (!isSupabaseConfigured()) return DEMO;
  const user = await requireUser("/grades");
  if (grade.user_id !== user.id) return { ok: false, error: "Voto non valido." };

  const supabase = await createClient();
  const { error } = await supabase.from("grades").insert({
    id: grade.id,
    subject_id: grade.subject_id,
    value: grade.value,
    weight: grade.weight,
    kind: grade.kind,
    graded_on: grade.graded_on,
    description: grade.description,
  });
  if (error) return { ok: false, error: "Non siamo riusciti a ripristinare il voto." };

  refresh();
  return { ok: true };
}
