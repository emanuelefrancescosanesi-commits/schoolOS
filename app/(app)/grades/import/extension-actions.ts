"use server";

import { requireUser } from "@/lib/data/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type ExtensionCode = { id: string; label: string; createdAt: string; lastUsedAt: string | null };

/** Crea un codice di collegamento per l'estensione. Il codice in chiaro si vede solo ora. */
export async function createExtensionCode(): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "demo" };
  await requireUser("/grades");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_extension_token", { p_label: "Estensione browser" });
  if (error) {
    return { ok: false, error: error.code === "53400" ? "Hai già 5 codici attivi: revocane uno." : "Non sono riuscito a creare il codice." };
  }
  return { ok: true, code: data };
}

export async function listExtensionCodes(): Promise<ExtensionCode[]> {
  if (!isSupabaseConfigured()) return [];
  await requireUser("/grades");
  const supabase = await createClient();
  const { data } = await supabase
    .from("extension_tokens")
    .select("id,label,created_at,last_used_at")
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({ id: r.id, label: r.label, createdAt: r.created_at, lastUsedAt: r.last_used_at }));
}

export async function revokeExtensionCode(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  await requireUser("/grades");
  const supabase = await createClient();
  const { error } = await supabase.from("extension_tokens").delete().eq("id", id);
  return !error;
}
