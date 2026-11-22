"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/data/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { messageInputSchema } from "@/lib/validation/message";

export type MessageActionResult = { ok: true; id?: string } | { ok: false; error: string };
const DEMO: MessageActionResult = { ok: false, error: "demo" };

export async function addMessage(input: Record<string, unknown>): Promise<MessageActionResult> {
  if (!isSupabaseConfigured()) return DEMO;
  await requireUser("/inbox");
  const parsed = messageInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { subject_id, ...rest } = parsed.data;
  if (subject_id && !z.uuid().safeParse(subject_id).success) return { ok: false, error: "Materia non valida." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inbox_messages")
    .insert({ ...rest, subject_id: subject_id || null, source: "manual" })
    .select("id")
    .single();
  if (error) {
    if (error.code === "53400") return { ok: false, error: "Hai raggiunto il numero massimo di comunicazioni." };
    if (error.code === "PGRST205" || error.code === "42P01") return { ok: false, error: "L'Inbox non è ancora attiva su questo database." };
    return { ok: false, error: "Non siamo riusciti a salvare. Riprova." };
  }
  refresh();
  return { ok: true, id: data.id };
}

export async function setMessageRead(id: string, read: boolean): Promise<MessageActionResult> {
  if (!isSupabaseConfigured()) return DEMO;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Comunicazione non valida." };
  await requireUser("/inbox");
  const supabase = await createClient();
  const { error } = await supabase.from("inbox_messages").update({ is_read: read }).eq("id", id);
  if (error) return { ok: false, error: "Non siamo riusciti ad aggiornare." };
  refresh();
  return { ok: true };
}

export async function markAllRead(): Promise<MessageActionResult> {
  if (!isSupabaseConfigured()) return DEMO;
  await requireUser("/inbox");
  const supabase = await createClient();
  const { error } = await supabase.from("inbox_messages").update({ is_read: true }).eq("is_read", false);
  if (error) return { ok: false, error: "Non siamo riusciti ad aggiornare." };
  refresh();
  return { ok: true };
}

export async function deleteMessage(id: string): Promise<MessageActionResult> {
  if (!isSupabaseConfigured()) return DEMO;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Comunicazione non valida." };
  await requireUser("/inbox");
  const supabase = await createClient();
  const { error } = await supabase.from("inbox_messages").delete().eq("id", id);
  if (error) return { ok: false, error: "Non siamo riusciti a eliminare." };
  refresh();
  return { ok: true };
}
