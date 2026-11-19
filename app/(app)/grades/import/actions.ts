"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getSchoolContext } from "@/lib/data/school-data";
import { requireUser } from "@/lib/data/session";
import { ImportExtractionError, ImportUnavailableError, extractGrades } from "@/lib/import/extract";
import { readImportInput } from "@/lib/import/input";
import { type ImportRow, normalizeExtraction } from "@/lib/import/normalize";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { gradeInputSchema } from "@/lib/validation/grade";

/** Analisi AI al giorno per studente: protegge dai costi e dagli abusi (vedi consume_ai_quota). */
export const DAILY_IMPORT_LIMIT = 15;
const MAX_ROWS = 150;

export type PreviewResult = { ok: true; rows: ImportRow[] } | { ok: false; error: string };

export async function previewImport(formData: FormData): Promise<PreviewResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "demo" };
  await requireUser("/grades");

  const read = await readImportInput(formData.get("text"), formData.get("file"));
  if (!read.ok) return { ok: false, error: read.error };

  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "L'importazione automatica non è ancora attiva. Per ora puoi aggiungere i voti a mano." };
  }

  const { data, today, schoolYear } = await getSchoolContext();
  if (data.subjects.length === 0) return { ok: false, error: "Aggiungi prima le tue materie." };

  const supabase = await createClient();
  const quota = await supabase.rpc("consume_ai_quota", { p_kind: "grade_import", p_limit: DAILY_IMPORT_LIMIT });
  if (quota.error) return { ok: false, error: "Non siamo riusciti ad avviare l'analisi. Riprova." };
  if (!quota.data) {
    return { ok: false, error: `Hai raggiunto il limite di ${DAILY_IMPORT_LIMIT} analisi per oggi. Riprova domani o aggiungi i voti a mano.` };
  }

  try {
    const extracted = await extractGrades(read.input, {
      subjectNames: data.subjects.map((s) => s.name),
      today,
      schoolYear: schoolYear ? { starts_on: schoolYear.starts_on, ends_on: schoolYear.ends_on } : null,
    });
    const rows = normalizeExtraction(extracted, {
      subjects: data.subjects.map((s) => ({ id: s.id, name: s.name })),
      scale: data.profile.scale,
      existing: data.grades.map((g) => ({ subjectId: g.subjectId, date: g.date, value: g.value, kind: g.kind })),
      today,
      schoolYear: schoolYear ? { starts_on: schoolYear.starts_on, ends_on: schoolYear.ends_on } : null,
    });
    return { ok: true, rows };
  } catch (error) {
    if (error instanceof ImportExtractionError) return { ok: false, error: error.message };
    if (error instanceof ImportUnavailableError) {
      return { ok: false, error: "L'importazione automatica non è ancora attiva. Per ora puoi aggiungere i voti a mano." };
    }
    console.error("[import] errore inatteso", error);
    return { ok: false, error: "Qualcosa è andato storto. Riprova." };
  }
}

const confirmedRowSchema = z.object({
  subject_id: z.uuid(),
  value: z.string().max(10),
  date: z.string().max(10),
  kind: z.enum(["written", "oral", "practical"]),
  description: z.string().max(200),
});

export type ConfirmResult = { ok: true; imported: number; skipped: number } | { ok: false; error: string };

/**
 * Salva le righe che lo studente ha confermato. Non si fida del client: rilegge ogni riga con la
 * scala del profilo e scarta i duplicati (anche in caso di doppio clic), poi inserisce tutto in
 * un'unica scrittura, quindi o entrano tutti o nessuno.
 */
export async function confirmImport(rows: unknown): Promise<ConfirmResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "demo" };
  await requireUser("/grades");

  const list = z.array(confirmedRowSchema).min(1, "Seleziona almeno un voto").max(MAX_ROWS).safeParse(rows);
  if (!list.success) return { ok: false, error: list.error.issues[0].message };

  const { data, today } = await getSchoolContext();
  const schema = gradeInputSchema(data.profile.scale);
  const subjectIds = new Set(data.subjects.map((s) => s.id));

  const valid = [];
  for (const row of list.data) {
    if (!subjectIds.has(row.subject_id)) return { ok: false, error: "Materia non valida." };
    const parsed = schema.safeParse({
      subject_id: row.subject_id,
      value: row.value,
      weight: 1,
      kind: row.kind,
      graded_on: row.date,
      description: row.description,
    });
    if (!parsed.success) return { ok: false, error: `${row.value}: ${parsed.error.issues[0].message}` };
    if (parsed.data.graded_on > today) return { ok: false, error: "Ci sono voti con la data nel futuro." };
    valid.push(parsed.data);
  }

  const taken = new Set(data.grades.map((g) => `${g.subjectId}|${g.date}|${g.kind}|${g.value}`));
  const fresh = valid.filter((g) => {
    const key = `${g.subject_id}|${g.graded_on}|${g.kind}|${g.value}`;
    if (taken.has(key)) return false;
    taken.add(key);
    return true;
  });
  if (fresh.length === 0) return { ok: true, imported: 0, skipped: valid.length };

  const supabase = await createClient();
  const { error } = await supabase.from("grades").insert(fresh.map((g) => ({ ...g, description: g.description || null })));
  if (error) return { ok: false, error: "Non siamo riusciti a salvare i voti. Riprova." };

  refresh();
  return { ok: true, imported: fresh.length, skipped: valid.length - fresh.length };
}
