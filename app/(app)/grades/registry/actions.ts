"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/data/session";
import { registryRowsSchema } from "@/lib/registry/schema";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type RegistrySyncResult =
  | { ok: true; inserted: number; updated: number; created: string[]; unmatched: string[] }
  | { ok: false; error: string };

/** Salva i voti letti dall'app nella webview del registro. L'utente è quello della sessione. */
export async function syncRegistryGrades(rows: unknown): Promise<RegistrySyncResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "demo" };
  await requireUser("/grades");
  const parsed = registryRowsSchema.safeParse(rows);
  if (!parsed.success) return { ok: false, error: "Dati dal registro non validi." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sync_my_grades", { p_rows: parsed.data });
  if (error) {
    return { ok: false, error: "Non sono riuscito a salvare i voti. Riprova tra poco." };
  }
  const r = data as { inserted?: number; updated?: number; created?: string[]; unmatched?: string[] };
  refresh();
  return { ok: true, inserted: r.inserted ?? 0, updated: r.updated ?? 0, created: r.created ?? [], unmatched: r.unmatched ?? [] };
}
