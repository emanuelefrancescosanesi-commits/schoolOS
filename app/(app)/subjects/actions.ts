"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/data/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type RenameResult = { ok: true; name: string } | { ok: false; error: string };

const nameSchema = z.string().trim().min(1, "Scrivi un nome").max(60, "Massimo 60 caratteri");

/** Rinomina una materia dello studente (la RLS limita l'update alle sue righe). */
export async function renameSubject(id: string, name: string): Promise<RenameResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "demo" };
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Materia non valida." };
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  await requireUser("/subjects");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subjects")
    .update({ name: parsed.data })
    .eq("id", id)
    .select("name")
    .maybeSingle();
  if (error?.code === "23505") return { ok: false, error: "Hai già una materia con questo nome." };
  if (error || !data) return { ok: false, error: "Non siamo riusciti a rinominare la materia. Riprova." };

  refresh();
  return { ok: true, name: data.name };
}
