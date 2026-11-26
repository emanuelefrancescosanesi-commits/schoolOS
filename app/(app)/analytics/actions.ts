"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireOnboardedUser } from "@/lib/data/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type GoalResult = { ok: true } | { ok: false; error: string };

const input = z.object({
  subjectId: z.string().min(1).max(64).nullable(),
  /** null = rimuove l'obiettivo. */
  target: z.number().finite().nullable(),
});

/** Imposta, cambia o toglie l'obiettivo di media di una materia (o quello generale). */
export async function setGoal(raw: unknown): Promise<GoalResult> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Valore non valido." };
  const { subjectId, target } = parsed.data;
  // In demo non si salva: la pagina tiene l'obiettivo solo finché è aperta.
  if (!isSupabaseConfigured()) return { ok: true };
  const { profile } = await requireOnboardedUser();
  if (target !== null && (target < profile.grade_min || target > profile.grade_max)) {
    return { ok: false, error: `Scrivi un valore tra ${profile.grade_min} e ${profile.grade_max}.` };
  }
  const supabase = await createClient();
  const scope = subjectId === null ? supabase.from("goals").select("id").is("subject_id", null) : supabase.from("goals").select("id").eq("subject_id", subjectId);
  const { data: existing, error: readError } = await scope.maybeSingle();
  if (readError) return { ok: false, error: "Non siamo riusciti a salvare. Riprova tra poco." };

  const fail = { ok: false, error: "Non siamo riusciti a salvare. Riprova tra poco." } as const;
  if (target === null) {
    if (existing) {
      const { error } = await supabase.from("goals").delete().eq("id", existing.id);
      if (error) return fail;
    }
  } else if (existing) {
    const { error } = await supabase.from("goals").update({ target }).eq("id", existing.id);
    if (error) return fail;
  } else {
    const { error } = await supabase.from("goals").insert({ subject_id: subjectId, target });
    if (error) return fail;
  }
  refresh();
  return { ok: true };
}
