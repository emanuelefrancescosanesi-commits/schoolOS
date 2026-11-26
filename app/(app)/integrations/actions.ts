"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { syncFeed } from "@/lib/calendar/sync";
import { googleConfig } from "@/lib/google/config";
import { decryptToken } from "@/lib/google/crypto";
import { revokeToken } from "@/lib/google/oauth";
import { syncGoogle } from "@/lib/google/sync";
import { normalizeFeedUrl } from "@/lib/calendar/feed-url";
import { requireOnboardedUser } from "@/lib/data/session";
import { dateKeyInTimeZone } from "@/lib/domain/dates";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type FeedActionResult = { ok: true; summary?: string } | { ok: false; error: string };
const DEMO: FeedActionResult = { ok: false, error: "demo" };
const STALE_MS = 30 * 60 * 1000;

const summary = (r: { added: number; updated: number; removed: number }) =>
  r.added + r.updated + r.removed === 0
    ? "Calendario già aggiornato."
    : `${r.added} nuovi, ${r.updated} modificati, ${r.removed} rimossi.`;

export async function addCalendarFeed(rawUrl: string, label: string): Promise<FeedActionResult> {
  if (!isSupabaseConfigured()) return DEMO;
  const { profile } = await requireOnboardedUser();
  const checked = normalizeFeedUrl(rawUrl);
  if (!checked.ok) return { ok: false, error: checked.error };
  const name = label.trim().slice(0, 60);

  const supabase = await createClient();
  const { data, error } = await supabase.from("calendar_feeds").insert({ url: checked.url, label: name }).select("id, url").single();
  if (error) {
    if (error.code === "53400") return { ok: false, error: "Puoi collegare al massimo 3 calendari." };
    if (error.code === "PGRST205" || error.code === "42P01") return { ok: false, error: "Questa funzione non è ancora attiva su questo database." };
    return { ok: false, error: "Non siamo riusciti a salvare. Riprova." };
  }

  const today = dateKeyInTimeZone(new Date(), profile.time_zone);
  const res = await syncFeed(supabase, data, profile.time_zone, today);
  if (!res.ok) {
    // Un link che non funziona non resta salvato: l'errore si corregge al primo tentativo.
    await supabase.from("calendar_feeds").delete().eq("id", data.id);
    return { ok: false, error: res.error };
  }
  refresh();
  return { ok: true, summary: summary(res.result) };
}

export async function syncCalendarFeed(id: string): Promise<FeedActionResult> {
  if (!isSupabaseConfigured()) return DEMO;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Calendario non valido." };
  const { profile } = await requireOnboardedUser();
  const supabase = await createClient();
  const { data: feed } = await supabase.from("calendar_feeds").select("id, url").eq("id", id).maybeSingle();
  if (!feed) return { ok: false, error: "Calendario non trovato." };
  const res = await syncFeed(supabase, feed, profile.time_zone, dateKeyInTimeZone(new Date(), profile.time_zone));
  refresh();
  return res.ok ? { ok: true, summary: summary(res.result) } : { ok: false, error: res.error };
}

export async function removeCalendarFeed(id: string): Promise<FeedActionResult> {
  if (!isSupabaseConfigured()) return DEMO;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Calendario non valido." };
  await requireOnboardedUser();
  const supabase = await createClient();
  // Gli eventi importati spariscono con il calendario (cascata nel database).
  const { error } = await supabase.from("calendar_feeds").delete().eq("id", id);
  if (error) return { ok: false, error: "Non siamo riusciti a scollegare. Riprova." };
  refresh();
  return { ok: true };
}

export async function syncGoogleNow(): Promise<FeedActionResult> {
  if (!isSupabaseConfigured()) return DEMO;
  const { user, profile } = await requireOnboardedUser();
  const supabase = await createClient();
  const res = await syncGoogle(supabase, user.id, profile.time_zone, dateKeyInTimeZone(new Date(), profile.time_zone));
  refresh();
  if (!res.ok) return { ok: false, error: res.error };
  const { events, messagesAdded } = res.result;
  const parts = [
    events ? `Calendario: ${events.added} nuovi, ${events.updated} modificati, ${events.removed} rimossi.` : null,
    messagesAdded !== null ? `Mail: ${messagesAdded} nuove.` : null,
  ].filter(Boolean);
  return { ok: true, summary: parts.join(" ") || "Già aggiornato." };
}

/** Scollega Google: revoca il permesso presso Google, elimina il collegamento e tutto ciò che ne è arrivato. */
export async function disconnectGoogle(): Promise<FeedActionResult> {
  if (!isSupabaseConfigured()) return DEMO;
  const { user } = await requireOnboardedUser();
  const supabase = await createClient();
  const cfg = googleConfig();
  const { data: conn } = await supabase.from("google_connections").select("refresh_token_enc").maybeSingle();
  if (conn && cfg) {
    try {
      await revokeToken(decryptToken(conn.refresh_token_enc, cfg.tokenKey));
    } catch {
      // Chiave cambiata o dato illeggibile: si elimina comunque il collegamento locale.
    }
  }
  const del = await Promise.all([
    supabase.from("events").delete().not("google_event_id", "is", null),
    supabase.from("inbox_messages").delete().not("external_id", "is", null),
  ]);
  if (del.some((r) => r.error)) return { ok: false, error: "Non siamo riusciti a scollegare. Riprova." };
  const { error } = await supabase.from("google_connections").delete().eq("user_id", user.id);
  if (error) return { ok: false, error: "Non siamo riusciti a scollegare. Riprova." };
  refresh();
  return { ok: true };
}

/** Aggiorna i calendari e Google se non sincronizzati da più di 30 minuti (all'apertura di Calendario e Inbox). */
export async function syncStaleFeeds(): Promise<{ changed: boolean }> {
  if (!isSupabaseConfigured()) return { changed: false };
  const { user, profile } = await requireOnboardedUser();
  const supabase = await createClient();
  const { data: feeds, error } = await supabase.from("calendar_feeds").select("id, url, last_synced_at, last_error");
  const feedList = error ? [] : (feeds ?? []);
  const today = dateKeyInTimeZone(new Date(), profile.time_zone);
  let changed = false;
  for (const f of feedList) {
    const last = f.last_synced_at ? Date.parse(f.last_synced_at) : 0;
    if (Date.now() - last < STALE_MS) continue;
    const res = await syncFeed(supabase, f, profile.time_zone, today);
    if (res.ok && res.result.added + res.result.updated + res.result.removed > 0) changed = true;
  }
  // Google (Calendar + Gmail), con lo stesso intervallo.
  const { data: g } = await supabase.from("google_connections").select("last_synced_at, last_error").maybeSingle();
  // Con un errore (es. collegamento scaduto) non si riprova a ogni apertura: si usa «Aggiorna ora» o si ricollega.
  if (g && !g.last_error && Date.now() - (g.last_synced_at ? Date.parse(g.last_synced_at) : 0) >= STALE_MS) {
    const res = await syncGoogle(supabase, user.id, profile.time_zone, today);
    if (res.ok && ((res.result.events && res.result.events.added + res.result.events.updated + res.result.events.removed > 0) || res.result.messagesAdded)) changed = true;
  }
  if (changed) refresh();
  return { changed };
}
