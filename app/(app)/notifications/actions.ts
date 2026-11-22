"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/data/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type NotificationResult = { ok: true } | { ok: false; error: string };

const ids = z.array(z.string().min(1).max(120)).min(1).max(300);
const GENERIC: NotificationResult = { ok: false, error: "Non siamo riusciti a salvare. Riprova tra poco." };
/** I segni di lettura più vecchi di così non servono più: i promemoria sono sempre recenti. */
const KEEP_DAYS = 90;

/** Segna come letti uno o più promemoria. In demo non salva nulla (lo stato resta nel browser). */
export async function markNotificationsRead(input: unknown): Promise<NotificationResult> {
  const parsed = ids.safeParse(input);
  if (!parsed.success) return GENERIC;
  if (!isSupabaseConfigured()) return { ok: true };
  await requireUser("/notifications");
  const supabase = await createClient();
  const { error } = await supabase
    .from("notification_reads")
    .upsert([...new Set(parsed.data)].map((reminder_id) => ({ reminder_id })), { onConflict: "user_id,reminder_id", ignoreDuplicates: true });
  if (error) return GENERIC;
  // Pulizia opportunistica; se fallisce non è un problema.
  await supabase
    .from("notification_reads")
    .delete()
    .lt("read_at", new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString());
  refresh();
  return { ok: true };
}

/** Rimette un promemoria tra quelli da leggere. */
export async function markNotificationUnread(input: unknown): Promise<NotificationResult> {
  const parsed = z.string().min(1).max(120).safeParse(input);
  if (!parsed.success) return GENERIC;
  if (!isSupabaseConfigured()) return { ok: true };
  await requireUser("/notifications");
  const supabase = await createClient();
  const { error } = await supabase.from("notification_reads").delete().eq("reminder_id", parsed.data);
  if (error) return GENERIC;
  refresh();
  return { ok: true };
}
